import type {
  DisasterCategory,
  Occurrence
} from "../../generated/prisma/client.js"

type PublicOccurrence = Occurrence & {
  confirmedCategory: DisasterCategory | null
}

interface PublicOccurrenceDtoOptions {
  distanceKm?: number | null
}

const PUBLIC_COORDINATE_DECIMALS = 3

const PUBLIC_DESCRIPTION_MAX_LENGTH = 180

function approximateCoordinate(value: number) {
  return Number(value.toFixed(PUBLIC_COORDINATE_DECIMALS))
}

function summarizeDescription(description: string | null) {
  if (!description) {
    return null
  }

  const normalized = description.trim()

  if (normalized.length <= PUBLIC_DESCRIPTION_MAX_LENGTH) {
    return normalized
  }

  return normalized.slice(0, PUBLIC_DESCRIPTION_MAX_LENGTH - 3) + "..."
}

function approximateDistance(distanceKm: number | null | undefined) {
  if (distanceKm === null || distanceKm === undefined) {
    return null
  }

  return Number(distanceKm.toFixed(2))
}

export function toPublicOccurrenceDto(
  occurrence: PublicOccurrence,

  options: PublicOccurrenceDtoOptions = {}
) {
  return {
    id: occurrence.id,

    description: summarizeDescription(occurrence.description),

    urgency: occurrence.urgency,

    humanRisk: occurrence.humanRisk,

    reportedAt: occurrence.reportedAt,

    location: {
      latitude: approximateCoordinate(Number(occurrence.latitude)),

      longitude: approximateCoordinate(Number(occurrence.longitude)),

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
