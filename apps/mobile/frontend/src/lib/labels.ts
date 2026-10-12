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

/*
 * O mapa público só recebe a hora cheia (UTC) do relato, então mostramos
 * "por volta das 14h" em vez de um horário exato. Dia, hora e minuto saem
 * da mesma formatação para não discordarem em fusos de meia hora.
 */
export function approximateHourLabel(value: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",

    month: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",

    timeZone
  }).formatToParts(new Date(value))

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ""

  const hour = Number(part("hour"))

  const minute = part("minute")

  const time = minute === "00" ? `${hour}h` : `${hour}h${minute}`

  return `${part("day")}/${part("month")}, por volta das ${time}`
}

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto"
}
