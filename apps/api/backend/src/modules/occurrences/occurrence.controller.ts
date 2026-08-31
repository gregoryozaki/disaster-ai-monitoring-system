import type { NextFunction, Request, Response } from "express"

import { toOccurrenceDto } from "./occurrence.dto.js"

import {
  getReporterOccurrence,
  listReporterOccurrences,
  registerOccurrence
} from "./occurrence.service.js"

export async function createOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const result = await registerOccurrence(req.user.id, req.body)

    res.status(result.created ? 201 : 200).json({
      data: toOccurrenceDto(result.occurrence),
      meta: {
        created: result.created
      }
    })
  } catch (error) {
    next(error)
  }
}

export async function listOccurrencesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const occurrences = await listReporterOccurrences(req.user.id)

    res.json({
      data: occurrences.map(toOccurrenceDto)
    })
  } catch (error) {
    next(error)
  }
}

export async function getOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const occurrence = await getReporterOccurrence(req.params.id, req.user.id)

    res.json({
      data: toOccurrenceDto(occurrence)
    })
  } catch (error) {
    next(error)
  }
}
