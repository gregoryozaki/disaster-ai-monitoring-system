import { randomUUID } from "node:crypto"

import { prisma } from "../../src/prisma/client.js"

interface OccurrencePayload {
  clientLocalId: string
  idempotencyKey: string
  description: string
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  humanRisk: boolean
  latitude: number
  longitude: number
  locationSource: "AUTO" | "MANUAL"
  locationAccuracyM?: number
}

export function buildOccurrencePayload(
  overrides: Partial<OccurrencePayload> = {}
): OccurrencePayload {
  return {
    clientLocalId: `local-${randomUUID()}`,

    idempotencyKey: randomUUID(),

    description: "Alagamento identificado em via pública.",

    urgency: "HIGH",

    humanRisk: true,

    latitude: -3.119027,

    longitude: -60.021731,

    locationSource: "MANUAL",

    ...overrides
  }
}

export async function createTestDisasterCategory() {
  return prisma.disasterCategory.create({
    data: {
      cobradeCode: `TEST-${randomUUID()}`,

      name: "Alagamento de Teste",

      groupName: "Hidrológico",

      active: true
    }
  })
}
