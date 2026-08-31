import { prisma } from "../../prisma/client.js"
import type { CreateOccurrenceInput } from "./occurrence.schema.js"

export function findOccurrenceByIdempotencyKey(idempotencyKey: string) {
  return prisma.occurrence.findUnique({
    where: {
      idempotencyKey
    }
  })
}

export function createOccurrence(
  reporterId: string,
  input: CreateOccurrenceInput
) {
  return prisma.occurrence.create({
    data: {
      reporterId,

      clientLocalId: input.clientLocalId,
      idempotencyKey: input.idempotencyKey,

      description: input.description,
      urgency: input.urgency,
      humanRisk: input.humanRisk,

      latitude: input.latitude,
      longitude: input.longitude,

      locationSource: input.locationSource,
      locationAccuracyM: input.locationAccuracyM
    }
  })
}

export function findOccurrencesByReporter(reporterId: string) {
  return prisma.occurrence.findMany({
    where: {
      reporterId,
      deletedAt: null
    },

    orderBy: {
      reportedAt: "desc"
    }
  })
}

export function findOccurrenceByIdAndReporter(id: string, reporterId: string) {
  return prisma.occurrence.findFirst({
    where: {
      id,
      reporterId,
      deletedAt: null
    }
  })
}
