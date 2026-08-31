import { createHash } from "node:crypto"

import { fileTypeFromBuffer } from "file-type"

import { HttpError } from "../../lib/http-error.js"

const supportedImageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const

export interface InspectedPhoto {
  mimeType: keyof typeof supportedImageTypes
  extension: string
  sha256: string
}

export async function inspectPhoto(
  file: Express.Multer.File
): Promise<InspectedPhoto> {
  const detectedType = await fileTypeFromBuffer(file.buffer)

  if (!detectedType || !(detectedType.mime in supportedImageTypes)) {
    throw new HttpError(
      415,
      "Formato de imagem não suportado. Utilize JPEG, PNG ou WebP.",
      "UNSUPPORTED_MEDIA_TYPE"
    )
  }

  const mimeType = detectedType.mime as keyof typeof supportedImageTypes

  const extension = supportedImageTypes[mimeType]

  const sha256 = createHash("sha256").update(file.buffer).digest("hex")

  return {
    mimeType,
    extension,
    sha256
  }
}
