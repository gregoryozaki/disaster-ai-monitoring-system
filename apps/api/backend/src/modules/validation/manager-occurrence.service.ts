import type { OccurrenceStatus } from "../../generated/prisma/enums.js"

import { HttpError } from "../../lib/http-error.js"
import { prisma } from "../../prisma/client.js"

export async function listManagerOccurrences(status?: OccurrenceStatus) {
  return prisma.occurrence.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {})
    },

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
    }
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
