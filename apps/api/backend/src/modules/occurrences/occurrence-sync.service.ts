import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { triggerPreAnalysis } from "../ai-classification/ai-classification.service.js"

import type { SyncOccurrenceInput } from "./occurrence-sync.schema.js"

interface ExistingOccurrenceIdentity {
  reporterId: string

  clientLocalId: string | null

  idempotencyKey: string | null
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function assertOccurrenceCanBeReused(
  occurrence: ExistingOccurrenceIdentity,
  reporterId: string,
  input: SyncOccurrenceInput
) {
  if (occurrence.reporterId !== reporterId) {
    throw new HttpError(
      409,
      "Identificador de sincronização já utilizado por outro usuário.",
      "SYNC_IDENTITY_CONFLICT"
    )
  }

  if (
    occurrence.idempotencyKey === input.idempotencyKey &&
    occurrence.clientLocalId !== null &&
    occurrence.clientLocalId !== input.clientLocalId
  ) {
    throw new HttpError(
      409,
      "A chave de idempotência está associada a outro registro local.",
      "SYNC_IDENTITY_CONFLICT"
    )
  }
}

export async function syncOccurrence(
  reporterId: string,
  input: SyncOccurrenceInput
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.occurrence.findFirst({
        where: {
          OR: [
            {
              idempotencyKey: input.idempotencyKey
            },
            {
              clientLocalId: input.clientLocalId
            }
          ]
        }
      })

      if (existing) {
        assertOccurrenceCanBeReused(existing, reporterId, input)

        return {
          occurrence: existing,
          created: false
        }
      }

      const now = new Date()

      const occurrence = await tx.occurrence.create({
        data: {
          reporterId,

          clientLocalId: input.clientLocalId,

          idempotencyKey: input.idempotencyKey,

          description: input.description,

          urgency: input.urgency,

          humanRisk: input.humanRisk,

          /*
           * Preserva o instante em que o cidadão
           * registrou o relato offline.
           */
          reportedAt: new Date(input.reportedAt),

          latitude: input.latitude,

          longitude: input.longitude,

          locationSource: input.locationSource,

          locationAccuracyM: input.locationAccuracyM,

          status: "UNDER_REVIEW",

          syncedAt: now
        }
      })

      await tx.statusHistory.create({
        data: {
          occurrenceId: occurrence.id,

          fromStatus: "PENDING_SYNC",

          toStatus: "UNDER_REVIEW",

          actorType: "SYSTEM",

          reason: "Ocorrência sincronizada da fila offline."
        }
      })

      return {
        occurrence,
        created: true
      }
    })

    if (result.created) {
      triggerPreAnalysis(result.occurrence.id, "TEXT_ONLY")
    }

    return result
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const existing = await prisma.occurrence.findFirst({
      where: {
        OR: [
          {
            idempotencyKey: input.idempotencyKey
          },
          {
            clientLocalId: input.clientLocalId
          }
        ]
      }
    })

    if (!existing) {
      throw error
    }

    assertOccurrenceCanBeReused(existing, reporterId, input)

    return {
      occurrence: existing,
      created: false
    }
  }
}
