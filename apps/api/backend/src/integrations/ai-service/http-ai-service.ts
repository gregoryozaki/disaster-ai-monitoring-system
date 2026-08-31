import { z } from "zod"

import { env } from "../../config/env.js"

import type {
  AIClassifyInput,
  AIClassifyResult,
  AIHealthResponse,
  AIService
} from "./ai-service.js"

const healthResponseSchema = z.object({
  status: z.string(),
  service: z.string()
})

const modelInfoSchema = z.object({
  modelType: z.enum(["VISUAL", "TEXTUAL", "MULTIMODAL", "RISK_PREDICTION"]),

  name: z.string().min(1),

  version: z.string().min(1),

  syntheticData: z.boolean()
})

const classifyResponseSchema = z.object({
  resultStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "ERROR"]),

  predictedCobradeCode: z.string().min(1).nullable(),

  confidence: z.number().min(0).max(1).nullable(),

  explanationSimple: z.string(),

  model: modelInfoSchema,

  signals: z.record(z.unknown())
})

export class AIServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message)

    this.name = "AIServiceUnavailableError"
  }
}

function createAbortSignal(): AbortSignal {
  return AbortSignal.timeout(env.AI_SERVICE_TIMEOUT_MS)
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new AIServiceUnavailableError(
      "O serviço de IA retornou uma resposta inválida."
    )
  }
}

export class HttpAIService implements AIService {
  async health(): Promise<AIHealthResponse> {
    let response: Response

    try {
      response = await fetch(`${env.AI_SERVICE_URL}/health`, {
        method: "GET",

        headers: {
          accept: "application/json"
        },

        signal: createAbortSignal()
      })
    } catch {
      throw new AIServiceUnavailableError(
        "Não foi possível conectar ao serviço de IA."
      )
    }

    if (!response.ok) {
      throw new AIServiceUnavailableError(
        `Serviço de IA respondeu com HTTP ${response.status}.`
      )
    }

    const body = await parseJsonResponse(response)

    const parsed = healthResponseSchema.safeParse(body)

    if (!parsed.success) {
      throw new AIServiceUnavailableError(
        "O serviço de IA retornou um contrato de health inválido."
      )
    }

    return parsed.data
  }

  async classify(input: AIClassifyInput): Promise<AIClassifyResult> {
    const formData = new FormData()

    if (input.occurrenceId) {
      formData.append("occurrence_id", input.occurrenceId)
    }

    if (input.text) {
      formData.append("text", input.text)
    }

    if (input.image) {
      const imageBytes = new Uint8Array(input.image.body)

      const blob = new Blob([imageBytes], {
        type: input.image.contentType
      })

      formData.append("image", blob, input.image.filename ?? "occurrence-image")
    }

    let response: Response

    try {
      response = await fetch(`${env.AI_SERVICE_URL}/classify`, {
        method: "POST",

        headers: {
          accept: "application/json"
        },

        body: formData,

        signal: createAbortSignal()
      })
    } catch {
      throw new AIServiceUnavailableError(
        "Não foi possível conectar ao serviço de IA."
      )
    }

    if (!response.ok) {
      throw new AIServiceUnavailableError(
        `Serviço de IA respondeu com HTTP ${response.status}.`
      )
    }

    const body = await parseJsonResponse(response)

    const parsed = classifyResponseSchema.safeParse(body)

    if (!parsed.success) {
      throw new AIServiceUnavailableError(
        "O serviço de IA retornou um contrato de classificação inválido."
      )
    }

    return parsed.data
  }
}

export const aiService = new HttpAIService()
