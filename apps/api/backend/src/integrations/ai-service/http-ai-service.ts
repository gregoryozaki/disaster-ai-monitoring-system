import { z } from "zod"

import { env } from "../../config/env.js"

import type {
  AIClassifyInput,
  AIClassifyResult,
  AIHealthResponse,
  AIPredictInput,
  AIPredictResult,
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

const nullableConfidenceSchema = z.number().min(0).max(1).nullable()

const classifyResponseSchema = z
  .object({
    resultStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "ERROR"]),

    predictedCobradeCode: z.string().min(1).nullable(),

    confidence: nullableConfidenceSchema,

    visualConfidence: nullableConfidenceSchema,

    textConfidence: nullableConfidenceSchema,

    ambiguous: z.boolean(),

    ambiguityReason: z.string().min(1).nullable(),

    explanationSimple: z.string(),

    model: modelInfoSchema,

    signals: z.record(z.unknown())
  })
  .superRefine((value, ctx) => {
    if (value.ambiguous && value.ambiguityReason === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,

        path: ["ambiguityReason"],

        message: "Uma classificação ambígua deve informar ambiguityReason."
      })
    }

    if (!value.ambiguous && value.ambiguityReason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,

        path: ["ambiguityReason"],

        message:
          "Uma classificação não ambígua deve possuir ambiguityReason nulo."
      })
    }

    if (value.model.modelType === "MULTIMODAL") {
      if (value.confidence !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,

          path: ["confidence"],

          message:
            "Classificação MULTIMODAL não possui confidence global nesta versão."
        })
      }

      if (value.visualConfidence === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,

          path: ["visualConfidence"],

          message: "Classificação MULTIMODAL deve preservar visualConfidence."
        })
      }

      if (value.textConfidence === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,

          path: ["textConfidence"],

          message: "Classificação MULTIMODAL deve preservar textConfidence."
        })
      }
    }

    if (
      value.model.modelType === "VISUAL" &&
      value.resultStatus === "AVAILABLE"
    ) {
      if (value.visualConfidence === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,

          path: ["visualConfidence"],

          message:
            "Classificação VISUAL disponível deve preservar visualConfidence."
        })
      }
    }

    if (
      value.model.modelType === "TEXTUAL" &&
      value.resultStatus === "AVAILABLE"
    ) {
      if (value.textConfidence === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,

          path: ["textConfidence"],

          message:
            "Classificação TEXTUAL disponível deve preservar textConfidence."
        })
      }
    }
  })

const predictionResponseSchema = z
  .object({
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),

    probability: z.number().min(0).max(1),

    trend: z.enum(["DECREASING", "STABLE", "INCREASING", "UNKNOWN"]),

    factors: z.array(z.string().min(1)),

    explanationSimple: z.string().min(1),

    synthetic: z.boolean(),

    modelVersion: z.string().min(1)
  })
  .strict()

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

  async predict(input: AIPredictInput): Promise<AIPredictResult> {
    let response: Response

    try {
      response = await fetch(`${env.AI_SERVICE_URL}/predict`, {
        method: "POST",

        headers: {
          accept: "application/json",

          "content-type": "application/json"
        },

        body: JSON.stringify({
          region: input.region,

          disaster_type: input.disasterType,

          horizon_hours: input.horizonHours
        }),

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

    const parsed = predictionResponseSchema.safeParse(body)

    if (!parsed.success) {
      throw new AIServiceUnavailableError(
        "O serviço de IA retornou um contrato de previsão inválido."
      )
    }

    return parsed.data
  }
}

export const aiService = new HttpAIService()
