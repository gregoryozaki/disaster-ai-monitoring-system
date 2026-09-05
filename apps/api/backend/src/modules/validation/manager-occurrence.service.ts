import type { OccurrenceStatus } from "../../generated/prisma/enums.js"

import { HttpError } from "../../lib/http-error.js"
import { prisma } from "../../prisma/client.js"

import {
  managerOccurrenceDetailInclude,
  managerOccurrenceSummaryInclude
} from "./manager-occurrence.dto.js"

export interface ManagerOccurrenceFilters {
  status?: OccurrenceStatus
  categoryId?: string
  humanRisk?: boolean
  dateFrom?: Date
  dateTo?: Date
}

interface LatestClassificationOccurrenceRow {
  occurrenceId: string
}

async function findOccurrenceIdsByLatestAIClassification(categoryId: string) {
  const rows = await prisma.$queryRaw<LatestClassificationOccurrenceRow[]>`
      SELECT latest."occurrenceId"
      FROM (
        SELECT DISTINCT ON (classification."occurrenceId")
          classification."occurrenceId",
          classification."predictedCategoryId"
        FROM "ai_classifications" AS classification
        ORDER BY
          classification."occurrenceId" ASC,
          classification."createdAt" DESC,
          classification."id" DESC
      ) AS latest
      WHERE latest."predictedCategoryId" = CAST(${categoryId} AS uuid)
    `

  return rows.map((row) => row.occurrenceId)
}

export async function listManagerOccurrences(
  filters: ManagerOccurrenceFilters = {}
) {
  const reportedAtFilter =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom
            ? {
                gte: filters.dateFrom
              }
            : {}),

          ...(filters.dateTo
            ? {
                lte: filters.dateTo
              }
            : {})
        }
      : undefined

  const latestAIClassificationOccurrenceIds = filters.categoryId
    ? await findOccurrenceIdsByLatestAIClassification(filters.categoryId)
    : []

  return prisma.occurrence.findMany({
    where: {
      deletedAt: null,

      ...(filters.status
        ? {
            status: filters.status
          }
        : {}),

      ...(typeof filters.humanRisk === "boolean"
        ? {
            humanRisk: filters.humanRisk
          }
        : {}),

      ...(reportedAtFilter
        ? {
            reportedAt: reportedAtFilter
          }
        : {}),

      ...(filters.categoryId
        ? {
            OR: [
              {
                confirmedCategoryId: filters.categoryId
              },

              {
                confirmedCategoryId: null,

                id: {
                  in: latestAIClassificationOccurrenceIds
                }
              }
            ]
          }
        : {})
    },

    include: managerOccurrenceSummaryInclude,

    orderBy: {
      reportedAt: "desc"
    }
  })
}

export async function getManagerOccurrence(id: string) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id,
      deletedAt: null
    },

    include: managerOccurrenceDetailInclude
  })

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return occurrence
}
