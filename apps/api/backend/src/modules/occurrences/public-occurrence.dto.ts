import type {
  DisasterCategory,
  Occurrence
} from "../../generated/prisma/client.js"

import { toPublicCoordinate } from "./public-location.js"

type PublicOccurrence = Occurrence & {
  confirmedCategory: DisasterCategory | null
}

interface PublicOccurrenceDtoOptions {
  distanceKm?: number | null
}

function approximateDistance(distanceKm: number | null | undefined) {
  if (distanceKm === null || distanceKm === undefined) {
    return null
  }

  return Number(distanceKm.toFixed(1))
}

// Só a hora cheia: o minuto exato ajudaria a identificar quem relatou.
export function approximateReportedAt(reportedAt: Date) {
  const hour = new Date(reportedAt)

  hour.setUTCMinutes(0, 0, 0)

  return hour
}

export function toPublicOccurrenceDto(
  occurrence: PublicOccurrence,

  options: PublicOccurrenceDtoOptions = {}
) {
  /*
   * A descrição é texto livre do cidadão e pode ter nome, endereço ou
   * telefone. Por isso ela não sai na projeção pública.
   */
  return {
    id: occurrence.id,

    urgency: occurrence.urgency,

    humanRisk: occurrence.humanRisk,

    reportedAt: approximateReportedAt(occurrence.reportedAt),

    location: {
      latitude: toPublicCoordinate(Number(occurrence.latitude)),

      longitude: toPublicCoordinate(Number(occurrence.longitude)),

      approximate: true
    },

    distanceKm: approximateDistance(options.distanceKm),

    status: occurrence.status,

    category: occurrence.confirmedCategory
      ? {
          id: occurrence.confirmedCategory.id,

          cobradeCode: occurrence.confirmedCategory.cobradeCode,

          name: occurrence.confirmedCategory.name,

          groupName: occurrence.confirmedCategory.groupName
        }
      : null,

    validation: {
      confirmed: true
    }
  }
}
