import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { calculateDistanceKm } from "../../src/modules/occurrences/public-occurrence.service.js"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import {
  buildOccurrencePayload,
  createTestDisasterCategory
} from "../helpers/fixtures.js"

type TestAgent = Awaited<ReturnType<typeof createAuthenticatedCitizen>>["agent"]

async function createConfirmedOccurrence(
  citizenAgent: TestAgent,
  managerAgent: TestAgent,
  categoryId: string,
  overrides: Parameters<typeof buildOccurrencePayload>[0] = {}
) {
  const createResponse = await citizenAgent
    .post("/api/v1/occurrences")
    .send(buildOccurrencePayload(overrides))

  expect(createResponse.status).toBe(201)

  const occurrenceId: string = createResponse.body.data.id

  await managerAgent
    .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
    .send({
      decision: "CONFIRM",

      finalCategoryId: categoryId
    })
    .expect(201)

  return occurrenceId
}

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

      status: "CONFIRMED",

      location: {
        latitude: -3.12,

        longitude: -60.02,

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

    expect(detailResponse.body.data).not.toHaveProperty("description")

    expect(JSON.stringify(detailResponse.body)).not.toContain(
      "Ocorrência confirmada para teste público."
    )

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

  it("não deve revelar a posição exata pela distância nem pelo raio", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    // Ponto exato do relato. A posição pública é -3.11, -60.02.
    const exactLatitude = -3.1149

    const exactLongitude = -60.0249

    const occurrenceId = await createConfirmedOccurrence(
      citizen.agent,
      manager.agent,
      category.id,
      {
        latitude: exactLatitude,

        longitude: exactLongitude
      }
    )

    // Consultar exatamente do ponto do relato não pode dar distância zero.
    const fromExactPoint = await request(app).get(
      `/api/v1/public/occurrences?lat=${exactLatitude}&lon=${exactLongitude}&radiusKm=5`
    )

    expect(fromExactPoint.status).toBe(200)

    expect(fromExactPoint.body.data).toHaveLength(1)

    const expectedDistance = Number(
      calculateDistanceKm(exactLatitude, exactLongitude, -3.11, -60.02).toFixed(
        1
      )
    )

    expect(fromExactPoint.body.data[0]).toMatchObject({
      id: occurrenceId,

      distanceKm: expectedDistance,

      location: {
        latitude: -3.11,

        longitude: -60.02
      }
    })

    expect(expectedDistance).toBeGreaterThan(0.5)

    // Um raio pequeno em volta do ponto exato não pode encontrar o relato.
    const tinyRadius = await request(app).get(
      `/api/v1/public/occurrences?lat=${exactLatitude}&lon=${exactLongitude}&radiusKm=0.1`
    )

    expect(tinyRadius.status).toBe(200)

    expect(tinyRadius.body.data).toEqual([])

    // Já em volta da posição pública, ele aparece.
    const aroundPublicPoint = await request(app).get(
      "/api/v1/public/occurrences?lat=-3.11&lon=-60.02&radiusKm=0.1"
    )

    expect(aroundPublicPoint.body.data).toHaveLength(1)

    expect(aroundPublicPoint.body.data[0].distanceKm).toBe(0)
  })

  it("deve publicar só a hora cheia do relato", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const occurrenceId = await createConfirmedOccurrence(
      citizen.agent,
      manager.agent,
      category.id
    )

    const stored = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    const expectedHour = new Date(stored.reportedAt)

    expectedHour.setUTCMinutes(0, 0, 0)

    const response = await request(app).get(
      `/api/v1/public/occurrences/${occurrenceId}`
    )

    expect(response.status).toBe(200)

    expect(response.body.data.reportedAt).toBe(expectedHour.toISOString())
  })

  it("não deve ordenar pelo horário exato dentro da mesma hora", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const location = {
      latitude: -3.1149,

      longitude: -60.0249
    }

    const createdIds = [
      await createConfirmedOccurrence(
        citizen.agent,
        manager.agent,
        category.id,
        location
      ),

      await createConfirmedOccurrence(
        citizen.agent,
        manager.agent,
        category.id,
        location
      )
    ]

    const [lowerId, higherId] = createdIds.sort((left, right) =>
      left.localeCompare(right)
    )

    /*
     * O relato de id maior é o mais recente. Se a lista seguisse o
     * horário exato, ele viria primeiro.
     */
    await prisma.occurrence.update({
      where: {
        id: lowerId
      },

      data: {
        reportedAt: new Date("2026-10-12T14:05:00.000Z")
      }
    })

    await prisma.occurrence.update({
      where: {
        id: higherId
      },

      data: {
        reportedAt: new Date("2026-10-12T14:50:00.000Z")
      }
    })

    for (const query of ["", "?lat=-3.12&lon=-60.03&radiusKm=10"]) {
      const response = await request(app).get(
        `/api/v1/public/occurrences${query}`
      )

      expect(response.status).toBe(200)

      expect(response.body.data.map((item: { id: string }) => item.id)).toEqual(
        [lowerId, higherId]
      )

      expect(
        response.body.data.map(
          (item: { reportedAt: string }) => item.reportedAt
        )
      ).toEqual(["2026-10-12T14:00:00.000Z", "2026-10-12T14:00:00.000Z"])
    }
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
