import type {
  AIModelType,
  AIResultStatus
} from "../../integrations/ai-service/ai-service.js"

import {
  AIServiceUnavailableError,
  aiService
} from "../../integrations/ai-service/http-ai-service.js"

import { objectStorage } from "../../integrations/storage/s3-storage.js"

import { prisma } from "../../prisma/client.js"

interface PreAnalyzeOccurrenceInput {
  occurrenceId: string
}

interface PersistClassificationInput {
  occurrenceId: string

  resultStatus: AIResultStatus

  predictedCobradeCode: string | null

  confidence: number | null

  visualConfidence: number | null

  textConfidence: number | null

  ambiguous: boolean

  ambiguityReason: string | null

  explanationSimple: string

  signals: Record<string, unknown>

  model: {
    modelType: AIModelType
    name: string
    version: string
    syntheticData: boolean
  }
}

async function persistClassification(input: PersistClassificationInput) {
  const modelVersion = await prisma.modelVersion.upsert({
    where: {
      modelType_name_version: {
        modelType: input.model.modelType,

        name: input.model.name,

        version: input.model.version
      }
    },

    update: {
      syntheticData: input.model.syntheticData,

      active: true
    },

    create: {
      modelType: input.model.modelType,

      name: input.model.name,

      version: input.model.version,

      syntheticData: input.model.syntheticData,

      active: true
    }
  })

  let predictedCategoryId: string | null = null

  if (input.predictedCobradeCode) {
    const predictedCategory = await prisma.disasterCategory.findUnique({
      where: {
        cobradeCode: input.predictedCobradeCode
      },

      select: {
        id: true,

        active: true
      }
    })

    if (predictedCategory && predictedCategory.active) {
      predictedCategoryId = predictedCategory.id
    }
  }

  const signals = {
    ...input.signals,

    predictedCobradeCode: input.predictedCobradeCode
  }

  return prisma.aIClassification.create({
    data: {
      occurrenceId: input.occurrenceId,

      modelVersionId: modelVersion.id,

      predictedCategoryId,

      resultStatus: input.resultStatus,

      confidence: input.confidence,

      visualConfidence: input.visualConfidence,

      textConfidence: input.textConfidence,

      ambiguous: input.ambiguous,

      ambiguityReason: input.ambiguityReason,

      explanationSimple: input.explanationSimple,

      signals
    },

    include: {
      modelVersion: true,

      predictedCategory: {
        select: {
          id: true,

          cobradeCode: true,

          name: true,

          groupName: true
        }
      }
    }
  })
}

export async function preAnalyzeOccurrence(input: PreAnalyzeOccurrenceInput) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id: input.occurrenceId,

      deletedAt: null,

      status: "UNDER_REVIEW"
    },

    select: {
      id: true,

      description: true,

      media: {
        where: {
          type: "IMAGE",

          isPrimary: true
        },

        orderBy: {
          createdAt: "desc"
        },

        take: 1,

        select: {
          storageRef: true,

          mimeType: true
        }
      }
    }
  })

  if (!occurrence) {
    return null
  }

  const primaryImage = occurrence.media[0]

  let image:
    | {
        body: Buffer
        contentType: string
        filename: string
      }
    | undefined

  if (primaryImage) {
    try {
      const storedImage = await objectStorage.get(primaryImage.storageRef)

      image = {
        body: storedImage.body,

        contentType: primaryImage.mimeType,

        filename: "occurrence-image"
      }
    } catch (error) {
      console.error(
        `Não foi possível recuperar a imagem da ocorrência ${occurrence.id} para pré-análise:`,
        error
      )

      return null
    }
  }

  try {
    const result = await aiService.classify({
      occurrenceId: occurrence.id,

      text: occurrence.description ?? undefined,

      image
    })

    return await persistClassification({
      occurrenceId: occurrence.id,

      resultStatus: result.resultStatus,

      predictedCobradeCode: result.predictedCobradeCode,

      confidence: result.confidence,

      visualConfidence: result.visualConfidence,

      textConfidence: result.textConfidence,

      ambiguous: result.ambiguous,

      ambiguityReason: result.ambiguityReason,

      explanationSimple: result.explanationSimple,

      signals: result.signals,

      model: result.model
    })
  } catch (error) {
    if (error instanceof AIServiceUnavailableError) {
      console.error(
        `Pré-análise indisponível para ocorrência ${occurrence.id}:`,
        error.message
      )

      return null
    }

    throw error
  }
}
