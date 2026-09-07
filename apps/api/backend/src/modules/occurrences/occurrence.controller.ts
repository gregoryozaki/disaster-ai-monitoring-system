import type {
  NextFunction,
  Request,
  Response
} from "express"

import { toOccurrenceDto } from "./occurrence.dto.js"

import {
  deleteReporterOccurrence,
  getReporterOccurrenceDetail,
  listReporterOccurrences,
  registerOccurrence,
  updateReporterOccurrence
} from "./occurrence.service.js"

export async function createOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error(
        "Usuário autenticado não disponível."
      )
    }

    const result =
      await registerOccurrence(
        req.user.id,
        req.body
      )

    return res
      .status(result.created ? 201 : 200)
      .json({
        data: toOccurrenceDto(
          result.occurrence
        ),

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
      throw new Error(
        "Usuário autenticado não disponível."
      )
    }

    const occurrences =
      await listReporterOccurrences(
        req.user.id
      )

    return res.json({
      data: occurrences.map(
        toOccurrenceDto
      )
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
      throw new Error(
        "Usuário autenticado não disponível."
      )
    }

    const result =
      await getReporterOccurrenceDetail(
        req.params.id,
        req.user.id
      )

    return res.json({
      data: toOccurrenceDto(
        result.occurrence
      ),

      meta: {
        permissions:
          result.permissions
      }
    })
  } catch (error) {
    next(error)
  }
}

export async function updateOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error(
        "Usuário autenticado não disponível."
      )
    }

    const result =
      await updateReporterOccurrence(
        req.params.id,
        req.user.id,
        req.body
      )

    return res.json({
      data: toOccurrenceDto(
        result.occurrence
      ),

      meta: {
        permissions:
          result.permissions
      }
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteOccurrenceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error(
        "Usuário autenticado não disponível."
      )
    }

    await deleteReporterOccurrence(
      req.params.id,
      req.user.id
    )

    return res.status(204).send()
  } catch (error) {
    next(error)
  }
}
