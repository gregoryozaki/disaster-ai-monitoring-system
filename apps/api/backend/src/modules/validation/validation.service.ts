import type { OccurrenceStatus } from "../../generated/prisma/enums.js"

import { HttpError } from "../../lib/http-error.js"
import { prisma } from "../../prisma/client.js"

import type { ValidationInput } from "./validation.schema.js"

const reviewableStatuses: OccurrenceStatus[] = ["UNDER_REVIEW"]

function getTargetStatus(
  decision: ValidationInput["decision"]
): OccurrenceStatus {
  switch (decision) {
    case "CONFIRM":
    case "CORRECT":
      return "CONFIRMED"

    case "REJECT":
      return "REJECTED"

    case "REQUEST_MORE_INFO":
      return "NEEDS_MORE_INFO"
  }
}

export async function validateOccurrence(
  occurrenceId: string,
  managerId: string,
  input: ValidationInput
) {
  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.occurrence.findFirst({
      where: {
        id: occurrenceId,
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

    if (!reviewableStatuses.includes(occurrence.status)) {
      throw new HttpError(
        409,
        "Ocorrência não está em um estado que permita validação.",
        "INVALID_OCCURRENCE_STATE"
      )
    }

    let finalCategoryId: string | undefined

    if (input.decision === "CONFIRM" || input.decision === "CORRECT") {
      const category = await tx.disasterCategory.findFirst({
        where: {
          id: input.finalCategoryId,
          active: true
        },

        select: {
          id: true
        }
      })

      if (!category) {
        throw new HttpError(
          422,
          "Categoria de desastre inexistente ou inativa.",
          "INVALID_DISASTER_CATEGORY"
        )
      }

      finalCategoryId = category.id
    }

    const targetStatus = getTargetStatus(input.decision)

    if (input.decision === "REQUEST_MORE_INFO") {
      const openRequest = await tx.informationRequest.findFirst({
        where: {
          occurrenceId: occurrence.id,
          status: "OPEN"
        },

        select: {
          id: true
        }
      })

      if (openRequest) {
        throw new HttpError(
          409,
          "Já existe uma solicitação de informações pendente.",
          "INFORMATION_REQUEST_ALREADY_OPEN"
        )
      }
    }

    const validation = await tx.validation.create({
      data: {
        occurrenceId: occurrence.id,
        managerId,
        decision: input.decision,

        finalCategoryId,

        rejectionReason:
          input.decision === "REJECT" ? input.rejectionReason : undefined,

        note: input.note
      }
    })

    const updateResult = await tx.occurrence.updateMany({
      where: {
        id: occurrence.id,
        status: occurrence.status,
        deletedAt: null
      },

      data: {
        status: targetStatus,

        ...(finalCategoryId
          ? {
              confirmedCategoryId: finalCategoryId
            }
          : {}),

        ...(input.decision === "REJECT"
          ? {
              confirmedCategoryId: null
            }
          : {})
      }
    })

    if (updateResult.count !== 1) {
      throw new HttpError(
        409,
        "A ocorrência foi modificada por outra operação.",
        "OCCURRENCE_CONCURRENT_UPDATE"
      )
    }

    const updatedOccurrence = await tx.occurrence.findUniqueOrThrow({
      where: {
        id: occurrence.id
      }
    })
    const reason =
      input.decision === "REJECT"
        ? input.rejectionReason
        : input.decision === "REQUEST_MORE_INFO"
          ? input.informationRequestMessage
          : (input.note ?? input.decision)

    const history = await tx.statusHistory.create({
      data: {
        occurrenceId: occurrence.id,
        fromStatus: occurrence.status,
        toStatus: targetStatus,
        changedByUserId: managerId,
        actorType: "USER",
        reason
      }
    })

    const informationRequest =
      input.decision === "REQUEST_MORE_INFO"
        ? await tx.informationRequest.create({
            data: {
              occurrenceId: occurrence.id,
              managerId,
              message: input.informationRequestMessage
            }
          })
        : null

    return {
      occurrence: updatedOccurrence,
      validation,
      history,
      informationRequest
    }
  })
}
