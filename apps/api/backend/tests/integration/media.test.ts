import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

import { testPngBuffer, testPngSha256 } from "../helpers/media.js"

async function createOccurrenceForCitizen() {
  const citizen = await createAuthenticatedCitizen()

  const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
    buildOccurrencePayload({
      description: "Ocorrência usada em teste de mídia."
    })
  )

  expect(createResponse.status).toBe(201)

  return {
    citizen,
    occurrenceId: createResponse.body.data.id
  }
}

async function uploadInitialPhoto(
  citizen: Awaited<ReturnType<typeof createAuthenticatedCitizen>>,
  occurrenceId: string
) {
  const response = await citizen.agent
    .post(`/api/v1/occurrences/${occurrenceId}/media`)
    .attach("file", testPngBuffer, {
      filename: "evidencia.png",

      contentType: "image/png"
    })

  return response
}

describe("Mídia de ocorrências", () => {
  it("deve armazenar a foto inicial da ocorrência", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const response = await uploadInitialPhoto(citizen, occurrenceId)

    expect(response.status).toBe(201)

    expect(response.body.data).toMatchObject({
      occurrenceId,
      complementId: null,
      type: "IMAGE",
      origin: "INITIAL",
      mimeType: "image/png",
      sha256: testPngSha256,
      isPrimary: true
    })

    expect(response.body.data.id).toEqual(expect.any(String))

    expect(response.body.data.contentUrl).toBe(
      `/api/v1/media/${response.body.data.id}/content`
    )

    /*
     * storageRef é detalhe interno.
     * A API não deve expor o caminho
     * físico do objeto no MinIO.
     */
    expect(response.body.data).not.toHaveProperty("storageRef")

    const media = await prisma.occurrenceMedia.findUniqueOrThrow({
      where: {
        id: response.body.data.id
      }
    })

    expect(media.occurrenceId).toBe(occurrenceId)

    expect(media.complementId).toBeNull()

    expect(media.type).toBe("IMAGE")

    expect(media.origin).toBe("INITIAL")

    expect(media.mimeType).toBe("image/png")

    expect(media.sha256).toBe(testPngSha256)

    expect(media.isPrimary).toBe(true)

    expect(media.storageRef).toContain(`occurrences/${occurrenceId}/initial/`)
  })

  it("deve permitir que o cidadão liste e baixe sua própria imagem", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const uploadResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(uploadResponse.status).toBe(201)

    const mediaId = uploadResponse.body.data.id

    const listResponse = await citizen.agent.get(
      `/api/v1/occurrences/${occurrenceId}/media`
    )

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toHaveLength(1)

    expect(listResponse.body.data[0]).toMatchObject({
      id: mediaId,
      occurrenceId,
      type: "IMAGE",
      origin: "INITIAL",
      mimeType: "image/png",
      sha256: testPngSha256,
      isPrimary: true
    })

    expect(listResponse.body.data[0]).not.toHaveProperty("storageRef")

    const contentResponse = await citizen.agent.get(
      `/api/v1/media/${mediaId}/content`
    )

    expect(contentResponse.status).toBe(200)

    expect(contentResponse.headers["content-type"]).toContain("image/png")

    expect(contentResponse.headers["cross-origin-resource-policy"]).toBe(
      "cross-origin"
    )

    expect(contentResponse.headers["content-disposition"]).toBe("inline")

    expect(contentResponse.headers["content-length"]).toBe(
      String(testPngBuffer.length)
    )

    expect(Buffer.isBuffer(contentResponse.body)).toBe(true)

    expect(contentResponse.body.equals(testPngBuffer)).toBe(true)
  })

  it("não deve permitir uma segunda foto primária para a mesma ocorrência", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const firstResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(firstResponse.status).toBe(201)

    const secondResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(secondResponse.status).toBe(409)

    expect(secondResponse.body).toMatchObject({
      error: {
        code: "PRIMARY_PHOTO_ALREADY_EXISTS"
      }
    })

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        occurrenceId,
        type: "IMAGE",
        isPrimary: true
      }
    })

    expect(mediaCount).toBe(1)
  })

  it("não deve permitir que outro cidadão envie mídia para a ocorrência", async () => {
    const { occurrenceId } = await createOccurrenceForCitizen()

    const otherCitizen = await createAuthenticatedCitizen()

    const response = await uploadInitialPhoto(otherCitizen, occurrenceId)

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        occurrenceId
      }
    })

    expect(mediaCount).toBe(0)
  })

  it("deve rejeitar arquivo que finge ser PNG", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const fakePng = Buffer.from("isto não é uma imagem PNG válida", "utf8")

    const response = await citizen.agent
      .post(`/api/v1/occurrences/${occurrenceId}/media`)
      .attach("file", fakePng, {
        filename: "arquivo-falso.png",

        contentType: "image/png"
      })

    expect(response.status).toBe(415)

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        occurrenceId
      }
    })

    expect(mediaCount).toBe(0)
  })

  it("deve rejeitar foto acima do limite de 10 MB", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const oversizedFile = Buffer.alloc(10 * 1024 * 1024 + 1)

    const response = await citizen.agent
      .post(`/api/v1/occurrences/${occurrenceId}/media`)
      .attach("file", oversizedFile, {
        filename: "imagem-grande.png",

        contentType: "image/png"
      })

    expect(response.status).toBe(413)

    expect(response.body).toMatchObject({
      error: {
        code: "MEDIA_TOO_LARGE"
      }
    })

    const mediaCount = await prisma.occurrenceMedia.count({
      where: {
        occurrenceId
      }
    })

    expect(mediaCount).toBe(0)
  })

  it("não deve permitir que outro cidadão liste as mídias da ocorrência", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const uploadResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(uploadResponse.status).toBe(201)

    const otherCitizen = await createAuthenticatedCitizen()

    const response = await otherCitizen.agent.get(
      `/api/v1/occurrences/${occurrenceId}/media`
    )

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "OCCURRENCE_NOT_FOUND"
      }
    })
  })

  it("não deve permitir que outro cidadão baixe a mídia", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const uploadResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(uploadResponse.status).toBe(201)

    const mediaId = uploadResponse.body.data.id

    const otherCitizen = await createAuthenticatedCitizen()

    const response = await otherCitizen.agent.get(
      `/api/v1/media/${mediaId}/content`
    )

    expect(response.status).toBe(404)

    expect(response.body).toMatchObject({
      error: {
        code: "MEDIA_NOT_FOUND"
      }
    })
  })

  it("deve exigir autenticação para baixar mídia", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const uploadResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(uploadResponse.status).toBe(201)

    const mediaId = uploadResponse.body.data.id

    const response = await request(app).get(`/api/v1/media/${mediaId}/content`)

    expect(response.status).toBe(401)

    expect(response.body).toMatchObject({
      error: {
        code: "AUTH_REQUIRED"
      }
    })
  })

  it("deve permitir que gestor liste e baixe a mídia da ocorrência", async () => {
    const { citizen, occurrenceId } = await createOccurrenceForCitizen()

    const uploadResponse = await uploadInitialPhoto(citizen, occurrenceId)

    expect(uploadResponse.status).toBe(201)

    const mediaId = uploadResponse.body.data.id

    const manager = await createAuthenticatedManager()

    const listResponse = await manager.agent.get(
      `/api/v1/manager/occurrences/${occurrenceId}/media`
    )

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toHaveLength(1)

    expect(listResponse.body.data[0].id).toBe(mediaId)

    expect(listResponse.body.data[0]).not.toHaveProperty("storageRef")

    const contentResponse = await manager.agent.get(
      `/api/v1/media/${mediaId}/content`
    )

    expect(contentResponse.status).toBe(200)

    expect(contentResponse.headers["content-type"]).toContain("image/png")

    expect(Buffer.isBuffer(contentResponse.body)).toBe(true)

    expect(contentResponse.body.equals(testPngBuffer)).toBe(true)
  })
})
