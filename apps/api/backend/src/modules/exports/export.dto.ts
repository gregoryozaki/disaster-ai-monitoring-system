import type { ExportJob } from "../../generated/prisma/client.js"

export function toExportJobDto(job: ExportJob) {
  return {
    id: job.id,

    requestedById: job.requestedById,

    format: job.format,

    status: job.status,

    filters: job.filters,

    anonymized: job.anonymized,

    errorMessage: job.errorMessage,

    createdAt: job.createdAt,

    completedAt: job.completedAt,

    contentUrl:
      job.status === "READY" ? `/api/v1/exports/${job.id}/content` : null
  }
}
