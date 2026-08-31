import type { Occurrence } from "../../generated/prisma/client.js"

export function toOccurrenceDto(occurrence: Occurrence) {
  return {
    id: occurrence.id,
    clientLocalId: occurrence.clientLocalId,

    description: occurrence.description,
    urgency: occurrence.urgency,
    humanRisk: occurrence.humanRisk,

    reportedAt: occurrence.reportedAt,

    location: {
      latitude: Number(occurrence.latitude),
      longitude: Number(occurrence.longitude),
      source: occurrence.locationSource,
      accuracyM:
        occurrence.locationAccuracyM === null
          ? null
          : Number(occurrence.locationAccuracyM)
    },

    status: occurrence.status,
    confirmedCategoryId: occurrence.confirmedCategoryId,

    syncedAt: occurrence.syncedAt,
    createdAt: occurrence.createdAt,
    updatedAt: occurrence.updatedAt
  }
}
