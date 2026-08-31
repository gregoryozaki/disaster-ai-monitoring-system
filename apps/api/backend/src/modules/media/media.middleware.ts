import type { NextFunction, Request, Response } from "express"

import multer from "multer"

import { HttpError } from "../../lib/http-error.js"

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 1,
    fileSize: MAX_PHOTO_SIZE_BYTES
  }
}).single("file")

export function uploadSinglePhoto(
  req: Request,
  res: Response,
  next: NextFunction
) {
  upload(req, res, (error) => {
    if (!error) {
      return next()
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new HttpError(
            413,
            "A imagem excede o limite de 10 MB.",
            "MEDIA_TOO_LARGE"
          )
        )
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new HttpError(
            400,
            'Envie a imagem no campo "file".',
            "INVALID_MEDIA_FIELD"
          )
        )
      }

      return next(
        new HttpError(400, "Upload de mídia inválido.", "INVALID_MEDIA_UPLOAD")
      )
    }

    return next(error)
  })
}
