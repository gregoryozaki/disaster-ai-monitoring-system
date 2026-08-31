export type UserRole = "CITIZEN" | "MANAGER" | "ADMIN" | "RESEARCHER"
export type OccurrenceStatus =
  | "DRAFT"
  | "PENDING_SYNC"
  | "SYNCED"
  | "UNDER_REVIEW"
  | "NEEDS_MORE_INFO"
  | "CONFIRMED"
  | "REJECTED"
export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type DisasterType = "INCENDIO_QUEIMADA" | "INUNDACAO_ALAGAMENTO"
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH"

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  status: "INVITED" | "ACTIVE" | "INACTIVE"
  createdAt: string
}

export interface DisasterCategory {
  id: string
  cobradeCode: string
  name: string
  type: DisasterType
  active: boolean
}

export interface AIClassification {
  id: string
  occurrenceId: string
  predictedCategoryId: string | null
  confidence: number | null
  explanationSimple: string
  resultStatus: "AVAILABLE" | "UNAVAILABLE" | "ERROR"
  modelVersion: string
  createdAt: string
}

export interface Occurrence {
  id: string
  clientLocalId?: string
  idempotencyKey?: string
  reporterId: string
  confirmedCategoryId?: string
  description: string
  urgency: UrgencyLevel
  humanRisk: boolean
  reportedAt: string
  latitude: number
  longitude: number
  locationSource: "AUTO" | "MANUAL"
  status: OccurrenceStatus
  syncedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Validation {
  id: string
  occurrenceId: string
  managerId: string
  decision: "CONFIRM" | "REJECT" | "CORRECT" | "REQUEST_MORE_INFO"
  finalCategoryId?: string
  rejectionReason?: string
  note?: string
  createdAt: string
}

export interface StatusHistory {
  id: string
  occurrenceId: string
  fromStatus?: OccurrenceStatus
  toStatus: OccurrenceStatus
  changedByUserId?: string
  actorType: "USER" | "SYSTEM"
  reason?: string
  createdAt: string
}

export interface RiskPrediction {
  id: string
  categoryId: string
  regionKey: string
  regionName: string
  horizonHours: number
  riskLevel: RiskLevel
  probability: number
  trend: "DECREASING" | "STABLE" | "INCREASING" | "UNKNOWN"
  explanationSimple: string
  synthetic: boolean
  validFrom: string
  modelVersion: string
  sources: string[]
}
