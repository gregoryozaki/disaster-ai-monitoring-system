import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedAdmin } from "../helpers/auth.js"

describe("Analytics persistido", () => {
  it("deve calcular o resumo a partir das ocorrências reais e ignorar ocorrências excluídas", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: "1.2.3.0.0"
      },

      update: {
        name: "Alagamentos",

        groupName: "NATURAIS - Hidrológico",

        active: true
      },

      create: {
        cobradeCode: "1.2.3.0.0",

        name: "Alagamentos",

        groupName: "NATURAIS - Hidrológico",

        active: true
      }
    })

    const citizen = await prisma.user.create({
      data: {
        name: "Cidadão Analytics",

        email: `analytics-${randomUUID()}@kamara.test`,

        passwordHash: "not-used-in-this-test",

        role: "CITIZEN",

        status: "ACTIVE"
      }
    })

    const before = await admin.agent.get("/api/v1/analytics/summary")

    expect(before.status).toBe(200)

    const previousCategoryCount =
      (
        before.body.data.byCategory as Array<{
          category: {
            id: string
          }

          count: number
        }>
      ).find((item) => item.category.id === category.id)?.count ?? 0

    await prisma.occurrence.createMany({
      data: [
        {
          reporterId: citizen.id,

          confirmedCategoryId: category.id,

          description: "Ocorrência confirmada para analytics.",

          latitude: -3.119027,

          longitude: -60.021731,

          locationSource: "AUTO",

          status: "CONFIRMED"
        },

        {
          reporterId: citizen.id,

          description: "Ocorrência em análise.",

          latitude: -3.12,

          longitude: -60.02,

          locationSource: "AUTO",

          status: "UNDER_REVIEW"
        },

        {
          reporterId: citizen.id,

          description: "Ocorrência aguardando complemento.",

          latitude: -3.121,

          longitude: -60.021,

          locationSource: "AUTO",

          status: "NEEDS_MORE_INFO"
        },

        {
          reporterId: citizen.id,

          description: "Ocorrência rejeitada.",

          latitude: -3.122,

          longitude: -60.022,

          locationSource: "AUTO",

          status: "REJECTED"
        },

        {
          reporterId: citizen.id,

          confirmedCategoryId: category.id,

          description: "Ocorrência excluída.",

          latitude: -3.123,

          longitude: -60.023,

          locationSource: "AUTO",

          status: "CONFIRMED",

          deletedAt: new Date()
        }
      ]
    })

    const response = await admin.agent.get("/api/v1/analytics/summary")

    expect(response.status).toBe(200)

    const data = response.body.data

    expect(data.total).toBe(before.body.data.total + 4)

    expect(data.confirmed).toBe(before.body.data.confirmed + 1)

    expect(data.underReview).toBe(before.body.data.underReview + 1)

    expect(data.needsMoreInfo).toBe(before.body.data.needsMoreInfo + 1)

    expect(data.byStatus.REJECTED).toBe(
      (before.body.data.byStatus.REJECTED ?? 0) + 1
    )

    expect(data.confirmationRate).toBeCloseTo(data.confirmed / data.total, 8)

    const categorySummary = (
      data.byCategory as Array<{
        category: {
          id: string
          cobradeCode: string
        }

        count: number
      }>
    ).find((item) => item.category.id === category.id)

    expect(categorySummary).toBeDefined()

    expect(categorySummary?.category.cobradeCode).toBe("1.2.3.0.0")

    expect(categorySummary?.count).toBe(previousCategoryCount + 1)
  })
})
