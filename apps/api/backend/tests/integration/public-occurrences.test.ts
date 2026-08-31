import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import {
  buildOccurrencePayload,
  createTestDisasterCategory
} from "../helpers/fixtures.js"

describe("Ocorrências públicas", () => {
  it("não deve expor ocorrência UNDER_REVIEW", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const detailResponse = await request(app).get(
      `/api/v1/public/occurrences/${occurrenceId}`
    )

    expect(detailResponse.status).toBe(404)

    expect(detailResponse.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })

    const listResponse = await request(app).get("/api/v1/public/occurrences")

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toEqual([])
  })

  it("deve expor ocorrência CONFIRMED", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência confirmada para teste público."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const validationResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "CONFIRM",
        finalCategoryId: category.id
      })

    expect(validationResponse.status).toBe(201)

    expect(validationResponse.body.data.occurrence.status).toBe("CONFIRMED")

    const detailResponse = await request(app).get(
      `/api/v1/public/occurrences/${occurrenceId}`
    )

    expect(detailResponse.status).toBe(200)

    expect(detailResponse.body.data).toMatchObject({
      id: occurrenceId,

      description: "Ocorrência confirmada para teste público.",

      status: "CONFIRMED",

      category: {
        id: category.id,

        cobradeCode: category.cobradeCode,

        name: category.name
      }
    })

    expect(detailResponse.body.data).not.toHaveProperty("reporterId")

    expect(detailResponse.body.data).not.toHaveProperty("idempotencyKey")

    expect(detailResponse.body.data).not.toHaveProperty("clientLocalId")

    const listResponse = await request(app).get("/api/v1/public/occurrences")

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toHaveLength(1)

    expect(listResponse.body.data[0].id).toBe(occurrenceId)
  })

  it("não deve expor ocorrência REJECTED", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência rejeitada."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const validationResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REJECT",

        rejectionReason: "Registro não corresponde a uma ocorrência válida."
      })

    expect(validationResponse.status).toBe(201)

    expect(validationResponse.body.data.occurrence.status).toBe("REJECTED")

    const detailResponse = await request(app).get(
      `/api/v1/public/occurrences/${occurrenceId}`
    )

    expect(detailResponse.status).toBe(404)

    const listResponse = await request(app).get("/api/v1/public/occurrences")

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toEqual([])
  })

  it("deve rejeitar UUID público inválido", async () => {
    const response = await request(app).get("/api/v1/public/occurrences/banana")

    expect(response.status).toBe(400)

    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ROUTE_PARAMS"
      }
    })
  })

  it("deve retornar 404 para UUID público válido inexistente", async () => {
    const response = await request(app).get(
      "/api/v1/public/occurrences/00000000-0000-4000-8000-000000000001"
    )

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })
  })
})
