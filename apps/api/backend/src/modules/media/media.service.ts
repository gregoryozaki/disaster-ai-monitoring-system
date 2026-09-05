import { randomUUID } from "node:crypto"

import type { UserRole } from "../../generated/prisma/enums.js"

import { objectStorage } from "../../integrations/storage/s3-storage.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { triggerPreAnalysis } from "../ai-classification/ai-classification.service.js"

import { inspectPhoto } from "./media-image.js"

interface MediaViewer {
  id: string
  role: UserRole
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export async function uploadInitialPhoto(
  occurrenceId: string,
  citizenId: string,
  file: Express.Multer.File
) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id: occurrenceId,

      reporterId: citizenId,

      deletedAt: null
    },

    select: {
      id: true,

      status: true
    }
  })

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  if (occurrence.status !== "UNDER_REVIEW") {
    throw new HttpError(
      409,
      "Não é possível adicionar mídia inicial neste estado da ocorrência.",
      "INVALID_OCCURRENCE_STATE"
    )
  }

  const existingPrimaryPhoto = await prisma.occurrenceMedia.findFirst({
    where: {
      occurrenceId: occurrence.id,

      type: "IMAGE",

      isPrimary: true
    },

    select: {
      id: true
    }
  })

  if (existingPrimaryPhoto) {
    throw new HttpError(
      409,
      "A ocorrência já possui uma foto principal.",
      "PRIMARY_PHOTO_ALREADY_EXISTS"
    )
  }

  const inspected = await inspectPhoto(file)

  const storageRef =
    `occurrences/${occurrence.id}/initial/` +
    `${randomUUID()}.${inspected.extension}`

  const storedObject = await objectStorage.put({
    key: storageRef,

    body: file.buffer,

    contentType: inspected.mimeType
  })

  try {
    const media = await prisma.occurrenceMedia.create({
      data: {
        occurrenceId: occurrence.id,

        type: "IMAGE",

        origin: "INITIAL",

        mimeType: inspected.mimeType,

        storageRef: storedObject.storageRef,

        sizeBytes: BigInt(file.size),

        sha256: inspected.sha256,

        isPrimary: true
      }
    })

    triggerPreAnalysis(occurrence.id, "LATEST_EVIDENCE")

    return media
  } catch (error) {
    try {
      await objectStorage.delete(storedObject.storageRef)
    } catch (cleanupError) {
      console.error("Falha ao remover mídia órfã do storage:", cleanupError)
    }

    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        409,
        "A ocorrência já possui uma foto principal.",
        "PRIMARY_PHOTO_ALREADY_EXISTS"
      )
    }

    throw error
  }
}

export async function listCitizenOccurrenceMedia(
  occurrenceId: string,
  citizenId: string
) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id: occurrenceId,

      reporterId: citizenId,

      deletedAt: null
    },

    select: {
      id: true
    }
  })

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return prisma.occurrenceMedia.findMany({
    where: {
      occurrenceId: occurrence.id
    },

    orderBy: {
      createdAt: "asc"
    }
  })
}

export async function listManagerOccurrenceMedia(occurrenceId: string) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id: occurrenceId,

      deletedAt: null
    },

    select: {
      id: true
    }
  })

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return prisma.occurrenceMedia.findMany({
    where: {
      occurrenceId: occurrence.id
    },

    orderBy: {
      createdAt: "asc"
    }
  })
}

export async function getMediaContent(mediaId: string, viewer: MediaViewer) {
  const media = await prisma.occurrenceMedia.findUnique({
    where: {
      id: mediaId
    },

    include: {
      occurrence: {
        select: {
          reporterId: true,

          deletedAt: true
        }
      }
    }
  })

  if (!media || media.occurrence.deletedAt !== null) {
    throw new HttpError(404, "Mídia não encontrada.", "MEDIA_NOT_FOUND")
  }

  if (viewer.role === "CITIZEN") {
    if (media.occurrence.reporterId !== viewer.id) {
      throw new HttpError(404, "Mídia não encontrada.", "MEDIA_NOT_FOUND")
    }
  } else if (viewer.role !== "MANAGER" && viewer.role !== "ADMIN") {
    throw new HttpError(403, "Permissão insuficiente.", "FORBIDDEN")
  }

  const content = await objectStorage.get(media.storageRef)

  return {
    media,
    content
  }
}
