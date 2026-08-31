import type {
  DisasterCategory,
  Occurrence
} from "../../generated/prisma/client.js"

type PublicOccurrence = Occurrence & {
  confirmedCategory: DisasterCategory | null
}

export function toPublicOccurrenceDto(occurrence: PublicOccurrence) {
  return {
    id: occurrence.id,

    description: occurrence.description,
    urgency: occurrence.urgency,
    humanRisk: occurrence.humanRisk,

    reportedAt: occurrence.reportedAt,

    location: {
      latitude: Number(occurrence.latitude),
      longitude: Number(occurrence.longitude)
    },

    status: occurrence.status,

    category: occurrence.confirmedCategory
      ? {
          id: occurrence.confirmedCategory.id,
          cobradeCode: occurrence.confirmedCategory.cobradeCode,
          name: occurrence.confirmedCategory.name,
          groupName: occurrence.confirmedCategory.groupName
        }
      : null
  }
}
