import { HttpError } from "../../lib/http-error.js"

import { triggerPreAnalysis } from "../ai-classification/ai-classification.service.js"

import type { CreateOccurrenceInput } from "./occurrence.schema.js"

import {
  createOccurrence,
  findOccurrenceByIdAndReporter,
  findOccurrenceByIdempotencyKey,
  findOccurrencesByReporter
} from "./occurrence.repository.js"

export async function registerOccurrence(
  reporterId: string,
  input: CreateOccurrenceInput
) {
  if (input.idempotencyKey) {
    const existing = await findOccurrenceByIdempotencyKey(input.idempotencyKey)

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

  const occurrence = await createOccurrence(reporterId, input)

  triggerPreAnalysis(occurrence.id, "TEXT_ONLY")

  return {
    occurrence,
    created: true
  }
}

export function listReporterOccurrences(reporterId: string) {
  return findOccurrencesByReporter(reporterId)
}

export async function getReporterOccurrence(id: string, reporterId: string) {
  const occurrence = await findOccurrenceByIdAndReporter(id, reporterId)

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return occurrence
}
