import type { OccurrenceStatus, RiskLevel } from "@kamara/shared-types"

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type LocationSource = "AUTO" | "MANUAL"

export interface ApiUser {
  id: string
  name: string | null
  email: string
  role: "CITIZEN" | "MANAGER" | "ADMIN" | "RESEARCHER"
  status: "INVITED" | "ACTIVE" | "INACTIVE"
}

export interface ApiAdministrativeUser extends ApiUser {
  createdAt: string
  updatedAt: string
  deactivatedAt?: string | null
}

export interface ApiManagerInvite {
  id: string
  email: string
  expiresAt: string
  createdAt: string
}

export interface ApiManagerInviteCreation {
  manager: ApiAdministrativeUser
  invite: ApiManagerInvite
  inviteToken: string
}

export interface ApiAdminCategory extends ApiCategory {
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ApiModelType =
  "VISUAL" | "TEXTUAL" | "MULTIMODAL" | "RISK_PREDICTION"

export interface ApiConfidenceThreshold {
  id: string

  categoryId: string | null

  createdById: string

  modelType: ApiModelType

  lowUpperBound: number

  mediumUpperBound: number

  version: number

  active: boolean

  createdAt: string

  category:
    | (ApiCategory & {
        active: boolean
      })
    | null

  createdBy: {
    id: string
    name: string | null
    email: string
    role: ApiUser["role"]
  }
}

export interface ApiAuditLog {
  id: string

  actorUserId: string | null

  action: string

  entityType: string

  entityId: string

  beforeData: unknown | null

  afterData: unknown | null

  metadata: unknown | null

  createdAt: string

  actorUser: {
    id: string
    name: string | null
    email: string
    role: ApiUser["role"]
  } | null
}

export interface ApiCategory {
  id: string
  cobradeCode: string
  name: string
  groupName: string | null
}

export interface ApiAIClassification {
  id: string

  resultStatus: "AVAILABLE" | "UNAVAILABLE" | "ERROR"

  confidence: number | null

  visualConfidence?: number | null
  textConfidence?: number | null

  ambiguous?: boolean
  ambiguityReason?: string | null

  explanationSimple: string | null

  predictedCategory: ApiCategory | null

  modelVersion?: {
    name: string
    version: string
    modelType: string
    syntheticData: boolean
  }

  createdAt: string
}

export interface ApiOccurrenceComplement {
  id: string
  text: string | null
  createdAt: string
}

export interface ApiInformationRequest {
  id: string

  message: string

  status: "OPEN" | "ANSWERED" | "CANCELLED"

  manager: {
    id: string
    name: string | null
    role: "CITIZEN" | "MANAGER" | "ADMIN" | "RESEARCHER"
  }

  createdAt: string

  answeredAt: string | null

  complement: ApiOccurrenceComplement | null
}

export interface ApiOccurrence {
  id: string

  clientLocalId?: string | null

  description: string | null

  urgency: UrgencyLevel

  humanRisk: boolean

  reportedAt: string

  location?: {
    latitude: number
    longitude: number
    source?: LocationSource
    accuracyM?: number | null
  }

  latitude?: number
  longitude?: number

  locationSource?: LocationSource

  status: OccurrenceStatus

  confirmedCategoryId?: string | null

  confirmedCategory?: ApiCategory | null

  aiClassification?: ApiAIClassification | null

  reporterLabel?: string

  statusHistory?: Array<Record<string, unknown>>

  validations?: Array<Record<string, unknown>>

  informationRequests?: ApiInformationRequest[]

  createdAt: string

  updatedAt: string
}

export interface ApiMedia {
  id: string

  occurrenceId: string

  complementId: string | null

  type: "IMAGE" | "VIDEO" | "AUDIO"

  origin: "INITIAL" | "COMPLEMENT"

  mimeType: string

  sizeBytes: number | null

  durationSec: number | null

  sha256: string | null

  isPrimary: boolean

  createdAt: string

  contentUrl: string
}

export interface ApiPrediction {
  id: string

  regionName: string

  category: ApiCategory

  horizonHours: number

  riskLevel: RiskLevel

  probability: number

  trend: "DECREASING" | "STABLE" | "INCREASING" | "UNKNOWN"

  explanationSimple: string

  synthetic: boolean

  validFrom: string

  sources: string[]

  modelVersion: string
}

export interface ApiExportJob {
  id: string

  requestedById: string

  format: "CSV" | "JSON"

  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED"

  filters: unknown

  anonymized: boolean

  errorMessage: string | null

  createdAt: string

  completedAt: string | null

  contentUrl: string | null
}

export interface AnalyticsSummary {
  total: number

  confirmed: number

  underReview: number

  needsMoreInfo: number

  confirmationRate: number

  byStatus: Record<string, number>

  byCategory: Array<{
    category: ApiCategory
    count: number
  }>
}

export interface ManagerOccurrenceFilters {
  status?: OccurrenceStatus

  categoryId?: string

  humanRisk?: boolean

  dateFrom?: string

  dateTo?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)

    this.name = "ApiError"
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)

  headers.set("x-kamara-client", "DASHBOARD")

  if (!(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,

    credentials: "include",

    headers
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)

    throw new ApiError(
      body?.error?.message ?? "Nao foi possivel concluir a operacao.",

      response.status,

      body?.error?.code
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",

    headers: {
      "x-kamara-client": "DASHBOARD"
    }
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)

    throw new ApiError(
      body?.error?.message ?? "Nao foi possivel carregar a midia.",

      response.status,

      body?.error?.code
    )
  }

  return response.blob()
}

export const api = {
  login(payload: { email: string; password: string }) {
    return requestJson<{
      data: ApiUser
    }>("/api/v1/auth/login", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  logout() {
    return requestJson<void>("/api/v1/auth/logout", {
      method: "POST"
    })
  },

  me() {
    return requestJson<{
      data: ApiUser
    }>("/api/v1/auth/me")
  },

  listAdminManagers() {
    return requestJson<{
      data: ApiAdministrativeUser[]
    }>("/api/v1/admin/managers")
  },

  createManagerInvite(payload: { name: string; email: string }) {
    return requestJson<{
      data: ApiManagerInviteCreation
    }>("/api/v1/admin/managers/invites", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  updateManagerStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    return requestJson<{
      data: ApiAdministrativeUser
    }>(`/api/v1/admin/managers/${id}/status`, {
      method: "PATCH",

      body: JSON.stringify({
        status
      })
    })
  },

  acceptManagerInvite(payload: { token: string; password: string }) {
    return requestJson<{
      data: ApiAdministrativeUser
    }>("/api/v1/auth/manager-invites/accept", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  listManagerOccurrences(filters: ManagerOccurrenceFilters = {}) {
    const query = new URLSearchParams()

    if (filters.status) {
      query.set("status", filters.status)
    }

    if (filters.categoryId) {
      query.set("categoryId", filters.categoryId)
    }

    if (typeof filters.humanRisk === "boolean") {
      query.set("humanRisk", String(filters.humanRisk))
    }

    if (filters.dateFrom) {
      query.set("dateFrom", filters.dateFrom)
    }

    if (filters.dateTo) {
      query.set("dateTo", filters.dateTo)
    }

    const queryString = query.toString()

    return requestJson<{
      data: ApiOccurrence[]
    }>(`/api/v1/manager/occurrences${queryString ? `?${queryString}` : ""}`)
  },

  getManagerOccurrence(id: string) {
    return requestJson<{
      data: ApiOccurrence
    }>(`/api/v1/manager/occurrences/${id}`)
  },

  listOccurrenceMedia(id: string) {
    return requestJson<{
      data: ApiMedia[]
    }>(`/api/v1/manager/occurrences/${id}/media`)
  },

  getMediaContent(path: string) {
    return requestBlob(path)
  },

  listCategories() {
    return requestJson<{
      data: ApiCategory[]
    }>("/api/v1/disaster-categories")
  },

  listAdminCategories() {
    return requestJson<{
      data: ApiAdminCategory[]
    }>("/api/v1/admin/categories")
  },

  updateAdminCategory(
    id: string,
    payload: {
      name?: string
      groupName?: string | null
      active?: boolean
    }
  ) {
    return requestJson<{
      data: ApiAdminCategory
    }>(`/api/v1/admin/categories/${id}`, {
      method: "PATCH",

      body: JSON.stringify(payload)
    })
  },

  listConfidenceThresholds() {
    return requestJson<{
      data: ApiConfidenceThreshold[]
    }>("/api/v1/admin/confidence-thresholds")
  },

  createConfidenceThreshold(payload: {
    categoryId: string
    modelType: ApiModelType
    lowUpperBound: number
    mediumUpperBound: number
  }) {
    return requestJson<{
      data: Omit<ApiConfidenceThreshold, "category" | "createdBy">
    }>("/api/v1/admin/confidence-thresholds", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  listAdminAudit() {
    return requestJson<{
      data: ApiAuditLog[]
    }>("/api/v1/admin/audit")
  },

  validateOccurrence(
    id: string,
    payload:
      | {
          decision: "CONFIRM"
          finalCategoryId: string
          note?: string
        }
      | {
          decision: "CORRECT"
          finalCategoryId: string
          note?: string
        }
      | {
          decision: "REJECT"
          rejectionReason: string
          note?: string
        }
      | {
          decision: "REQUEST_MORE_INFO"
          informationRequestMessage: string
          note?: string
        }
  ) {
    return requestJson<{
      data: {
        occurrence: ApiOccurrence
        informationRequest: unknown
      }
    }>(`/api/v1/manager/occurrences/${id}/validations`, {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  getAnalyticsSummary() {
    return requestJson<{
      data: AnalyticsSummary
    }>("/api/v1/analytics/summary")
  },

  listPredictions() {
    return requestJson<{
      data: ApiPrediction[]
      warning?: string
    }>("/api/v1/predictions")
  },

  generatePrediction(payload: {
    categoryId: string
    regionName: string
    horizonHours: number
  }) {
    return requestJson<{
      data: ApiPrediction
      warning?: string
    }>("/api/v1/predictions/generate", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  requestExport(format: "CSV" | "JSON") {
    return requestJson<{
      data: ApiExportJob
    }>("/api/v1/exports", {
      method: "POST",

      body: JSON.stringify({
        format
      })
    })
  },

  async downloadExport(id: string) {
    const response = await fetch(`${API_URL}/api/v1/exports/${id}/content`, {
      credentials: "include",

      headers: {
        "x-kamara-client": "DASHBOARD"
      }
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)

      throw new ApiError(
        body?.error?.message ?? "Não foi possível baixar a exportação.",

        response.status,

        body?.error?.code
      )
    }

    const disposition = response.headers.get("content-disposition")

    const match = disposition?.match(/filename="([^"]+)"/)

    return {
      blob: await response.blob(),

      filename: match?.[1] ?? `kamara-export-${id}`
    }
  }
}
