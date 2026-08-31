import { HttpError } from "../../lib/http-error.js"
import { prisma } from "../../prisma/client.js"

const publicOccurrenceInclude = {
  confirmedCategory: true
} as const

export function listPublicOccurrences() {
  return prisma.occurrence.findMany({
    where: {
      status: "CONFIRMED",
      deletedAt: null
    },

    include: publicOccurrenceInclude,

    orderBy: {
      reportedAt: "desc"
    }
  })
}

export async function getPublicOccurrence(id: string) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id,
      status: "CONFIRMED",
      deletedAt: null
    },

    include: publicOccurrenceInclude
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
