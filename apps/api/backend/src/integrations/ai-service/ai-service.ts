export type AIResultStatus = "AVAILABLE" | "UNAVAILABLE" | "ERROR"

export type AIModelType =
  "VISUAL" | "TEXTUAL" | "MULTIMODAL" | "RISK_PREDICTION"

export interface AIHealthResponse {
  status: string
  service: string
}

export interface AIModelInfo {
  modelType: AIModelType
  name: string
  version: string
  syntheticData: boolean
}

export interface AIImageInput {
  body: Buffer
  contentType: string
  filename?: string
}

export interface AIClassifyInput {
  occurrenceId?: string
  text?: string
  image?: AIImageInput
}

export interface AIClassifyResult {
  resultStatus: AIResultStatus

  predictedCobradeCode: string | null

  confidence: number | null

  visualConfidence: number | null

  textConfidence: number | null

  ambiguous: boolean

  ambiguityReason: string | null

  explanationSimple: string

  model: AIModelInfo

  signals: Record<string, unknown>
}

export type AIDisasterType = "INCENDIO_QUEIMADA" | "INUNDACAO_ALAGAMENTO"

export type AIRiskLevel = "LOW" | "MEDIUM" | "HIGH"

export type AIRiskTrend = "DECREASING" | "STABLE" | "INCREASING" | "UNKNOWN"

export interface AIPredictInput {
  region: string

  disasterType: AIDisasterType

  horizonHours: number
}

export interface AIPredictResult {
  riskLevel: AIRiskLevel

  probability: number

  trend: AIRiskTrend

  factors: string[]

  explanationSimple: string

  synthetic: boolean

  modelVersion: string
}

export interface AIService {
  health(): Promise<AIHealthResponse>

  classify(input: AIClassifyInput): Promise<AIClassifyResult>

  predict(input: AIPredictInput): Promise<AIPredictResult>
}
