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

describe("Validação humana de ocorrências", () => {
  it("deve confirmar uma ocorrência UNDER_REVIEW", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência que será confirmada."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const response = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "CONFIRM",
        finalCategoryId: category.id,
        note: "Ocorrência confirmada pelo gestor."
      })

    expect(response.status).toBe(201)

    expect(response.body.data.occurrence).toMatchObject({
      id: occurrenceId,
      status: "CONFIRMED",
      confirmedCategoryId: category.id
    })

    expect(response.body.data.validation).toMatchObject({
      decision: "CONFIRM",
      finalCategoryId: category.id
    })

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("CONFIRMED")

    expect(occurrence.confirmedCategoryId).toBe(category.id)

    const validation = await prisma.validation.findFirst({
      where: {
        occurrenceId
      }
    })

    expect(validation).not.toBeNull()

    expect(validation?.managerId).toBe(manager.user.id)

    expect(validation?.decision).toBe("CONFIRM")

    const history = await prisma.statusHistory.findFirst({
      where: {
        occurrenceId,
        toStatus: "CONFIRMED"
      }
    })

    expect(history).not.toBeNull()

    expect(history?.fromStatus).toBe("UNDER_REVIEW")

    expect(history?.changedByUserId).toBe(manager.user.id)

    expect(history?.actorType).toBe("USER")
  })

  it("deve permitir correção de categoria e confirmar a ocorrência", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência com categoria corrigida."
      })
    )

    const occurrenceId = createResponse.body.data.id

    const response = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "CORRECT",
        finalCategoryId: category.id,
        note: "Categoria corrigida após análise humana."
      })

    expect(response.status).toBe(201)

    expect(response.body.data.occurrence).toMatchObject({
      id: occurrenceId,
      status: "CONFIRMED",
      confirmedCategoryId: category.id
    })

    expect(response.body.data.validation).toMatchObject({
      decision: "CORRECT",
      finalCategoryId: category.id
    })

    const validation = await prisma.validation.findFirst({
      where: {
        occurrenceId
      }
    })

    expect(validation?.decision).toBe("CORRECT")

    expect(validation?.finalCategoryId).toBe(category.id)
  })

  it("deve rejeitar uma ocorrência", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência que será rejeitada."
      })
    )

    const occurrenceId = createResponse.body.data.id

    const response = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REJECT",
        rejectionReason: "Registro não representa uma ocorrência válida.",
        note: "Análise manual concluída."
      })

    expect(response.status).toBe(201)

    expect(response.body.data.occurrence.status).toBe("REJECTED")

    expect(response.body.data.validation).toMatchObject({
      decision: "REJECT",
      rejectionReason: "Registro não representa uma ocorrência válida."
    })

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("REJECTED")

    const history = await prisma.statusHistory.findFirst({
      where: {
        occurrenceId,
        toStatus: "REJECTED"
      }
    })

    expect(history).not.toBeNull()

    expect(history?.fromStatus).toBe("UNDER_REVIEW")
  })

  it("deve solicitar mais informações ao cidadão", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Ocorrência que precisa de complemento."
      })
    )

    const occurrenceId = createResponse.body.data.id

    const response = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REQUEST_MORE_INFO",

        informationRequestMessage: "Envie uma foto mais ampla do local.",

        note: "Evidência visual insuficiente."
      })

    expect(response.status).toBe(201)

    expect(response.body.data.occurrence.status).toBe("NEEDS_MORE_INFO")

    expect(response.body.data.validation).toMatchObject({
      decision: "REQUEST_MORE_INFO"
    })

    expect(response.body.data.informationRequest).toMatchObject({
      message: "Envie uma foto mais ampla do local.",
      status: "OPEN"
    })

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("NEEDS_MORE_INFO")

    const informationRequest = await prisma.informationRequest.findFirst({
      where: {
        occurrenceId
      }
    })

    expect(informationRequest).not.toBeNull()

    expect(informationRequest?.managerId).toBe(manager.user.id)

    expect(informationRequest?.status).toBe("OPEN")

    const history = await prisma.statusHistory.findFirst({
      where: {
        occurrenceId,
        toStatus: "NEEDS_MORE_INFO"
      }
    })

    expect(history).not.toBeNull()

    expect(history?.fromStatus).toBe("UNDER_REVIEW")
  })

  it("não deve permitir nova validação depois que a ocorrência foi confirmada", async () => {
    const citizen = await createAuthenticatedCitizen()

    const manager = await createAuthenticatedManager()

    const category = await createTestDisasterCategory()

    const createResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    const occurrenceId = createResponse.body.data.id

    const firstResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "CONFIRM",
        finalCategoryId: category.id
      })

    expect(firstResponse.status).toBe(201)

    const secondResponse = await manager.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REJECT",
        rejectionReason: "Tentativa de revalidar ocorrência terminal."
      })

    expect(secondResponse.status).toBe(409)

    expect(secondResponse.body).toMatchObject({
      error: {
        code: "INVALID_OCCURRENCE_STATE"
      }
    })

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("CONFIRMED")

    const validationCount = await prisma.validation.count({
      where: {
        occurrenceId
      }
    })

    expect(validationCount).toBe(1)
  })

  it("não deve permitir que cidadão use endpoint de validação", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    const occurrenceId = createResponse.body.data.id

    const response = await citizen.agent
      .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
      .send({
        decision: "REJECT",
        rejectionReason: "Tentativa não autorizada."
      })

    expect(response.status).toBe(403)

    const validationCount = await prisma.validation.count({
      where: {
        occurrenceId
      }
    })

    expect(validationCount).toBe(0)
  })

  it("deve rejeitar UUID inválido no endpoint de validação", async () => {
    const manager = await createAuthenticatedManager()

    const response = await manager.agent
      .post("/api/v1/manager/occurrences/banana/validations")
      .send({
        decision: "REJECT",
        rejectionReason: "Teste de UUID inválido."
      })

    expect(response.status).toBe(400)

    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ROUTE_PARAMS"
      }
    })
  })
})
