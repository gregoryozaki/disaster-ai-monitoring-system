import type { OccurrenceMedia } from "../../generated/prisma/client.js"

export function toMediaDto(media: OccurrenceMedia) {
  return {
    id: media.id,
    occurrenceId: media.occurrenceId,
    complementId: media.complementId,

    type: media.type,
    origin: media.origin,
    mimeType: media.mimeType,

    sizeBytes: media.sizeBytes === null ? null : Number(media.sizeBytes),

    durationSec: media.durationSec,

    sha256: media.sha256,

    isPrimary: media.isPrimary,

    createdAt: media.createdAt,

    contentUrl: `/api/v1/media/${media.id}/content`
  }
}
