import {
  aiService,
  AIServiceUnavailableError
} from "../../integrations/ai-service/http-ai-service.js"

import type {
  AIDisasterType,
  AIPredictResult
} from "../../integrations/ai-service/ai-service.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import type {
  CreateRiskPredictionInput,
  ListRiskPredictionsQuery
} from "./prediction.schema.js"

function getDisasterType(cobradeCode: string): AIDisasterType {
  if (
    cobradeCode === "1.2.1.0.0" ||
    cobradeCode === "1.2.2.0.0" ||
    cobradeCode === "1.2.3.0.0"
  ) {
    return "INUNDACAO_ALAGAMENTO"
  }

  if (
    cobradeCode === "1.4.1.3.1" ||
    cobradeCode === "1.4.1.3.2" ||
    cobradeCode === "2.3.1.1.0" ||
    cobradeCode === "2.3.1.2.0"
  ) {
    return "INCENDIO_QUEIMADA"
  }

  throw new HttpError(
    422,
    "Categoria fora do escopo da previsão experimental.",
    "CATEGORY_OUTSIDE_PREDICTION_SCOPE"
  )
}

function createRegionKey(regionName: string) {
  const normalized = regionName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "regiao-nao-identificada"
}

function parseModelVersion(raw: string) {
  const separator = raw.lastIndexOf("@")

  if (separator <= 0 || separator === raw.length - 1) {
    return {
      name: raw,
      version: "unspecified"
    }
  }

  return {
    name: raw.slice(0, separator),

    version: raw.slice(separator + 1)
  }
}

function factorsFromJson(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((factor): factor is string => typeof factor === "string")
}

function toPredictionDto(prediction: {
  id: string

  regionKey: string

  regionName: string

  horizonHours: number

  riskLevel: "LOW" | "MEDIUM" | "HIGH"

  probability:
    | {
        toNumber(): number
      }
    | number
    | null

  trend: "DECREASING" | "STABLE" | "INCREASING" | "UNKNOWN"

  factors: unknown

  explanationSimple: string | null

  synthetic: boolean

  validFrom: Date

  validUntil: Date | null

  createdAt: Date

  category: {
    id: string

    cobradeCode: string

    name: string

    groupName: string | null
  }

  modelVersion: {
    name: string

    version: string

    syntheticData: boolean
  }

  sources: Array<{
    source: {
      name: string
    }
  }>
}) {
  const probability =
    prediction.probability === null
      ? null
      : typeof prediction.probability === "number"
        ? prediction.probability
        : prediction.probability.toNumber()

  return {
    id: prediction.id,

    regionKey: prediction.regionKey,

    regionName: prediction.regionName,

    category: prediction.category,

    horizonHours: prediction.horizonHours,

    riskLevel: prediction.riskLevel,

    probability,

    trend: prediction.trend,

    factors: factorsFromJson(prediction.factors),

    explanationSimple: prediction.explanationSimple ?? "",

    synthetic: prediction.synthetic,

    validFrom: prediction.validFrom,

    validUntil: prediction.validUntil,

    createdAt: prediction.createdAt,

    sources: prediction.sources.map((item) => item.source.name),

    modelVersion: `${prediction.modelVersion.name}@${prediction.modelVersion.version}`,

    modelSynthetic: prediction.modelVersion.syntheticData
  }
}

export async function listRiskPredictions(filters: ListRiskPredictionsQuery) {
  const predictions = await prisma.riskPrediction.findMany({
    where: {
      ...(filters.region
        ? {
            regionName: {
              contains: filters.region,

              mode: "insensitive"
            }
          }
        : {}),

      ...(filters.categoryId
        ? {
            categoryId: filters.categoryId
          }
        : {})
    },

    include: {
      category: {
        select: {
          id: true,
          cobradeCode: true,
          name: true,
          groupName: true
        }
      },

      modelVersion: {
        select: {
          name: true,
          version: true,
          syntheticData: true
        }
      },

      sources: {
        include: {
          source: {
            select: {
              name: true
            }
          }
        }
      }
    },

    orderBy: [
      {
        validFrom: "desc"
      },

      {
        createdAt: "desc"
      }
    ]
  })

  return predictions.map(toPredictionDto)
}

async function persistPrediction(
  actorUserId: string,
  category: {
    id: string
    cobradeCode: string
  },
  input: CreateRiskPredictionInput,
  result: AIPredictResult
) {
  const parsedModel = parseModelVersion(result.modelVersion)

  const validFrom = new Date()

  const validUntil = new Date(
    validFrom.getTime() + input.horizonHours * 60 * 60 * 1000
  )

  return prisma.$transaction(async (tx) => {
    let modelVersion = await tx.modelVersion.findFirst({
      where: {
        modelType: "RISK_PREDICTION",

        name: parsedModel.name,

        version: parsedModel.version
      }
    })

    if (!modelVersion) {
      modelVersion = await tx.modelVersion.create({
        data: {
          modelType: "RISK_PREDICTION",

          name: parsedModel.name,

          version: parsedModel.version,

          algorithm: result.synthetic ? "synthetic-rule-baseline" : null,

          active: true,

          syntheticData: result.synthetic
        }
      })
    } else {
      modelVersion = await tx.modelVersion.update({
        where: {
          id: modelVersion.id
        },

        data: {
          active: true,

          syntheticData: result.synthetic,

          algorithm: result.synthetic
            ? "synthetic-rule-baseline"
            : modelVersion.algorithm
        }
      })
    }

    await tx.modelVersion.updateMany({
      where: {
        modelType: "RISK_PREDICTION",

        id: {
          not: modelVersion.id
        },

        active: true
      },

      data: {
        active: false
      }
    })

    const prediction = await tx.riskPrediction.create({
      data: {
        categoryId: category.id,

        modelVersionId: modelVersion.id,

        regionKey: createRegionKey(input.regionName),

        regionName: input.regionName,

        horizonHours: input.horizonHours,

        riskLevel: result.riskLevel,

        probability: result.probability,

        trend: result.trend,

        factors: result.factors,

        explanationSimple: result.explanationSimple,

        synthetic: result.synthetic,

        validFrom,

        validUntil
      },

      include: {
        category: {
          select: {
            id: true,
            cobradeCode: true,
            name: true,
            groupName: true
          }
        },

        modelVersion: {
          select: {
            name: true,
            version: true,
            syntheticData: true
          }
        },

        sources: {
          include: {
            source: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    await tx.auditLog.create({
      data: {
        actorUserId,

        action: "RISK_PREDICTION_GENERATED",

        entityType: "RISK_PREDICTION",

        entityId: prediction.id,

        metadata: {
          categoryId: category.id,

          cobradeCode: category.cobradeCode,

          regionName: input.regionName,

          horizonHours: input.horizonHours,

          synthetic: result.synthetic,

          modelVersion: result.modelVersion
        }
      }
    })

    return toPredictionDto(prediction)
  })
}

export async function generateRiskPrediction(
  actorUserId: string,
  input: CreateRiskPredictionInput
) {
  const category = await prisma.disasterCategory.findFirst({
    where: {
      id: input.categoryId,

      active: true
    },

    select: {
      id: true,

      cobradeCode: true
    }
  })

  if (!category) {
    throw new HttpError(
      422,
      "Categoria inexistente ou inativa.",
      "INVALID_DISASTER_CATEGORY"
    )
  }

  const disasterType = getDisasterType(category.cobradeCode)

  let result: AIPredictResult

  try {
    result = await aiService.predict({
      region: input.regionName,

      disasterType,

      horizonHours: input.horizonHours
    })
  } catch (error) {
    if (error instanceof AIServiceUnavailableError) {
      throw new HttpError(
        503,
        "Serviço de previsão indisponível.",
        "AI_PREDICTION_UNAVAILABLE"
      )
    }

    throw error
  }

  return persistPrediction(actorUserId, category, input, result)
}
