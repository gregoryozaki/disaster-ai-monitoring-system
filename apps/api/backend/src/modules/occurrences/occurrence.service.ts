import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { triggerPreAnalysis } from "../ai-classification/ai-classification.service.js"

import type {
  CreateOccurrenceInput,
  UpdateOccurrenceInput
} from "./occurrence.schema.js"

import {
  createOccurrence,
  findOccurrenceByIdAndReporter,
  findOccurrenceByIdempotencyKey,
  findOccurrencesByReporter
} from "./occurrence.repository.js"

export interface OccurrencePermissions {
  canEdit: boolean
  canDelete: boolean
}

interface OccurrenceInterventionState {
  status: string

  _count: {
    validations: number
    informationRequests: number
  }
}

function occurrenceAuditSnapshot(occurrence: {
  description: string | null
  urgency: string
  humanRisk: boolean
  latitude: unknown
  longitude: unknown
  locationSource: string
  locationAccuracyM: unknown | null
  status: string
  deletedAt: Date | null
  updatedAt: Date
}) {
  return {
    description: occurrence.description,

    urgency: occurrence.urgency,

    humanRisk: occurrence.humanRisk,

    latitude: Number(occurrence.latitude),

    longitude: Number(occurrence.longitude),

    locationSource: occurrence.locationSource,

    locationAccuracyM:
      occurrence.locationAccuracyM === null
        ? null
        : Number(occurrence.locationAccuracyM),

    status: occurrence.status,

    deletedAt:
      occurrence.deletedAt === null
        ? null
        : occurrence.deletedAt.toISOString(),

    updatedAt: occurrence.updatedAt.toISOString()
  }
}

function hasManagerIntervention(
  occurrence: OccurrenceInterventionState
) {
  return (
    occurrence._count.validations > 0 ||
    occurrence._count.informationRequests > 0
  )
}

export function getOccurrencePermissions(
  occurrence: OccurrenceInterventionState
): OccurrencePermissions {
  const mutable =
    occurrence.status === "UNDER_REVIEW" &&
    !hasManagerIntervention(occurrence)

  return {
    canEdit: mutable,
    canDelete: mutable
  }
}

function assertOccurrenceCanBeChanged(
  occurrence: OccurrenceInterventionState
) {
  const permissions = getOccurrencePermissions(occurrence)

  if (!permissions.canEdit || !permissions.canDelete) {
    throw new HttpError(
      409,
      "A ocorrência não pode mais ser alterada porque a análise já foi iniciada ou o registro foi encerrado.",
      "OCCURRENCE_LOCKED"
    )
  }
}

async function findReporterOccurrenceState(
  id: string,
  reporterId: string
) {
  return prisma.occurrence.findFirst({
    where: {
      id,
      reporterId,
      deletedAt: null
    },

    include: {
      _count: {
        select: {
          validations: true,
          informationRequests: true
        }
      }
    }
  })
}

export async function registerOccurrence(
  reporterId: string,
  input: CreateOccurrenceInput
) {
  if (input.idempotencyKey) {
    const existing = await findOccurrenceByIdempotencyKey(
      input.idempotencyKey
    )

    if (existing) {
      if (existing.reporterId !== reporterId) {
        throw new HttpError(
          409,
          "Chave de idempotência já utilizada.",
          "IDEMPOTENCY_KEY_CONFLICT"
        )
      }

      return {
        occurrence: existing,
        created: false
      }
    }
  }

  const occurrence = await createOccurrence(
    reporterId,
    input
  )

  triggerPreAnalysis(
    occurrence.id,
    "TEXT_ONLY"
  )

  return {
    occurrence,
    created: true
  }
}

export function listReporterOccurrences(
  reporterId: string
) {
  return findOccurrencesByReporter(reporterId)
}

export async function getReporterOccurrence(
  id: string,
  reporterId: string
) {
  const occurrence =
    await findOccurrenceByIdAndReporter(
      id,
      reporterId
    )

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return occurrence
}

export async function getReporterOccurrenceDetail(
  id: string,
  reporterId: string
) {
  const occurrence =
    await findReporterOccurrenceState(
      id,
      reporterId
    )

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return {
    occurrence,

    permissions:
      getOccurrencePermissions(occurrence)
  }
}

export async function updateReporterOccurrence(
  id: string,
  reporterId: string,
  input: UpdateOccurrenceInput
) {
  await prisma.$transaction(async (tx) => {
    const occurrence =
      await tx.occurrence.findFirst({
        where: {
          id,
          reporterId,
          deletedAt: null
        },

        include: {
          _count: {
            select: {
              validations: true,
              informationRequests: true
            }
          }
        }
      })

    if (!occurrence) {
      throw new HttpError(
        404,
        "Ocorrência não encontrada.",
        "OCCURRENCE_NOT_FOUND"
      )
    }

    assertOccurrenceCanBeChanged(occurrence)

    const beforeData =
      occurrenceAuditSnapshot(occurrence)

    const updateResult =
      await tx.occurrence.updateMany({
        where: {
          id: occurrence.id,

          reporterId,

          deletedAt: null,

          status: "UNDER_REVIEW",

          validations: {
            none: {}
          },

          informationRequests: {
            none: {}
          }
        },

        data: {
          ...(input.description !== undefined
            ? {
                description: input.description
              }
            : {}),

          ...(input.urgency !== undefined
            ? {
                urgency: input.urgency
              }
            : {}),

          ...(input.humanRisk !== undefined
            ? {
                humanRisk: input.humanRisk
              }
            : {}),

          ...(input.latitude !== undefined
            ? {
                latitude: input.latitude
              }
            : {}),

          ...(input.longitude !== undefined
            ? {
                longitude: input.longitude
              }
            : {}),

          ...(input.locationSource !== undefined
            ? {
                locationSource:
                  input.locationSource
              }
            : {}),

          ...(input.locationAccuracyM !== undefined
            ? {
                locationAccuracyM:
                  input.locationAccuracyM
              }
            : {})
        }
      })

    if (updateResult.count !== 1) {
      throw new HttpError(
        409,
        "A ocorrência não pode mais ser alterada porque a análise já foi iniciada.",
        "OCCURRENCE_LOCKED"
      )
    }

    const updated =
      await tx.occurrence.findUniqueOrThrow({
        where: {
          id: occurrence.id
        }
      })

    await tx.auditLog.create({
      data: {
        actorUserId: reporterId,

        action:
          "CITIZEN_OCCURRENCE_UPDATED",

        entityType: "OCCURRENCE",

        entityId: occurrence.id,

        beforeData,

        afterData:
          occurrenceAuditSnapshot(updated)
      }
    })
  })

  /*
   * O conteúdo original mudou.
   *
   * A análise anterior não deve ser considerada
   * suficiente para o conteúdo novo. Disparamos
   * uma nova análise usando a evidência disponível.
   */
  triggerPreAnalysis(
    id,
    "LATEST_EVIDENCE"
  )

  return getReporterOccurrenceDetail(
    id,
    reporterId
  )
}

export async function deleteReporterOccurrence(
  id: string,
  reporterId: string
) {
  await prisma.$transaction(async (tx) => {
    const occurrence =
      await tx.occurrence.findFirst({
        where: {
          id,
          reporterId,
          deletedAt: null
        },

        include: {
          _count: {
            select: {
              validations: true,
              informationRequests: true
            }
          }
        }
      })

    if (!occurrence) {
      throw new HttpError(
        404,
        "Ocorrência não encontrada.",
        "OCCURRENCE_NOT_FOUND"
      )
    }

    assertOccurrenceCanBeChanged(occurrence)

    const beforeData =
      occurrenceAuditSnapshot(occurrence)

    const deletedAt = new Date()

    const deleteResult =
      await tx.occurrence.updateMany({
        where: {
          id: occurrence.id,

          reporterId,

          deletedAt: null,

          status: "UNDER_REVIEW",

          validations: {
            none: {}
          },

          informationRequests: {
            none: {}
          }
        },

        data: {
          deletedAt
        }
      })

    if (deleteResult.count !== 1) {
      throw new HttpError(
        409,
        "A ocorrência não pode mais ser cancelada porque a análise já foi iniciada.",
        "OCCURRENCE_LOCKED"
      )
    }

    const updated =
      await tx.occurrence.findUniqueOrThrow({
        where: {
          id: occurrence.id
        }
      })

    await tx.auditLog.create({
      data: {
        actorUserId: reporterId,

        action:
          "CITIZEN_OCCURRENCE_DELETED",

        entityType: "OCCURRENCE",

        entityId: occurrence.id,

        beforeData,

        afterData:
          occurrenceAuditSnapshot(updated)
      }
    })
  })
}
