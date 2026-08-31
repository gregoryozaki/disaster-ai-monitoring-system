import type { NextFunction, Request, Response } from "express"

import { toOccurrenceDto } from "../occurrences/occurrence.dto.js"

import { validateOccurrence } from "./validation.service.js"

export async function validateOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const result = await validateOccurrence(
      req.params.id,
      req.user.id,
      req.body
    )

    return res.status(201).json({
      data: {
        occurrence: toOccurrenceDto(result.occurrence),

        validation: {
          id: result.validation.id,
          decision: result.validation.decision,

          finalCategoryId: result.validation.finalCategoryId,

          rejectionReason: result.validation.rejectionReason,

          note: result.validation.note,
          createdAt: result.validation.createdAt
        },

        informationRequest: result.informationRequest
          ? {
              id: result.informationRequest.id,
              message: result.informationRequest.message,
              status: result.informationRequest.status,
              createdAt: result.informationRequest.createdAt
            }
          : null
      }
    })
  } catch (error) {
    next(error)
  }
}
