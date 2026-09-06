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

export interface ApiCategory {
  id: string

  cobradeCode: string

  name: string

  groupName: string | null
}

export interface ApiOccurrence {
  id: string

  clientLocalId?: string | null

  description: string | null

  urgency: UrgencyLevel

  humanRisk: boolean

  reportedAt: string

  location: {
    latitude: number

    longitude: number

    source?: LocationSource

    accuracyM?: number | null
  }

  status: OccurrenceStatus

  confirmedCategoryId?: string | null

  syncedAt?: string | null

  createdAt: string

  updatedAt: string
}

export interface ApiPublicOccurrence {
  id: string

  description: string | null

  urgency: UrgencyLevel

  humanRisk: boolean

  reportedAt: string

  location: {
    latitude: number

    longitude: number

    approximate: boolean
  }

  distanceKm: number | null

  status: OccurrenceStatus

  category: ApiCategory | null

  validation: {
    confirmed: boolean
  }
}

export interface ApiPublicOccurrenceMeta {
  center: {
    latitude: number

    longitude: number
  } | null

  radiusKm: number | null

  count: number
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

export interface ApiInformationRequest {
  id: string

  message: string

  status: "OPEN" | "ANSWERED" | "CANCELLED"

  createdAt: string

  answeredAt: string | null
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

export interface SyncOccurrencePayload {
  clientLocalId: string

  idempotencyKey: string

  description: string

  urgency: UrgencyLevel

  humanRisk: boolean

  latitude: number

  longitude: number

  locationSource: LocationSource

  locationAccuracyM?: number

  reportedAt: string
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

export class ApiNetworkError extends Error {
  constructor(message = "Sem conexao com o servidor.") {
    super(message)

    this.name = "ApiNetworkError"
  }
}

export function isApiNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response

  const headers = new Headers(init.headers)

  headers.set("x-kamara-client", "CITIZEN_PWA")

  if (!(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,

      credentials: "include",

      headers
    })
  } catch {
    throw new ApiNetworkError()
  }

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

export const api = {
  registerCitizen(payload: {
    name: string

    email: string

    password: string
  }) {
    return requestJson<{
      data: ApiUser
    }>("/api/v1/auth/register", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  login(payload: {
    email: string

    password: string
  }) {
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

  listPublicOccurrences(filters?: {
    latitude: number

    longitude: number

    radiusKm?: number

    limit?: number
  }) {
    const params = new URLSearchParams()

    if (filters) {
      params.set("lat", String(filters.latitude))

      params.set("lon", String(filters.longitude))

      if (filters.radiusKm !== undefined) {
        params.set("radiusKm", String(filters.radiusKm))
      }

      if (filters.limit !== undefined) {
        params.set("limit", String(filters.limit))
      }
    }

    const query = params.toString()

    return requestJson<{
      data: ApiPublicOccurrence[]

      meta: ApiPublicOccurrenceMeta
    }>(`/api/v1/public/occurrences${query ? `?${query}` : ""}`)
  },

  listCitizenOccurrences() {
    return requestJson<{
      data: ApiOccurrence[]
    }>("/api/v1/occurrences")
  },

  createOccurrence(payload: {
    clientLocalId: string

    idempotencyKey: string

    description: string

    urgency: UrgencyLevel

    humanRisk: boolean

    latitude: number

    longitude: number

    locationSource: LocationSource

    locationAccuracyM?: number
  }) {
    return requestJson<{
      data: ApiOccurrence

      meta: {
        created: boolean
      }
    }>("/api/v1/occurrences", {
      method: "POST",

      body: JSON.stringify(payload)
    })
  },

  syncOccurrence(payload: SyncOccurrencePayload) {
    return requestJson<{
      data: ApiOccurrence

      meta: {
        created: boolean

        synchronized: boolean
      }
    }>("/api/v1/occurrences/sync", {
      method: "POST",

      headers: {
        "Idempotency-Key": payload.idempotencyKey
      },

      body: JSON.stringify(payload)
    })
  },

  uploadInitialPhoto(occurrenceId: string, file: File) {
    const form = new FormData()

    form.append("file", file)

    return requestJson<{
      data: ApiMedia
    }>(`/api/v1/occurrences/${occurrenceId}/media`, {
      method: "POST",

      body: form
    })
  },

  listOccurrenceMedia(occurrenceId: string) {
    return requestJson<{
      data: ApiMedia[]
    }>(`/api/v1/occurrences/${occurrenceId}/media`)
  },

  listInformationRequests(occurrenceId: string) {
    return requestJson<{
      data: ApiInformationRequest[]
    }>(`/api/v1/occurrences/${occurrenceId}/information-requests`)
  },

  answerInformationRequest(
    occurrenceId: string,
    requestId: string,
    payload: {
      text?: string

      file?: File
    }
  ) {
    const form = new FormData()

    if (payload.text) {
      form.append("text", payload.text)
    }

    if (payload.file) {
      form.append("file", payload.file)
    }

    return requestJson<{
      data: {
        occurrence: ApiOccurrence

        media: ApiMedia | null
      }
    }>(
      `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`,
      {
        method: "POST",

        body: form
      }
    )
  },

  listPredictions() {
    return requestJson<{
      data: ApiPrediction[]

      warning?: string
    }>("/api/v1/predictions")
  }
}
