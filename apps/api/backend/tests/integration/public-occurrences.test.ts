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

  it("deve expor ocorrência CONFIRMED com projeção pública minimizada", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência confirmada para teste público.",

        latitude: -3.119027,

        longitude: -60.021731
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

      location: {
        latitude: -3.119,

        longitude: -60.022,

        approximate: true
      },

      distanceKm: null,

      category: {
        id: category.id,

        cobradeCode: category.cobradeCode,

        name: category.name
      },

      validation: {
        confirmed: true
      }
    })

    expect(detailResponse.body.data.location.latitude).not.toBe(-3.119027)

    expect(detailResponse.body.data.location.longitude).not.toBe(-60.021731)

    expect(detailResponse.body.data).not.toHaveProperty("reporterId")

    expect(detailResponse.body.data).not.toHaveProperty("idempotencyKey")

    expect(detailResponse.body.data).not.toHaveProperty("clientLocalId")

    const listResponse = await request(app).get("/api/v1/public/occurrences")

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toHaveLength(1)

    expect(listResponse.body.data[0].id).toBe(occurrenceId)

    expect(listResponse.body.meta).toMatchObject({
      center: null,

      radiusKm: null,

      count: 1
    })
  })

  it("deve filtrar ocorrências pelo raio e retornar distância aproximada", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const nearResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência próxima ao ponto de consulta.",

        latitude: -3.12,

        longitude: -60.02
      })
    )

    expect(nearResponse.status).toBe(201)

    await manager.agent
      .post(
        `/api/v1/manager/occurrences/${nearResponse.body.data.id}/validations`
      )
      .send({
        decision: "CONFIRM",

        finalCategoryId: category.id
      })
      .expect(201)

    const farResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência fora do raio de cinco quilômetros.",

        latitude: -3.2,

        longitude: -60.1
      })
    )

    expect(farResponse.status).toBe(201)

    await manager.agent
      .post(
        `/api/v1/manager/occurrences/${farResponse.body.data.id}/validations`
      )
      .send({
        decision: "CONFIRM",

        finalCategoryId: category.id
      })
      .expect(201)

    const response = await request(app).get(
      "/api/v1/public/occurrences?lat=-3.119&lon=-60.022&radiusKm=5"
    )

    expect(response.status).toBe(200)

    expect(response.body.data).toHaveLength(1)

    expect(response.body.data[0].id).toBe(nearResponse.body.data.id)

    expect(response.body.data[0].distanceKm).toEqual(expect.any(Number))

    expect(response.body.data[0].distanceKm).toBeLessThan(5)

    expect(response.body.meta).toMatchObject({
      center: {
        latitude: -3.119,

        longitude: -60.022
      },

      radiusKm: 5,

      count: 1
    })
  })

  it("deve rejeitar consulta geográfica incompleta", async () => {
    const response = await request(app).get(
      "/api/v1/public/occurrences?lat=-3.119&radiusKm=10"
    )

    expect(response.status).toBe(422)

    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    })
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
