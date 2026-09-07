import type { OccurrenceStatus, RiskLevel } from "@kamara/shared-types"

import type { UrgencyLevel } from "./api"

export const statusLabels: Record<OccurrenceStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_SYNC: "Aguardando envio",
  SYNCED: "Enviada",
  UNDER_REVIEW: "Em análise",
  NEEDS_MORE_INFO: "Precisamos de mais informações",
  CONFIRMED: "Confirmada",
  REJECTED: "Não confirmada"
}

export const urgencyLabels: Record<UrgencyLevel, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica"
}

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto"
}
