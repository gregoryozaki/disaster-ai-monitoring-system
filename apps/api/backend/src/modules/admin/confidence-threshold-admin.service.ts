import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import type { CreateConfidenceThresholdInput } from "./admin.schema.js"

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export function listConfidenceThresholds() {
  return prisma.confidenceThreshold.findMany({
    include: {
      category: {
        select: {
          id: true,
          cobradeCode: true,
          name: true,
          groupName: true,
          active: true
        }
      },

      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },

    orderBy: [
      {
        createdAt: "desc"
      },
      {
        version: "desc"
      }
    ]
  })
}

export async function createConfidenceThreshold(
  adminId: string,
  input: CreateConfidenceThresholdInput
) {
  if (input.lowUpperBound >= input.mediumUpperBound) {
    throw new HttpError(
      400,
      "Faixas de confiança inválidas.",
      "INVALID_THRESHOLDS"
    )
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.disasterCategory.findFirst({
        where: {
          id: input.categoryId,
          active: true
        },

        select: {
          id: true,
          cobradeCode: true,
          name: true
        }
      })

      if (!category) {
        throw new HttpError(
          422,
          "Categoria de desastre inexistente ou inativa.",
          "INVALID_DISASTER_CATEGORY"
        )
      }

      const latest = await tx.confidenceThreshold.findFirst({
        where: {
          categoryId: category.id,

          modelType: input.modelType
        },

        orderBy: {
          version: "desc"
        },

        select: {
          version: true
        }
      })

      await tx.confidenceThreshold.updateMany({
        where: {
          categoryId: category.id,

          modelType: input.modelType,

          active: true
        },

        data: {
          active: false
        }
      })

      const version = (latest?.version ?? 0) + 1

      const threshold = await tx.confidenceThreshold.create({
        data: {
          categoryId: category.id,

          createdById: adminId,

          modelType: input.modelType,

          lowUpperBound: input.lowUpperBound,

          mediumUpperBound: input.mediumUpperBound,

          version,

          active: true
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,

          action: "THRESHOLD_VERSIONED",

          entityType: "CONFIDENCE_THRESHOLD",

          entityId: threshold.id,

          afterData: {
            categoryId: category.id,

            cobradeCode: category.cobradeCode,

            modelType: threshold.modelType,

            lowUpperBound: Number(threshold.lowUpperBound),

            mediumUpperBound: Number(threshold.mediumUpperBound),

            version: threshold.version,

            active: threshold.active
          }
        }
      })

      return threshold
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        409,
        "Conflito ao versionar o limiar de confiança. Tente novamente.",
        "THRESHOLD_VERSION_CONFLICT"
      )
    }

    throw error
  }
}
