import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedAdmin } from "../helpers/auth.js"

async function createExportFixture() {
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

  const secretEmail = `export-secret-${randomUUID()}@kamara.test`

  const secretDescription = `DADO-SENSIVEL-${randomUUID()}`

  const citizen = await prisma.user.create({
    data: {
      name: "Pessoa Não Exportável",

      email: secretEmail,

      passwordHash: "not-used",

      role: "CITIZEN",

      status: "ACTIVE"
    }
  })

  const occurrence = await prisma.occurrence.create({
    data: {
      reporterId: citizen.id,

      confirmedCategoryId: category.id,

      clientLocalId: randomUUID(),

      idempotencyKey: randomUUID(),

      description: secretDescription,

      urgency: "HIGH",

      humanRisk: true,

      reportedAt: new Date("2037-07-13T14:32:45.000Z"),

      latitude: -3.456789,

      longitude: -60.987654,

      locationSource: "AUTO",

      status: "CONFIRMED"
    }
  })

  return {
    citizen,

    occurrence,

    secretEmail,

    secretDescription
  }
}

describe("Exportações persistentes", () => {
  it("deve gerar JSON anonimizado, persistir o job e permitir download autenticado", async () => {
    const admin = await createAuthenticatedAdmin()

    const fixture = await createExportFixture()

    const response = await admin.agent.post("/api/v1/exports").send({
      format: "JSON"
    })

    expect(response.status).toBe(202)

    expect(response.body.data).toMatchObject({
      format: "JSON",

      status: "READY",

      anonymized: true
    })

    expect(response.body.data.fileRef).toBeUndefined()

    expect(response.body.data.contentUrl).toBe(
      `/api/v1/exports/${response.body.data.id}/content`
    )

    const stored = await prisma.exportJob.findUniqueOrThrow({
      where: {
        id: response.body.data.id
      }
    })

    expect(stored.status).toBe("READY")

    expect(stored.fileRef).toMatch(/^exports\//)

    const requestedAudit = await prisma.auditLog.findFirst({
      where: {
        action: "EXPORT_REQUESTED",

        entityId: stored.id
      }
    })

    const readyAudit = await prisma.auditLog.findFirst({
      where: {
        action: "EXPORT_READY",

        entityId: stored.id
      }
    })

    expect(requestedAudit).not.toBeNull()

    expect(readyAudit).not.toBeNull()

    const content = await admin.agent.get(
      `/api/v1/exports/${stored.id}/content`
    )

    expect(content.status).toBe(200)

    expect(content.headers["content-disposition"]).toContain(".json")

    expect(Array.isArray(content.body)).toBe(true)

    const row = (
      content.body as Array<{
        recordNumber: number

        reportedDate: string

        cobradeCode: string | null

        latitudeApprox: number

        longitudeApprox: number
      }>
    ).find(
      (item) =>
        item.cobradeCode === "1.2.3.0.0" &&
        item.latitudeApprox === -3.46 &&
        item.longitudeApprox === -60.99
    )

    expect(row).toBeDefined()

    const serialized = JSON.stringify(content.body)

    expect(serialized).not.toContain(fixture.secretEmail)

    expect(serialized).not.toContain(fixture.secretDescription)

    expect(serialized).not.toContain(fixture.citizen.id)

    expect(serialized).not.toContain(fixture.occurrence.id)

    expect(serialized).not.toContain(fixture.occurrence.clientLocalId!)

    expect(serialized).not.toContain(fixture.occurrence.idempotencyKey!)
  })

  it("deve gerar CSV real e anonimizado no MinIO", async () => {
    const admin = await createAuthenticatedAdmin()

    const fixture = await createExportFixture()

    const response = await admin.agent.post("/api/v1/exports").send({
      format: "CSV"
    })

    expect(response.status).toBe(202)

    expect(response.body.data.status).toBe("READY")

    const content = await admin.agent.get(
      `/api/v1/exports/${response.body.data.id}/content`
    )

    expect(content.status).toBe(200)

    expect(content.headers["content-type"]).toContain("text/csv")

    expect(content.headers["content-disposition"]).toContain(".csv")

    expect(content.text).toContain("record_number")

    expect(content.text).toContain("1.2.3.0.0")

    expect(content.text).toContain("-3.46")

    expect(content.text).toContain("-60.99")

    expect(content.text).not.toContain(fixture.secretEmail)

    expect(content.text).not.toContain(fixture.secretDescription)

    expect(content.text).not.toContain(fixture.occurrence.id)
  })
})
