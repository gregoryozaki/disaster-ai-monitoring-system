import type { NextFunction, Request, Response } from "express"

import { HttpError } from "../../lib/http-error.js"

import { toOccurrenceDto } from "./occurrence.dto.js"

import { syncOccurrence } from "./occurrence-sync.service.js"

export async function syncOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const idempotencyHeader = req.get("Idempotency-Key")?.trim()

    if (!idempotencyHeader) {
      throw new HttpError(
        400,
        "O cabeçalho Idempotency-Key é obrigatório na sincronização.",
        "IDEMPOTENCY_KEY_REQUIRED"
      )
    }

    if (idempotencyHeader !== req.body.idempotencyKey) {
      throw new HttpError(
        400,
        "O cabeçalho Idempotency-Key não corresponde ao payload.",
        "IDEMPOTENCY_KEY_MISMATCH"
      )
    }

    const result = await syncOccurrence(req.user.id, req.body)

    return res.status(result.created ? 201 : 200).json({
      data: toOccurrenceDto(result.occurrence),

      meta: {
        created: result.created,

        synchronized: true
      }
    })
  } catch (error) {
    next(error)
  }
}
