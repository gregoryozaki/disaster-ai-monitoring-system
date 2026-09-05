import type { Prisma } from "../../generated/prisma/client.js"

export const managerOccurrenceSummaryInclude = {
  confirmedCategory: true,

  aiClassifications: {
    orderBy: [
      {
        createdAt: "desc"
      },

      {
        id: "desc"
      }
    ],

    take: 1,

    include: {
      predictedCategory: true,
      modelVersion: true
    }
  }
} satisfies Prisma.OccurrenceInclude

export const managerOccurrenceDetailInclude = {
  ...managerOccurrenceSummaryInclude,

  reporter: {
    select: {
      id: true,
      name: true
    }
  },

  statusHistory: {
    orderBy: {
      createdAt: "asc"
    },

    include: {
      changedByUser: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  },

  validations: {
    orderBy: {
      createdAt: "asc"
    },

    include: {
      manager: {
        select: {
          id: true,
          name: true,
          role: true
        }
      },

      finalCategory: true
    }
  },

  informationRequests: {
    orderBy: {
      createdAt: "asc"
    },

    include: {
      manager: {
        select: {
          id: true,
          name: true,
          role: true
        }
      },

      complements: {
        orderBy: {
          createdAt: "asc"
        },

        select: {
          id: true,
          text: true,
          createdAt: true
        }
      }
    }
  }
} satisfies Prisma.OccurrenceInclude

type ManagerOccurrenceSummary = Prisma.OccurrenceGetPayload<{
  include: typeof managerOccurrenceSummaryInclude
}>

type ManagerOccurrenceDetail = Prisma.OccurrenceGetPayload<{
  include: typeof managerOccurrenceDetailInclude
}>

function toCategoryDto(
  category: ManagerOccurrenceSummary["confirmedCategory"]
) {
  if (!category) {
    return null
  }

  return {
    id: category.id,
    cobradeCode: category.cobradeCode,
    name: category.name,
    groupName: category.groupName
  }
}

function toAIClassificationDto(
  classification: ManagerOccurrenceSummary["aiClassifications"][number]
) {
  return {
    id: classification.id,

    resultStatus: classification.resultStatus,

    confidence:
      classification.confidence === null
        ? null
        : Number(classification.confidence),

    visualConfidence:
      classification.visualConfidence === null
        ? null
        : Number(classification.visualConfidence),

    textConfidence:
      classification.textConfidence === null
        ? null
        : Number(classification.textConfidence),

    ambiguous: classification.ambiguous,

    ambiguityReason: classification.ambiguityReason,

    explanationSimple: classification.explanationSimple,

    predictedCategory: toCategoryDto(classification.predictedCategory),

    modelVersion: {
      name: classification.modelVersion.name,
      version: classification.modelVersion.version,
      modelType: classification.modelVersion.modelType,
      syntheticData: classification.modelVersion.syntheticData
    },

    signals: classification.signals,

    createdAt: classification.createdAt
  }
}

export function toManagerOccurrenceSummaryDto(
  occurrence: ManagerOccurrenceSummary
) {
  const latestClassification = occurrence.aiClassifications[0] ?? null

  return {
    id: occurrence.id,

    clientLocalId: occurrence.clientLocalId,

    description: occurrence.description,
    urgency: occurrence.urgency,
    humanRisk: occurrence.humanRisk,

    reportedAt: occurrence.reportedAt,

    location: {
      latitude: Number(occurrence.latitude),
      longitude: Number(occurrence.longitude),

      source: occurrence.locationSource,

      accuracyM:
        occurrence.locationAccuracyM === null
          ? null
          : Number(occurrence.locationAccuracyM)
    },

    status: occurrence.status,

    confirmedCategoryId: occurrence.confirmedCategoryId,

    confirmedCategory: toCategoryDto(occurrence.confirmedCategory),

    aiClassification:
      latestClassification === null
        ? null
        : toAIClassificationDto(latestClassification),

    syncedAt: occurrence.syncedAt,
    createdAt: occurrence.createdAt,
    updatedAt: occurrence.updatedAt
  }
}

export function toManagerOccurrenceDetailDto(
  occurrence: ManagerOccurrenceDetail
) {
  return {
    ...toManagerOccurrenceSummaryDto(occurrence),

    reporterLabel:
      occurrence.reporter.name ??
      `Cidadão ${occurrence.reporter.id.slice(0, 8)}`,

    statusHistory: occurrence.statusHistory.map((history) => ({
      id: history.id,

      fromStatus: history.fromStatus,
      toStatus: history.toStatus,

      actorType: history.actorType,
      reason: history.reason,

      changedByUser:
        history.changedByUser === null
          ? null
          : {
              id: history.changedByUser.id,
              name: history.changedByUser.name,
              role: history.changedByUser.role
            },

      createdAt: history.createdAt
    })),

    validations: occurrence.validations.map((validation) => ({
      id: validation.id,

      decision: validation.decision,

      finalCategoryId: validation.finalCategoryId,

      finalCategory: toCategoryDto(validation.finalCategory),

      rejectionReason: validation.rejectionReason,

      note: validation.note,

      manager: {
        id: validation.manager.id,
        name: validation.manager.name,
        role: validation.manager.role
      },

      createdAt: validation.createdAt
    })),

    informationRequests: occurrence.informationRequests.map((request) => {
      const complement = request.complements[0] ?? null

      return {
        id: request.id,

        message: request.message,

        status: request.status,

        manager: {
          id: request.manager.id,
          name: request.manager.name,
          role: request.manager.role
        },

        createdAt: request.createdAt,

        answeredAt: request.answeredAt,

        complement:
          complement === null
            ? null
            : {
                id: complement.id,
                text: complement.text,
                createdAt: complement.createdAt
              }
      }
    })
  }
}
