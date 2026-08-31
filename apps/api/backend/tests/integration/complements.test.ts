import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

import { testPngBuffer, testPngSha256 } from "../helpers/media.js"

async function createOccurrenceAwaitingMoreInfo() {
  const citizen = await createAuthenticatedCitizen()

  const manager = await createAuthenticatedManager()

  const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
    buildOccurrencePayload({
      description: "Ocorrência aguardando informação complementar."
    })
  )

  expect(createResponse.status).toBe(201)

  const occurrenceId = createResponse.body.data.id

  const validationResponse = await manager.agent
    .post(`/api/v1/manager/occurrences/${occurrenceId}/validations`)
    .send({
      decision: "REQUEST_MORE_INFO",

      informationRequestMessage:
        "Envie informações adicionais e, se possível, uma nova foto."
    })

  expect(validationResponse.status).toBe(201)

  expect(validationResponse.body.data.occurrence.status).toBe("NEEDS_MORE_INFO")

  expect(validationResponse.body.data.informationRequest.status).toBe("OPEN")

  const requestId = validationResponse.body.data.informationRequest.id

  return {
    citizen,
    manager,
    occurrenceId,
    requestId
  }
}

describe("Complementos de ocorrências", () => {
  it("deve permitir resposta somente com texto", async () => {
    const { citizen, occurrenceId, requestId } =
      await createOccurrenceAwaitingMoreInfo()

    const response = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", "A água chegou aproximadamente até a metade da calçada.")

    expect(response.status).toBe(201)

    expect(response.body.data.complement).toMatchObject({
      occurrenceId,
      requestId,
      text: "A água chegou aproximadamente até a metade da calçada."
    })

    expect(response.body.data.media).toBeNull()

    expect(response.body.data.occurrence.status).toBe("UNDER_REVIEW")

    const complementId = response.body.data.complement.id

    const complement = await prisma.occurrenceComplement.findUnique({
      where: {
        id: complementId
      }
    })

    expect(complement).not.toBeNull()

    expect(complement?.text).toBe(
      "A água chegou aproximadamente até a metade da calçada."
    )

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        complementId
      }
    })

    expect(mediaCount).toBe(0)

    const informationRequest =
      await prisma.informationRequest.findUniqueOrThrow({
        where: {
          id: requestId
        }
      })

    expect(informationRequest.status).toBe("ANSWERED")

    expect(informationRequest.answeredAt).not.toBeNull()

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("UNDER_REVIEW")

    const history = await prisma.statusHistory.findFirst({
      where: {
        occurrenceId,
        fromStatus: "NEEDS_MORE_INFO",
        toStatus: "UNDER_REVIEW"
      }
    })

    expect(history).not.toBeNull()
  })

  it("deve permitir resposta somente com foto", async () => {
    const { citizen, occurrenceId, requestId } =
      await createOccurrenceAwaitingMoreInfo()

    const response = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .attach("file", testPngBuffer, {
        filename: "complemento.png",

        contentType: "image/png"
      })

    expect(response.status).toBe(201)

    expect(response.body.data.complement).toMatchObject({
      occurrenceId,
      requestId,
      text: null
    })

    expect(response.body.data.media).toMatchObject({
      occurrenceId,
      type: "IMAGE",
      origin: "COMPLEMENT",
      mimeType: "image/png",
      sha256: testPngSha256,
      isPrimary: false
    })

    expect(response.body.data.occurrence.status).toBe("UNDER_REVIEW")

    const complementId = response.body.data.complement.id

    const mediaId = response.body.data.media.id

    expect(response.body.data.media.complementId).toBe(complementId)

    const media = await prisma.occurrenceMedia.findUniqueOrThrow({
      where: {
        id: mediaId
      }
    })

    expect(media.complementId).toBe(complementId)

    expect(media.origin).toBe("COMPLEMENT")

    expect(media.type).toBe("IMAGE")

    expect(media.mimeType).toBe("image/png")

    expect(media.sha256).toBe(testPngSha256)

    expect(media.isPrimary).toBe(false)

    expect(media.storageRef).toContain(
      `occurrences/${occurrenceId}/complements/${complementId}/`
    )
  })

  it("deve permitir resposta com texto e foto", async () => {
    const { citizen, occurrenceId, requestId } =
      await createOccurrenceAwaitingMoreInfo()

    const text =
      "A água aumentou desde o primeiro registro. Segue nova foto do local."

    const response = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", text)
      .attach("file", testPngBuffer, {
        filename: "nova-evidencia.png",

        contentType: "image/png"
      })

    expect(response.status).toBe(201)

    expect(response.body.data.complement).toMatchObject({
      occurrenceId,
      requestId,
      text
    })

    expect(response.body.data.media).not.toBeNull()

    expect(response.body.data.media.origin).toBe("COMPLEMENT")

    expect(response.body.data.media.isPrimary).toBe(false)

    expect(response.body.data.media.sha256).toBe(testPngSha256)

    expect(response.body.data.media.complementId).toBe(
      response.body.data.complement.id
    )

    expect(response.body.data.media.contentUrl).toBe(
      `/api/v1/media/${response.body.data.media.id}/content`
    )

    expect(response.body.data.occurrence.status).toBe("UNDER_REVIEW")

    const request = await prisma.informationRequest.findUniqueOrThrow({
      where: {
        id: requestId
      }
    })

    expect(request.status).toBe("ANSWERED")

    expect(request.answeredAt).not.toBeNull()

    const complementCount = await prisma.occurrenceComplement.count({
      where: {
        requestId
      }
    })

    expect(complementCount).toBe(1)

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        occurrenceId,
        origin: "COMPLEMENT"
      }
    })

    expect(mediaCount).toBe(1)
  })

  it("deve rejeitar complemento sem texto e sem foto", async () => {
    const { citizen, occurrenceId, requestId } =
      await createOccurrenceAwaitingMoreInfo()

    const response = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", "")

    expect(response.status).toBe(400)

    expect(response.body).toMatchObject({
      error: {
        code: "COMPLEMENT_CONTENT_REQUIRED"
      }
    })

    const request = await prisma.informationRequest.findUniqueOrThrow({
      where: {
        id: requestId
      }
    })

    expect(request.status).toBe("OPEN")

    expect(request.answeredAt).toBeNull()

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("NEEDS_MORE_INFO")

    const complementCount = await prisma.occurrenceComplement.count({
      where: {
        requestId
      }
    })

    expect(complementCount).toBe(0)
  })

  it("não deve permitir que outro cidadão responda à solicitação", async () => {
    const { occurrenceId, requestId } = await createOccurrenceAwaitingMoreInfo()

    const otherCitizen = await createAuthenticatedCitizen()

    const response = await otherCitizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", "Tentativa de responder ocorrência de outro cidadão.")

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })

    const request = await prisma.informationRequest.findUniqueOrThrow({
      where: {
        id: requestId
      }
    })

    expect(request.status).toBe("OPEN")

    const complementCount = await prisma.occurrenceComplement.count({
      where: {
        requestId
      }
    })

    expect(complementCount).toBe(0)
  })

  it("não deve permitir responder novamente uma solicitação já respondida", async () => {
    const { citizen, occurrenceId, requestId } =
      await createOccurrenceAwaitingMoreInfo()

    const firstResponse = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", "Primeira resposta válida.")

    expect(firstResponse.status).toBe(201)

    const secondResponse = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
      )
      .field("text", "Tentativa de segunda resposta.")

    expect(secondResponse.status).toBe(409)

    /*
     * Na sequência atual do service, a ocorrência
     * já voltou para UNDER_REVIEW antes da segunda
     * tentativa chegar à consulta da solicitação.
     */
    expect(secondResponse.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_WAITING_FOR_INFO"
      }
    })

    const complementCount = await prisma.occurrenceComplement.count({
      where: {
        requestId
      }
    })

    expect(complementCount).toBe(1)

    const request = await prisma.informationRequest.findUniqueOrThrow({
      where: {
        id: requestId
      }
    })

    expect(request.status).toBe("ANSWERED")

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("UNDER_REVIEW")
  })

  it("deve rejeitar requestId inválido antes do service", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent
      .post("/api/v1/occurrences")
      .send(buildOccurrencePayload())

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const response = await citizen.agent
      .post(
        `/api/v1/occurrences/${occurrenceId}/information-requests/banana/complements`
      )
      .field("text", "Conteúdo que não deve chegar ao service.")

    expect(response.status).toBe(400)

    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ROUTE_PARAMS"
      }
    })
  })
})
