import { afterEach, describe, expect, it, vi } from "vitest"

import { preAnalyzeOccurrence } from "../../src/modules/ai-classification/ai-classification.service.js"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedCitizen } from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

function mockTextClassification() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        predictedCobradeCode: "1.2.3.0.0",

        confidence: 0.86,

        visualConfidence: null,

        textConfidence: 0.86,

        ambiguous: false,

        ambiguityReason: null,

        explanationSimple: "Classificação textual sem imagem.",

        model: {
          modelType: "TEXTUAL",

          name: "mock-bertimbau-text-only",

          version: "test-v1",

          syntheticData: true
        },

        signals: {
          textUsed: true,

          imageReceived: false,

          imageUsed: false,

          textLabel: "COBRADE_1_2_3_0_0",

          visualResultStatus: "UNAVAILABLE"
        }
      }),

      {
        status: 200,

        headers: {
          "content-type": "application/json"
        }
      }
    )
  )

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

async function ensureFloodCategory() {
  return prisma.disasterCategory.create({
    data: {
      cobradeCode: "1.2.3.0.0",

      name: "Alagamentos",

      groupName: "NATURAIS - Hidrológico",

      active: true
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()

  vi.restoreAllMocks()
})

describe("Pré-análise textual sem fotografia", () => {
  it("deve classificar uma ocorrência apenas com texto", async () => {
    await ensureFloodCategory()

    const citizen = await createAuthenticatedCitizen()

    const description = "A rua está alagada depois da chuva forte."

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    const fetchMock = mockTextClassification()

    const classification = await preAnalyzeOccurrence({
      occurrenceId,

      mode: "TEXT_ONLY"
    })

    expect(classification).not.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe("http://localhost:8000/classify")

    expect(options.method).toBe("POST")

    expect(options.body).toBeInstanceOf(FormData)

    const formData = options.body as FormData

    expect(formData.get("occurrence_id")).toBe(occurrenceId)

    expect(formData.get("text")).toBe(description)

    expect(formData.get("image")).toBeNull()

    const persisted = await prisma.aIClassification.findUniqueOrThrow({
      where: {
        id: classification!.id
      },

      include: {
        predictedCategory: true,

        modelVersion: true
      }
    })

    expect(persisted.occurrenceId).toBe(occurrenceId)

    expect(persisted.resultStatus).toBe("AVAILABLE")

    expect(Number(persisted.confidence)).toBeCloseTo(0.86)

    expect(persisted.visualConfidence).toBeNull()

    expect(Number(persisted.textConfidence)).toBeCloseTo(0.86)

    expect(persisted.predictedCategory?.cobradeCode).toBe("1.2.3.0.0")

    expect(persisted.modelVersion.modelType).toBe("TEXTUAL")

    expect(persisted.modelVersion.name).toBe("mock-bertimbau-text-only")

    expect(persisted.signals).toMatchObject({
      textUsed: true,

      imageReceived: false,

      imageUsed: false,

      predictedCobradeCode: "1.2.3.0.0"
    })
  })

  it("não deve executar TEXT_ONLY se a ocorrência já possui imagem", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "Descrição para teste de evidência mais recente."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    await prisma.occurrenceMedia.create({
      data: {
        occurrenceId,

        type: "IMAGE",

        origin: "INITIAL",

        mimeType: "image/png",

        storageRef: `tests/${occurrenceId}/image.png`,

        sizeBytes: BigInt(123),

        sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

        isPrimary: true
      }
    })

    const fetchMock = mockTextClassification()

    const result = await preAnalyzeOccurrence({
      occurrenceId,

      mode: "TEXT_ONLY"
    })

    expect(result).toBeNull()

    expect(fetchMock).not.toHaveBeenCalled()

    const count = await prisma.aIClassification.count({
      where: {
        occurrenceId
      }
    })

    expect(count).toBe(0)
  })

  it("não deve gerar uma classificação textual obsoleta se a foto chegar durante a inferência", async () => {
    const citizen = await createAuthenticatedCitizen()

    const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
      buildOccurrencePayload({
        description: "A rua está alagada após a chuva."
      })
    )

    expect(createResponse.status).toBe(201)

    const occurrenceId = createResponse.body.data.id

    let releaseResponse: (() => void) | undefined

    const waiting = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })

    const fetchMock = vi.fn(async () => {
      await waiting

      return new Response(
        JSON.stringify({
          resultStatus: "AVAILABLE",

          predictedCobradeCode: "1.2.3.0.0",

          confidence: 0.85,

          visualConfidence: null,

          textConfidence: 0.85,

          ambiguous: false,

          ambiguityReason: null,

          explanationSimple: "Resultado textual que ficou obsoleto.",

          model: {
            modelType: "TEXTUAL",

            name: "mock-delayed-text",

            version: "test-v1",

            syntheticData: true
          },

          signals: {
            textUsed: true,

            imageReceived: false,

            imageUsed: false
          }
        }),

        {
          status: 200,

          headers: {
            "content-type": "application/json"
          }
        }
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    const analysisPromise = preAnalyzeOccurrence({
      occurrenceId,

      mode: "TEXT_ONLY"
    })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await prisma.occurrenceMedia.create({
      data: {
        occurrenceId,

        type: "IMAGE",

        origin: "INITIAL",

        mimeType: "image/png",

        storageRef: `tests/${occurrenceId}/late-image.png`,

        sizeBytes: BigInt(123),

        sha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

        isPrimary: true
      }
    })

    releaseResponse?.()

    const result = await analysisPromise

    expect(result).toBeNull()

    const count = await prisma.aIClassification.count({
      where: {
        occurrenceId
      }
    })

    expect(count).toBe(0)
  })
})
