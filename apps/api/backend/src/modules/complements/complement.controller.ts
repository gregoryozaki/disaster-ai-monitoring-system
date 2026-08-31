import type { NextFunction, Request, Response } from "express"

import { HttpError } from "../../lib/http-error.js"

import { toMediaDto } from "../media/media.dto.js"

import { toOccurrenceDto } from "../occurrences/occurrence.dto.js"

import { toComplementDto, toInformationRequestDto } from "./complement.dto.js"

import { createComplementSchema } from "./complement.schema.js"

import {
  answerInformationRequest,
  listCitizenInformationRequests
} from "./complement.service.js"

export async function listInformationRequestsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const requests = await listCitizenInformationRequests(
      req.params.id,
      req.user.id
    )

    return res.json({
      data: requests.map(toInformationRequestDto)
    })
  } catch (error) {
    next(error)
  }
}

export async function answerInformationRequestController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const parsed = createComplementSchema.safeParse(req.body)

    if (!parsed.success) {
      throw new HttpError(
        400,
        "Dados do complemento inválidos.",
        "INVALID_COMPLEMENT"
      )
    }

    if (!parsed.data.text && !req.file) {
      throw new HttpError(
        400,
        "Informe um texto ou envie uma foto como complemento.",
        "COMPLEMENT_CONTENT_REQUIRED"
      )
    }

    const result = await answerInformationRequest(
      req.params.id,
      req.params.requestId,
      req.user.id,
      parsed.data,
      req.file
    )

    return res.status(201).json({
      data: {
        complement: toComplementDto(result.complement),

        media: result.media ? toMediaDto(result.media) : null,

        occurrence: toOccurrenceDto(result.occurrence)
      }
    })
  } catch (error) {
    next(error)
  }
}
