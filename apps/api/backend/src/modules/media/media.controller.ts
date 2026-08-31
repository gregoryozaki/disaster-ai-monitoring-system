import type { NextFunction, Request, Response } from "express"

import { HttpError } from "../../lib/http-error.js"

import { toMediaDto } from "./media.dto.js"

import {
  getMediaContent,
  listCitizenOccurrenceMedia,
  listManagerOccurrenceMedia,
  uploadInitialPhoto
} from "./media.service.js"

export async function uploadInitialPhotoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    if (!req.file) {
      throw new HttpError(400, "Nenhuma imagem foi enviada.", "MEDIA_REQUIRED")
    }

    const media = await uploadInitialPhoto(req.params.id, req.user.id, req.file)

    return res.status(201).json({
      data: toMediaDto(media)
    })
  } catch (error) {
    next(error)
  }
}

export async function listCitizenOccurrenceMediaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const media = await listCitizenOccurrenceMedia(req.params.id, req.user.id)

    return res.json({
      data: media.map(toMediaDto)
    })
  } catch (error) {
    next(error)
  }
}

export async function listManagerOccurrenceMediaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const media = await listManagerOccurrenceMedia(req.params.id)

    return res.json({
      data: media.map(toMediaDto)
    })
  } catch (error) {
    next(error)
  }
}

export async function getMediaContentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new Error("Usuário autenticado não disponível.")
    }

    const result = await getMediaContent(req.params.mediaId, {
      id: req.user.id,
      role: req.user.role
    })

    res.setHeader("Content-Type", result.media.mimeType)

    res.setHeader("Content-Length", result.content.body.length.toString())

    res.setHeader("Cache-Control", "private, max-age=300")

    return res.status(200).send(result.content.body)
  } catch (error) {
    next(error)
  }
}
