import bcrypt from "bcryptjs"
import type {
  AIClassification,
  DisasterCategory,
  Occurrence,
  RiskPrediction,
  StatusHistory,
  User,
  Validation
} from "../domain/types.js"
import { createId, nowIso } from "../lib/id.js"

const passwordHash = bcrypt.hashSync("kamara123", 10)

export const categories: DisasterCategory[] = [
  {
    id: "cat-fire",
    cobradeCode: "1.4.1.3.1",
    name: "Incendio/Queimada",
    type: "INCENDIO_QUEIMADA",
    active: true
  },
  {
    id: "cat-flood",
    cobradeCode: "1.2.1.0.0",
    name: "Inundacao/Alagamento",
    type: "INUNDACAO_ALAGAMENTO",
    active: true
  }
]

export const users: User[] = [
  {
    id: "usr-citizen",
    name: "Cidadao Demo",
    email: "cidadao@kamara.local",
    passwordHash,
    role: "CITIZEN",
    status: "ACTIVE",
    createdAt: nowIso()
  },
  {
    id: "usr-manager",
    name: "Gestor Demo",
    email: "gestor@kamara.local",
    passwordHash,
    role: "MANAGER",
    status: "ACTIVE",
    createdAt: nowIso()
  },
  {
    id: "usr-admin",
    name: "Admin Demo",
    email: "admin@kamara.local",
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: nowIso()
  }
]

export const occurrences: Occurrence[] = [
  {
    id: "occ-001",
    reporterId: "usr-citizen",
    description:
      "Foco de queimada com fumaca escura proximo a area de vegetacao urbana.",
    urgency: "HIGH",
    humanRisk: false,
    reportedAt: "2026-08-26T09:30:00-04:00",
    latitude: -3.1038,
    longitude: -60.0251,
    locationSource: "AUTO",
    status: "UNDER_REVIEW",
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: "occ-002",
    reporterId: "usr-citizen",
    confirmedCategoryId: "cat-flood",
    description:
      "Rua alagada apos chuva intensa, com passagem de veiculos comprometida.",
    urgency: "CRITICAL",
    humanRisk: true,
    reportedAt: "2026-08-26T08:10:00-04:00",
    latitude: -3.0921,
    longitude: -60.0345,
    locationSource: "MANUAL",
    status: "CONFIRMED",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
]

export const aiClassifications: AIClassification[] = [
  {
    id: "aic-001",
    occurrenceId: "occ-001",
    predictedCategoryId: "cat-fire",
    confidence: 0.86,
    explanationSimple:
      "A pre-analise encontrou sinais visuais compativeis com fumaca e fogo. A decisao ainda depende de validacao humana.",
    resultStatus: "AVAILABLE",
    modelVersion: "visual-fire-flood@0.1.0",
    createdAt: nowIso()
  },
  {
    id: "aic-002",
    occurrenceId: "occ-002",
    predictedCategoryId: "cat-flood",
    confidence: 0.91,
    explanationSimple:
      "Imagem e descricao indicam acumulacao de agua em via urbana. Registro confirmado por gestor.",
    resultStatus: "AVAILABLE",
    modelVersion: "multimodal-flood@0.1.0",
    createdAt: nowIso()
  }
]

export const validations: Validation[] = []
export const statusHistory: StatusHistory[] = occurrences.map((occurrence) => ({
  id: createId("sth"),
  occurrenceId: occurrence.id,
  toStatus: occurrence.status,
  actorType: "SYSTEM",
  reason: "Carga inicial do prototipo",
  createdAt: nowIso()
}))

export const predictions: RiskPrediction[] = [
  {
    id: "pred-001",
    categoryId: "cat-flood",
    regionKey: "manaus-centro-sul",
    regionName: "Manaus - AM / Zona Centro-Sul",
    horizonHours: 48,
    riskLevel: "HIGH",
    probability: 0.78,
    trend: "INCREASING",
    explanationSimple:
      "Risco elevado por acumulado de chuva recente, historico de alagamentos e previsao de novas precipitacoes.",
    synthetic: true,
    validFrom: nowIso(),
    modelVersion: "risk-rf@0.1.0",
    sources: [
      "chuva sintetica",
      "historico simulado",
      "ocorrencias confirmadas"
    ]
  },
  {
    id: "pred-002",
    categoryId: "cat-fire",
    regionKey: "manaus-norte",
    regionName: "Manaus - AM / Zona Norte",
    horizonHours: 48,
    riskLevel: "MEDIUM",
    probability: 0.57,
    trend: "STABLE",
    explanationSimple:
      "Risco moderado associado a baixa umidade simulada e registros recentes sob analise.",
    synthetic: true,
    validFrom: nowIso(),
    modelVersion: "risk-rf@0.1.0",
    sources: ["clima sintetico", "historico simulado"]
  }
]

export const auditLogs: Array<Record<string, unknown>> = []

export function toOccurrenceDto(occurrence: Occurrence) {
  const reporter = users.find((user) => user.id === occurrence.reporterId)
  const confirmedCategory =
    categories.find(
      (category) => category.id === occurrence.confirmedCategoryId
    ) ?? null
  const latestAi = [...aiClassifications]
    .filter((item) => item.occurrenceId === occurrence.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const aiClassification = latestAi
    ? {
        ...latestAi,
        predictedCategory:
          categories.find(
            (category) => category.id === latestAi.predictedCategoryId
          ) ?? null
      }
    : null

  return {
    ...occurrence,
    reporterLabel:
      reporter?.role === "CITIZEN" ? "Cidadao autenticado" : "Usuario",
    confirmedCategory,
    aiClassification,
    statusHistory: statusHistory.filter(
      (item) => item.occurrenceId === occurrence.id
    ),
    validations: validations.filter(
      (item) => item.occurrenceId === occurrence.id
    )
  }
}
