import { afterEach, describe, expect, it, vi } from "vitest"

import { preAnalyzeOccurrence } from "../../src/modules/ai-classification/ai-classification.service.js"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedCitizen } from "../helpers/auth.js"

import { buildOccurrencePayload } from "../helpers/fixtures.js"

import { testPngBuffer } from "../helpers/media.js"

async function createOccurrenceWithPhoto(description: string) {
  const citizen = await createAuthenticatedCitizen()

  const createResponse = await citizen.agent.post("/api/v1/occurrences").send(
    buildOccurrencePayload({
      description
    })
  )

  expect(createResponse.status).toBe(201)

  const occurrenceId = createResponse.body.data.id

  const uploadResponse = await citizen.agent
    .post(`/api/v1/occurrences/${occurrenceId}/media`)
    .attach("file", testPngBuffer, {
      filename: "evidencia.png",
      contentType: "image/png"
    })

  expect(uploadResponse.status).toBe(201)

  return {
    occurrenceId
  }
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

function mockAvailableTextClassification(
  cobradeCode: string | null = "1.2.3.0.0"
) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        predictedCobradeCode: cobradeCode,

        confidence: 0.84,

        visualConfidence: null,

        textConfidence: 0.84,

        ambiguous: false,

        ambiguityReason: null,

        explanationSimple: "Classificação textual mockada para teste.",

        model: {
          modelType: "TEXTUAL",
          name: "mock-bertimbau-text",
          version: "test-v2",
          syntheticData: true
        },

        signals: {
          textUsed: true,
          imageReceived: true,
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

function mockAvailableVisualClassification() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        /*
         * O classificador visual não deve
         * inventar uma COBRADE exata.
         */
        predictedCobradeCode: null,

        confidence: 0.93,

        visualConfidence: 0.93,

        textConfidence: null,

        ambiguous: false,

        ambiguityReason: null,

        explanationSimple:
          "O modelo visual identificou evidências compatíveis com fogo ou fumaça.",

        model: {
          modelType: "VISUAL",
          name: "fake-visual-model",
          version: "test-1.0.0",
          syntheticData: false
        },

        signals: {
          textUsed: false,
          imageReceived: true,
          imageUsed: true,

          visualLabel: "FIRE_SMOKE",

          candidateCobradeCodes: [
            "1.4.1.3.1",
            "1.4.1.3.2",
            "2.3.1.1.0",
            "2.3.1.2.0"
          ]
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

function mockMultimodalAgreementClassification() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        predictedCobradeCode: "1.2.3.0.0",

        confidence: null,

        visualConfidence: 0.95,

        textConfidence: 0.88,

        ambiguous: false,

        ambiguityReason: null,

        explanationSimple:
          "As evidências visual e textual são semanticamente compatíveis.",

        model: {
          modelType: "MULTIMODAL",
          name: "kamara_semantic_late_fusion",
          version: "v1",
          syntheticData: true
        },

        signals: {
          textUsed: true,
          imageReceived: true,
          imageUsed: true,

          visualResultStatus: "AVAILABLE",
          textResultStatus: "AVAILABLE",

          visualLabel: "FLOOD_WATER",
          textLabel: "COBRADE_1_2_3_0_0",

          fusionCompatibility: "AGREEMENT",

          candidateCobradeCodes: ["1.2.1.0.0", "1.2.2.0.0", "1.2.3.0.0"],

          visualModel: {
            name: "mobilenet_v3_large",
            version: "1.0.0",
            syntheticData: false
          },

          textModel: {
            name: "kamara_bertimbau_v2",
            version: "v2",
            syntheticData: true
          }
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

function mockMultimodalConflictClassification() {
  const ambiguityReason =
    "As evidências visual e textual apontam para famílias de evento semanticamente incompatíveis."

  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        predictedCobradeCode: null,

        confidence: null,

        visualConfidence: 0.97,

        textConfidence: 0.92,

        ambiguous: true,

        ambiguityReason,

        explanationSimple: `${ambiguityReason} Nenhuma categoria COBRADE específica foi escolhida automaticamente.`,

        model: {
          modelType: "MULTIMODAL",
          name: "kamara_semantic_late_fusion",
          version: "v1",
          syntheticData: true
        },

        signals: {
          textUsed: true,
          imageReceived: true,
          imageUsed: true,

          visualResultStatus: "AVAILABLE",
          textResultStatus: "AVAILABLE",

          visualLabel: "FIRE_SMOKE",
          textLabel: "COBRADE_1_2_3_0_0",

          fusionCompatibility: "CONFLICT",

          candidateCobradeCodes: [
            "1.4.1.3.1",
            "1.4.1.3.2",
            "2.3.1.1.0",
            "2.3.1.2.0"
          ],

          visualModel: {
            name: "mobilenet_v3_large",
            version: "1.0.0",
            syntheticData: false
          },

          textModel: {
            name: "kamara_bertimbau_v2",
            version: "v2",
            syntheticData: true
          }
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

function mockLegacyClassificationWithoutMultimodalFields() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        resultStatus: "AVAILABLE",

        predictedCobradeCode: "1.2.3.0.0",

        confidence: 0.84,

        /*
         * Contrato legado propositalmente sem:
         *
         * visualConfidence
         * textConfidence
         * ambiguous
         * ambiguityReason
         */
        explanationSimple: "Resposta legada propositalmente inválida.",

        model: {
          modelType: "TEXTUAL",
          name: "legacy-text-model",
          version: "0.1.0",
          syntheticData: true
        },

        signals: {
          textUsed: true
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Pré-análise de IA", () => {
  it("deve enviar texto e imagem ao serviço de IA e persistir a classificação textual", async () => {
    await ensureFloodCategory()

    const { occurrenceId } = await createOccurrenceWithPhoto(
      "Alagamento causado pela chuva em via pública."
    )

    const fetchMock = mockAvailableTextClassification()

    const classification = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(classification).not.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe("http://localhost:8000/classify")

    expect(options.method).toBe("POST")

    expect(options.body).toBeInstanceOf(FormData)

    const formData = options.body as FormData

    expect(formData.get("occurrence_id")).toBe(occurrenceId)

    expect(formData.get("text")).toBe(
      "Alagamento causado pela chuva em via pública."
    )

    const image = formData.get("image")

    expect(image).toBeInstanceOf(Blob)

    const imageBlob = image as Blob

    expect(imageBlob.type).toBe("image/png")

    expect(imageBlob.size).toBe(testPngBuffer.length)

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

    expect(Number(persisted.confidence)).toBeCloseTo(0.84)

    expect(persisted.visualConfidence).toBeNull()

    expect(Number(persisted.textConfidence)).toBeCloseTo(0.84)

    expect(persisted.ambiguous).toBe(false)

    expect(persisted.ambiguityReason).toBeNull()

    expect(persisted.predictedCategory?.cobradeCode).toBe("1.2.3.0.0")

    expect(persisted.predictedCategory?.name).toBe("Alagamentos")

    expect(persisted.modelVersion.modelType).toBe("TEXTUAL")

    expect(persisted.modelVersion.name).toBe("mock-bertimbau-text")

    expect(persisted.modelVersion.version).toBe("test-v2")

    expect(persisted.modelVersion.syntheticData).toBe(true)
  })

  it("deve persistir a confiança visual separadamente da confiança textual", async () => {
    const { occurrenceId } = await createOccurrenceWithPhoto(
      "Ocorrência usada para testar classificação visual."
    )

    const fetchMock = mockAvailableVisualClassification()

    const classification = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(classification).not.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

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

    expect(Number(persisted.confidence)).toBeCloseTo(0.93)

    expect(Number(persisted.visualConfidence)).toBeCloseTo(0.93)

    expect(persisted.textConfidence).toBeNull()

    expect(persisted.ambiguous).toBe(false)

    expect(persisted.ambiguityReason).toBeNull()

    expect(persisted.predictedCategoryId).toBeNull()

    expect(persisted.predictedCategory).toBeNull()

    expect(persisted.modelVersion.modelType).toBe("VISUAL")

    expect(persisted.modelVersion.name).toBe("fake-visual-model")

    expect(persisted.modelVersion.version).toBe("test-1.0.0")

    expect(persisted.modelVersion.syntheticData).toBe(false)

    expect(persisted.signals).toMatchObject({
      textUsed: false,
      imageReceived: true,
      imageUsed: true,
      visualLabel: "FIRE_SMOKE",

      candidateCobradeCodes: [
        "1.4.1.3.1",
        "1.4.1.3.2",
        "2.3.1.1.0",
        "2.3.1.2.0"
      ],

      predictedCobradeCode: null
    })
  })

  it("deve persistir concordância multimodal preservando os scores das duas modalidades", async () => {
    await ensureFloodCategory()

    const { occurrenceId } = await createOccurrenceWithPhoto(
      "A rua ficou completamente alagada depois da chuva."
    )

    const fetchMock = mockMultimodalAgreementClassification()

    const classification = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(classification).not.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const persisted = await prisma.aIClassification.findUniqueOrThrow({
      where: {
        id: classification!.id
      },

      include: {
        predictedCategory: true,
        modelVersion: true
      }
    })

    expect(persisted.resultStatus).toBe("AVAILABLE")

    /*
     * Não existe score multimodal calibrado
     * nesta versão.
     */
    expect(persisted.confidence).toBeNull()

    expect(Number(persisted.visualConfidence)).toBeCloseTo(0.95)

    expect(Number(persisted.textConfidence)).toBeCloseTo(0.88)

    expect(persisted.ambiguous).toBe(false)

    expect(persisted.ambiguityReason).toBeNull()

    expect(persisted.predictedCategory?.cobradeCode).toBe("1.2.3.0.0")

    expect(persisted.predictedCategory?.name).toBe("Alagamentos")

    expect(persisted.modelVersion.modelType).toBe("MULTIMODAL")

    expect(persisted.modelVersion.name).toBe("kamara_semantic_late_fusion")

    expect(persisted.modelVersion.version).toBe("v1")

    expect(persisted.modelVersion.syntheticData).toBe(true)

    expect(persisted.signals).toMatchObject({
      textUsed: true,
      imageReceived: true,
      imageUsed: true,

      visualResultStatus: "AVAILABLE",
      textResultStatus: "AVAILABLE",

      visualLabel: "FLOOD_WATER",
      textLabel: "COBRADE_1_2_3_0_0",

      fusionCompatibility: "AGREEMENT",

      candidateCobradeCodes: ["1.2.1.0.0", "1.2.2.0.0", "1.2.3.0.0"],

      visualModel: {
        name: "mobilenet_v3_large",
        version: "1.0.0",
        syntheticData: false
      },

      textModel: {
        name: "kamara_bertimbau_v2",
        version: "v2",
        syntheticData: true
      },

      predictedCobradeCode: "1.2.3.0.0"
    })
  })

  it("deve persistir conflito multimodal sem escolher uma categoria automaticamente", async () => {
    const { occurrenceId } = await createOccurrenceWithPhoto(
      "A avenida está completamente alagada depois da chuva."
    )

    const fetchMock = mockMultimodalConflictClassification()

    const classification = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(classification).not.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const persisted = await prisma.aIClassification.findUniqueOrThrow({
      where: {
        id: classification!.id
      },

      include: {
        predictedCategory: true,
        modelVersion: true
      }
    })

    expect(persisted.resultStatus).toBe("AVAILABLE")

    expect(persisted.confidence).toBeNull()

    expect(Number(persisted.visualConfidence)).toBeCloseTo(0.97)

    expect(Number(persisted.textConfidence)).toBeCloseTo(0.92)

    expect(persisted.ambiguous).toBe(true)

    expect(persisted.ambiguityReason).toBe(
      "As evidências visual e textual apontam para famílias de evento semanticamente incompatíveis."
    )

    /*
     * Em conflito semântico não existe
     * escolha automática da COBRADE.
     */
    expect(persisted.predictedCategoryId).toBeNull()

    expect(persisted.predictedCategory).toBeNull()

    expect(persisted.modelVersion.modelType).toBe("MULTIMODAL")

    expect(persisted.modelVersion.name).toBe("kamara_semantic_late_fusion")

    expect(persisted.modelVersion.version).toBe("v1")

    expect(persisted.signals).toMatchObject({
      visualLabel: "FIRE_SMOKE",
      textLabel: "COBRADE_1_2_3_0_0",

      fusionCompatibility: "CONFLICT",

      predictedCobradeCode: null
    })
  })

  it("deve preservar COBRADE desconhecido sem inventar uma categoria", async () => {
    const { occurrenceId } = await createOccurrenceWithPhoto(
      "Ocorrência usada para testar categoria desconhecida."
    )

    mockAvailableTextClassification("9.9.9.9.9")

    const classification = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(classification).not.toBeNull()

    const persisted = await prisma.aIClassification.findUniqueOrThrow({
      where: {
        id: classification!.id
      }
    })

    expect(persisted.predictedCategoryId).toBeNull()

    expect(persisted.signals).toMatchObject({
      predictedCobradeCode: "9.9.9.9.9"
    })

    expect(persisted.visualConfidence).toBeNull()

    expect(Number(persisted.textConfidence)).toBeCloseTo(0.84)
  })

  it("deve rejeitar contrato legado sem os campos multimodais obrigatórios", async () => {
    const { occurrenceId } = await createOccurrenceWithPhoto(
      "Ocorrência usada para testar contrato legado."
    )

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {
        // Erro esperado neste cenário.
      })

    const fetchMock = mockLegacyClassificationWithoutMultimodalFields()

    const result = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    /*
     * O HttpAIService converte violação do
     * contrato em AIServiceUnavailableError,
     * portanto a pré-análise degrada sem
     * bloquear a ocorrência.
     */
    expect(result).toBeNull()

    expect(consoleErrorSpy).toHaveBeenCalled()

    const classificationCount = await prisma.aIClassification.count({
      where: {
        occurrenceId
      }
    })

    expect(classificationCount).toBe(0)
  })

  it("não deve impedir o fluxo quando o serviço de IA estiver indisponível", async () => {
    const { occurrenceId } = await createOccurrenceWithPhoto(
      "Ocorrência usada para testar indisponibilidade da IA."
    )

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {
        // Erro esperado neste cenário.
      })

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connection refused"))
    )

    const result = await preAnalyzeOccurrence({
      occurrenceId
    })

    expect(result).toBeNull()

    expect(consoleErrorSpy).toHaveBeenCalled()

    const classificationCount = await prisma.aIClassification.count({
      where: {
        occurrenceId
      }
    })

    expect(classificationCount).toBe(0)

    const occurrence = await prisma.occurrence.findUniqueOrThrow({
      where: {
        id: occurrenceId
      }
    })

    expect(occurrence.status).toBe("UNDER_REVIEW")
  })
})
