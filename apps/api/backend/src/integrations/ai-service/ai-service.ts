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

  explanationSimple: string

  model: AIModelInfo

  signals: Record<string, unknown>
}

export interface AIService {
  health(): Promise<AIHealthResponse>

  classify(input: AIClassifyInput): Promise<AIClassifyResult>
}
