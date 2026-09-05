import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedCitizen } from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

describe("Sincronização offline de ocorrências", () => {
  it("deve sincronizar ocorrência preservando o instante original e registrar histórico", async () => {
    const citizen = await createAuthenticatedCitizen()

    const reportedAt = "2026-09-05T12:15:30.000Z"

    const payload = {
      ...buildOccurrencePayload({
        description:
          "Ocorrência registrada enquanto o dispositivo estava sem internet."
      }),

      reportedAt
    }

    const response = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", payload.idempotencyKey)
      .send(payload)

    expect(response.status).toBe(201)

    expect(response.body.meta).toMatchObject({
      created: true,
      synchronized: true
    })

    expect(response.body.data.status).toBe("UNDER_REVIEW")

    expect(response.body.data.clientLocalId).toBe(payload.clientLocalId)

    expect(new Date(response.body.data.reportedAt).toISOString()).toBe(
      reportedAt
    )

    expect(response.body.data.syncedAt).not.toBeNull()

    const history = await prisma.statusHistory.findMany({
      where: {
        occurrenceId: response.body.data.id
      },

      orderBy: {
        createdAt: "asc"
      }
    })

    expect(history).toEqual([
      expect.objectContaining({
        fromStatus: "PENDING_SYNC",

        toStatus: "UNDER_REVIEW",

        actorType: "SYSTEM",

        reason: "Ocorrência sincronizada da fila offline."
      })
    ])
  })

  it("deve retornar a mesma ocorrência ao repetir a mesma idempotencyKey", async () => {
    const citizen = await createAuthenticatedCitizen()

    const payload = {
      ...buildOccurrencePayload(),

      reportedAt: "2026-09-05T12:20:00.000Z"
    }

    const first = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", payload.idempotencyKey)
      .send(payload)

    expect(first.status).toBe(201)

    expect(first.body.meta.created).toBe(true)

    const second = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", payload.idempotencyKey)
      .send(payload)

    expect(second.status).toBe(200)

    expect(second.body.meta.created).toBe(false)

    expect(second.body.data.id).toBe(first.body.data.id)

    const count = await prisma.occurrence.count({
      where: {
        clientLocalId: payload.clientLocalId
      }
    })

    expect(count).toBe(1)

    const historyCount = await prisma.statusHistory.count({
      where: {
        occurrenceId: first.body.data.id
      }
    })

    expect(historyCount).toBe(1)
  })

  it("deve reconciliar pelo mesmo clientLocalId mesmo em uma nova tentativa com outra idempotencyKey", async () => {
    const citizen = await createAuthenticatedCitizen()

    const payload = {
      ...buildOccurrencePayload(),

      reportedAt: "2026-09-05T12:25:00.000Z"
    }

    const first = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", payload.idempotencyKey)
      .send(payload)

    expect(first.status).toBe(201)

    const secondPayload = {
      ...payload,

      idempotencyKey: randomUUID()
    }

    const second = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", secondPayload.idempotencyKey)
      .send(secondPayload)

    expect(second.status).toBe(200)

    expect(second.body.data.id).toBe(first.body.data.id)

    expect(second.body.meta.created).toBe(false)

    const occurrenceCount = await prisma.occurrence.count({
      where: {
        clientLocalId: payload.clientLocalId
      }
    })

    expect(occurrenceCount).toBe(1)

    const historyCount = await prisma.statusHistory.count({
      where: {
        occurrenceId: first.body.data.id
      }
    })

    expect(historyCount).toBe(1)
  })

  it("deve rejeitar quando o cabeçalho Idempotency-Key divergir do payload", async () => {
    const citizen = await createAuthenticatedCitizen()

    const payload = {
      ...buildOccurrencePayload(),

      reportedAt: "2026-09-05T12:30:00.000Z"
    }

    const response = await citizen.agent
      .post("/api/v1/occurrences/sync")
      .set("Idempotency-Key", randomUUID())
      .send(payload)

    expect(response.status).toBe(400)

    expect(response.body.error.code).toBe("IDEMPOTENCY_KEY_MISMATCH")

    const count = await prisma.occurrence.count({
      where: {
        clientLocalId: payload.clientLocalId
      }
    })

    expect(count).toBe(0)
  })
})
