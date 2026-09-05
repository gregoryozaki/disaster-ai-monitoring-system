import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import {
  buildOccurrencePayload,
  createTestDisasterCategory
} from "../helpers/fixtures.js"

describe("Consulta operacional do gestor", () => {
  it("deve retornar classificação de IA, categoria confirmada e histórico", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Rua alagada após chuva intensa."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const modelVersion = await prisma.modelVersion.create({
      data: {
        modelType: "TEXTUAL",

        name: "kamara-test-text-model",

        version: "test-v1",

        active: true,

        syntheticData: true
      }
    })

    await prisma.aIClassification.create({
      data: {
        occurrenceId,

        modelVersionId: modelVersion.id,

        predictedCategoryId: category.id,

        resultStatus: "AVAILABLE",

        confidence: 0.87,

        textConfidence: 0.87,

        ambiguous: false,

        explanationSimple: "Classificação preliminar de teste.",

        signals: {
          source: "integration-test"
        }
      }
    })

    const listResponse = await manager.agent.get("/api/v1/manager/occurrences")

    expect(listResponse.status).toBe(200)

    const listedOccurrence = listResponse.body.data.find(
      (item: { id: string }) => item.id === occurrenceId
    )

    expect(listedOccurrence.aiClassification.predictedCategory.id).toBe(
      category.id
    )

    expect(listedOccurrence.aiClassification.confidence).toBe(0.87)

    const validationResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "CONFIRM",

        finalCategoryId: category.id,

        note: "Confirmação de teste."
      })

    expect(validationResponse.status).toBe(201)

    const detailResponse = await manager.agent.get(
      `/api/v1/manager/occurrences/${occurrenceId}`
    )

    expect(detailResponse.status).toBe(200)

    expect(detailResponse.body.data.confirmedCategory).toMatchObject({
      id: category.id,

      cobradeCode: category.cobradeCode,

      name: category.name
    })

    expect(detailResponse.body.data.aiClassification).toMatchObject({
      resultStatus: "AVAILABLE",

      confidence: 0.87,

      predictedCategory: {
        id: category.id
      },

      modelVersion: {
        name: "kamara-test-text-model",

        version: "test-v1",

        modelType: "TEXTUAL",

        syntheticData: true
      }
    })

    expect(detailResponse.body.data.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStatus: "UNDER_REVIEW",

          toStatus: "CONFIRMED",

          actorType: "USER"
        })
      ])
    )

    expect(detailResponse.body.data.validations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "CONFIRM",

          finalCategoryId: category.id
        })
      ])
    )
  })

  it("deve retornar ao gestor a solicitação e a resposta textual do cidadão", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Água acumulada em via pública após chuva."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const requestMessage = "Informe até onde a água chegou."

    const validationResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REQUEST_MORE_INFO",

        informationRequestMessage: requestMessage
      })

    expect(validationResponse.status).toBe(201)

    expect(validationResponse.body.data.occurrence.status).toBe(
      "NEEDS_MORE_INFO"
    )

    expect(validationResponse.body.data.informationRequest.status).toBe("OPEN")

    const requestId = validationResponse.body.data.informationRequest.id

    const complementText =
      "A água chegou aproximadamente até a metade da calçada."

    const answerResponse = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", complementText)

    expect(answerResponse.status).toBe(201)

    expect(answerResponse.body.data.occurrence.status).toBe("UNDER_REVIEW")

    const detailResponse = await manager.agent.get(
      `/api/v1/manager/occurrences/${occurrenceId}`
    )

    expect(detailResponse.status).toBe(200)

    const informationRequest =
      detailResponse.body.data.informationRequests.find(
        (item: { id: string }) => item.id === requestId
      )

    expect(informationRequest).toBeDefined()

    expect(informationRequest).toMatchObject({
      id: requestId,

      message: requestMessage,

      status: "ANSWERED",

      complement: {
        text: complementText
      }
    })

    expect(informationRequest.answeredAt).not.toBeNull()

    expect(informationRequest.complement.id).toBe(
      answerResponse.body.data.complement.id
    )

    expect(informationRequest.manager.id).toBe(manager.user.id)
  })

  it("deve combinar status, categoria sugerida, risco humano e período", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const matchingResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          description: "Ocorrência que deve atender a todos os filtros.",

          humanRisk: true
        })
      )

    expect(matchingResponse.status).toBe(201)

    const humanRiskFalseResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          description: "Mesma categoria, mas sem risco humano.",

          humanRisk: false
        })
      )

    expect(humanRiskFalseResponse.status).toBe(201)

    const outsideDateResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          description: "Mesma categoria e risco, mas fora do período.",

          humanRisk: true
        })
      )

    expect(outsideDateResponse.status).toBe(201)

    const matchingId = matchingResponse.body.data.id

    const humanRiskFalseId = humanRiskFalseResponse.body.data.id

    const outsideDateId = outsideDateResponse.body.data.id

    await prisma.occurrence.update({
      where: {
        id: matchingId
      },

      data: {
        reportedAt: new Date("2026-09-03T12:00:00.000Z")
      }
    })

    await prisma.occurrence.update({
      where: {
        id: humanRiskFalseId
      },

      data: {
        reportedAt: new Date("2026-09-03T13:00:00.000Z")
      }
    })

    await prisma.occurrence.update({
      where: {
        id: outsideDateId
      },

      data: {
        reportedAt: new Date("2026-09-10T12:00:00.000Z")
      }
    })

    const modelVersion = await prisma.modelVersion.create({
      data: {
        modelType: "TEXTUAL",

        name: "kamara-filter-test-model",

        version: "filter-v1",

        active: true,

        syntheticData: true
      }
    })

    for (const occurrenceId of [matchingId, humanRiskFalseId, outsideDateId]) {
      await prisma.aIClassification.create({
        data: {
          occurrenceId,

          modelVersionId: modelVersion.id,

          predictedCategoryId: category.id,

          resultStatus: "AVAILABLE",

          confidence: 0.8,

          textConfidence: 0.8,

          ambiguous: false,

          explanationSimple: "Classificação para teste de filtros."
        }
      })
    }

    const response = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        status: "UNDER_REVIEW",

        categoryId: category.id,

        humanRisk: "true",

        dateFrom: "2026-09-01",

        dateTo: "2026-09-05"
      })

    expect(response.status).toBe(200)

    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([
      matchingId
    ])

    const falseRiskResponse = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        categoryId: category.id,

        humanRisk: "false",

        dateFrom: "2026-09-01",

        dateTo: "2026-09-05"
      })

    expect(falseRiskResponse.status).toBe(200)

    expect(
      falseRiskResponse.body.data.map((item: { id: string }) => item.id)
    ).toEqual([humanRiskFalseId])
  })

  it("deve filtrar pela categoria confirmada pelo gestor", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const matchingResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          description: "Ocorrência que será confirmada na categoria."
        })
      )

    expect(matchingResponse.status).toBe(201)

    const otherResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência que não será confirmada."
      })
    )

    expect(otherResponse.status).toBe(201)

    const matchingId = matchingResponse.body.data.id

    const validationResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${matchingId}/validations`)
      .send({
        decision: "CONFIRM",

        finalCategoryId: category.id
      })

    expect(validationResponse.status).toBe(201)

    const response = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        categoryId: category.id
      })

    expect(response.status).toBe(200)

    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([
      matchingId
    ])

    expect(response.body.data[0].confirmedCategory.id).toBe(category.id)
  })

  it("deve aplicar o período de datas de forma inclusiva", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const insideResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência no fim do dia consultado."
      })
    )

    expect(insideResponse.status).toBe(201)

    const outsideResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(
        buildOccurrencePayload({
          description: "Ocorrência no dia seguinte."
        })
      )

    expect(outsideResponse.status).toBe(201)

    const insideId = insideResponse.body.data.id

    const outsideId = outsideResponse.body.data.id

    await prisma.occurrence.update({
      where: {
        id: insideId
      },

      data: {
        reportedAt: new Date("2026-09-05T23:59:59.999Z")
      }
    })

    await prisma.occurrence.update({
      where: {
        id: outsideId
      },

      data: {
        reportedAt: new Date("2026-09-06T00:00:00.000Z")
      }
    })

    const response = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        dateFrom: "2026-09-05",

        dateTo: "2026-09-05"
      })

    expect(response.status).toBe(200)

    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([
      insideId
    ])
  })

  it("deve rejeitar filtros operacionais inválidos", async () => {
    const manager = await createAuthenticatedManager()

    const invalidQueries: Array<Record<string, string>> = [
      {
        status: "STATUS_INEXISTENTE"
      },

      {
        categoryId: "nao-e-uuid"
      },

      {
        humanRisk: "yes"
      },

      {
        dateFrom: "2026-02-30"
      },

      {
        dateTo: "05-09-2026"
      },

      {
        dateFrom: "2026-09-06",

        dateTo: "2026-09-05"
      },

      {
        filtroDesconhecido: "valor"
      }
    ]

    for (const query of invalidQueries) {
      const response = await manager.agent
        .get("/api/v1/manager/occurrences")
        .query(query)

      expect(response.status).toBe(400)

      expect(response.body.error.code).toBe("INVALID_MANAGER_FILTERS")
    }
  })

  it("deve considerar somente a classificação de IA mais recente ao filtrar por categoria", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const oldCategory = await createTestDisasterCategory()

    const latestCategory = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência reclassificada pela IA."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const modelVersion = await prisma.modelVersion.create({
      data: {
        modelType: "TEXTUAL",

        name: "kamara-ai-history-test",

        version: "history-v1",

        active: true,

        syntheticData: true
      }
    })

    await prisma.aIClassification.create({
      data: {
        occurrenceId,

        modelVersionId: modelVersion.id,

        predictedCategoryId: oldCategory.id,

        resultStatus: "AVAILABLE",

        confidence: 0.91,

        textConfidence: 0.91,

        ambiguous: false,

        explanationSimple: "Classificação antiga.",

        createdAt: new Date("2026-09-05T10:00:00.000Z")
      }
    })

    await prisma.aIClassification.create({
      data: {
        occurrenceId,

        modelVersionId: modelVersion.id,

        predictedCategoryId: latestCategory.id,

        resultStatus: "AVAILABLE",

        confidence: 0.88,

        textConfidence: 0.88,

        ambiguous: false,

        explanationSimple: "Classificação mais recente.",

        createdAt: new Date("2026-09-05T11:00:00.000Z")
      }
    })

    const oldCategoryResponse = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        categoryId: oldCategory.id
      })

    expect(oldCategoryResponse.status).toBe(200)

    expect(
      oldCategoryResponse.body.data.some(
        (item: { id: string }) => item.id === occurrenceId
      )
    ).toBe(false)

    const latestCategoryResponse = await manager.agent
      .get("/api/v1/manager/occurrences")
      .query({
        categoryId: latestCategory.id
      })

    expect(latestCategoryResponse.status).toBe(200)

    const occurrence = latestCategoryResponse.body.data.find(
      (item: { id: string }) => item.id === occurrenceId
    )

    expect(occurrence).toBeDefined()

    expect(occurrence.aiClassification.predictedCategory.id).toBe(
      latestCategory.id
    )

    expect(occurrence.aiClassification.explanationSimple).toBe(
      "Classificação mais recente."
    )
  })
})
