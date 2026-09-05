import { afterEach, describe, expect, it, vi } from "vitest"

import { aiService } from "../../src/integrations/ai-service/http-ai-service.js"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedAdmin } from "../helpers/auth.js"

describe("Previsões persistentes", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("deve gerar previsão sintética via serviço de IA e persistir no PostgreSQL", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: "1.2.3.0.0"
      },

      update: {
        name: "Alagamentos",

        groupName: "NATURAIS - Hidrológico",

        active: true
      },

      create: {
        cobradeCode: "1.2.3.0.0",

        name: "Alagamentos",

        groupName: "NATURAIS - Hidrológico",

        active: true
      }
    })

    const predictSpy = vi.spyOn(aiService, "predict").mockResolvedValue({
      riskLevel: "HIGH",

      probability: 0.78,

      trend: "INCREASING",

      factors: [
        "cenário sintético de demonstração",
        "regra fixa por família de desastre",
        "sem dados ambientais reais"
      ],

      explanationSimple: "Estimativa sintética experimental.",

      synthetic: true,

      modelVersion: "kamara_synthetic_risk_baseline@0.1.0"
    })

    const response = await admin.agent
      .post("/api/v1/predictions/generate")
      .send({
        categoryId: category.id,

        regionName: "Manaus - AM / Centro-Sul",

        horizonHours: 48
      })

    expect(response.status).toBe(201)

    expect(predictSpy).toHaveBeenCalledWith({
      region: "Manaus - AM / Centro-Sul",

      disasterType: "INUNDACAO_ALAGAMENTO",

      horizonHours: 48
    })

    expect(response.body.data).toMatchObject({
      regionName: "Manaus - AM / Centro-Sul",

      horizonHours: 48,

      riskLevel: "HIGH",

      probability: 0.78,

      trend: "INCREASING",

      synthetic: true,

      modelVersion: "kamara_synthetic_risk_baseline@0.1.0"
    })

    const stored = await prisma.riskPrediction.findUniqueOrThrow({
      where: {
        id: response.body.data.id
      },

      include: {
        modelVersion: true,

        sources: true
      }
    })

    expect(stored.synthetic).toBe(true)

    expect(stored.modelVersion.modelType).toBe("RISK_PREDICTION")

    expect(stored.modelVersion.syntheticData).toBe(true)

    expect(stored.modelVersion.name).toBe("kamara_synthetic_risk_baseline")

    expect(stored.sources).toHaveLength(0)

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "RISK_PREDICTION_GENERATED",

        entityId: stored.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("deve listar previsões persistidas com categoria e modelo", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: "2.3.1.2.0"
      },

      update: {
        name: "Incêndios em aglomerados residenciais",

        groupName: "TECNOLÓGICOS - Incêndios urbanos",

        active: true
      },

      create: {
        cobradeCode: "2.3.1.2.0",

        name: "Incêndios em aglomerados residenciais",

        groupName: "TECNOLÓGICOS - Incêndios urbanos",

        active: true
      }
    })

    vi.spyOn(aiService, "predict").mockResolvedValue({
      riskLevel: "MEDIUM",

      probability: 0.57,

      trend: "STABLE",

      factors: ["cenário sintético"],

      explanationSimple: "Estimativa sintética.",

      synthetic: true,

      modelVersion: "kamara_synthetic_risk_baseline@0.1.0"
    })

    const created = await admin.agent
      .post("/api/v1/predictions/generate")
      .send({
        categoryId: category.id,

        regionName: "Manaus - AM / Zona Norte",

        horizonHours: 24
      })

    expect(created.status).toBe(201)

    const response = await admin.agent.get(
      `/api/v1/predictions?categoryId=${category.id}&region=Zona%20Norte`
    )

    expect(response.status).toBe(200)

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.data.id,

          synthetic: true,

          sources: [],

          category: expect.objectContaining({
            id: category.id,

            cobradeCode: "2.3.1.2.0"
          })
        })
      ])
    )

    expect(response.body.warning).toContain("experimentais")
  })

  it("não deve gerar previsão para categoria inativa", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.create({
      data: {
        cobradeCode: `TEST-PRED-${Date.now()}`,

        name: "Categoria inativa para previsão",

        groupName: "TESTES",

        active: false
      }
    })

    const response = await admin.agent
      .post("/api/v1/predictions/generate")
      .send({
        categoryId: category.id,

        regionName: "Manaus",

        horizonHours: 48
      })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("INVALID_DISASTER_CATEGORY")
  })
})
