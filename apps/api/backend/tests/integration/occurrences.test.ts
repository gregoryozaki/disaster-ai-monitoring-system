import { randomUUID } from "node:crypto"

import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"
import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

describe("Ocorrências do cidadão", () => {
  it("deve permitir que um cidadão crie uma ocorrência", async () => {
    const citizen = await createAuthenticatedCitizen()

    const payload = buildOccurrencePayload()

    const response = await citizen.agent
      .post("/api/v1/occurrences")
      .send(payload)

    expect(response.status).toBe(201)

    expect(response.body.meta).toMatchObject({
      created: true
    })

    expect(response.body.data).toMatchObject({
      clientLocalId: payload.clientLocalId,

      description: payload.description,

      urgency: payload.urgency,

      humanRisk: payload.humanRisk,

      status: "UNDER_REVIEW",

      location: {
        latitude: payload.latitude,

        longitude: payload.longitude,

        source: payload.locationSource
      }
    })

    expect(response.body.data).not.toHaveProperty("reporterId")

    expect(response.body.data).not.toHaveProperty("idempotencyKey")

    const storedOccurrence = await prisma.occurrence.findUnique({
      where: {
        id: response.body.data.id
      }
    })

    expect(storedOccurrence).not.toBeNull()

    expect(storedOccurrence?.reporterId).toBe(citizen.user.id)

    expect(storedOccurrence?.status).toBe("UNDER_REVIEW")
  })

  it("deve tratar repetição da mesma idempotencyKey como a mesma criação", async () => {
    const citizen = await createAuthenticatedCitizen()

    const payload = buildOccurrencePayload()

    const firstResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(payload)

    expect(firstResponse.status).toBe(201)

    expect(firstResponse.body.meta.created).toBe(true)

    const secondResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(payload)

    expect(secondResponse.status).toBe(200)

    expect(secondResponse.body.meta.created).toBe(false)

    expect(secondResponse.body.data.id).toBe(firstResponse.body.data.id)

    const count = await prisma.occurrence.count({
      where: {
        idempotencyKey: payload.idempotencyKey
      }
    })

    expect(count).toBe(1)
  })

  it("não deve permitir que dois cidadãos compartilhem a mesma idempotencyKey", async () => {
    const citizenA = await createAuthenticatedCitizen()

    const citizenB = await createAuthenticatedCitizen()

    const sharedIdempotencyKey = randomUUID()

    const firstResponse = await citizenA.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        idempotencyKey: sharedIdempotencyKey
      })
    )

    expect(firstResponse.status).toBe(201)

    const secondResponse = await citizenB.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          idempotencyKey: sharedIdempotencyKey
        })
      )

    expect(secondResponse.status).toBe(409)

    const count = await prisma.occurrence.count({
      where: {
        idempotencyKey: sharedIdempotencyKey
      }
    })

    expect(count).toBe(1)
  })

  it("deve listar somente as ocorrências do cidadão autenticado", async () => {
    const citizenA = await createAuthenticatedCitizen()

    const citizenB = await createAuthenticatedCitizen()

    const occurrenceA = await citizenA.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência do cidadão A"
      })
    )

    const occurrenceB = await citizenB.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência do cidadão B"
      })
    )

    expect(occurrenceA.status).toBe(201)

    expect(occurrenceB.status).toBe(201)

    const response = await citizenA.agent.get("/api/v1/occurrences")

    expect(response.status).toBe(200)

    expect(response.body.data).toHaveLength(1)

    expect(response.body.data[0].id).toBe(occurrenceA.body.data.id)

    expect(response.body.data[0].description).toBe("Ocorrência do cidadão A")
  })

  it("deve permitir que o cidadão consulte a própria ocorrência", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    const occurrenceId = createResponse.body.data.id

    const response = await citizen.agent.get(
      `/api/v1/occurrences/${occurrenceId}`
    )

    expect(response.status).toBe(200)

    expect(response.body.data.id).toBe(occurrenceId)
  })

  it("não deve revelar ocorrência de outro cidadão", async () => {
    const citizenA = await createAuthenticatedCitizen()

    const citizenB = await createAuthenticatedCitizen()

    const createResponse = await citizenA.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    const occurrenceId = createResponse.body.data.id

    const response = await citizenB.agent.get(
      `/api/v1/occurrences/${occurrenceId}`
    )

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })
  })

  it("deve impedir gestor de usar rota exclusiva de cidadão", async () => {
    const manager = await createAuthenticatedManager()

    const response = await manager.agent.get("/api/v1/occurrences")

    expect(response.status).toBe(403)
  })

  it("deve rejeitar acesso sem autenticação", async () => {
    const response = await request(app).get("/api/v1/occurrences")

    expect(response.status).toBe(401)

    expect(response.body).toMatchObject({
      error: {
        code: "AUTH_REQUIRED"
      }
    })
  })

  it("deve rejeitar UUID inválido antes de consultar o banco", async () => {
    const citizen = await createAuthenticatedCitizen()

    const response = await citizen.agent.get("/api/v1/occurrences/banana")

    expect(response.status).toBe(400)

    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ROUTE_PARAMS"
      }
    })
  })

  it("deve retornar 404 para UUID válido inexistente", async () => {
    const citizen = await createAuthenticatedCitizen()

    const response = await citizen.agent.get(
      "/api/v1/occurrences/00000000-0000-4000-8000-000000000001"
    )

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })
  })
})
