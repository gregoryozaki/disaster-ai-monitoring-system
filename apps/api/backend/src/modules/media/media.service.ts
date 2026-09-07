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

interface MutableOccurrenceState {
  id: string

  status: string

  _count: {
    validations: number
    informationRequests: number
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function assertInitialEvidenceMutable(occurrence: MutableOccurrenceState) {
  if (
    occurrence.status !== "UNDER_REVIEW" ||
    occurrence._count.validations > 0 ||
    occurrence._count.informationRequests > 0
  ) {
    throw new HttpError(
      409,
      "Não é possível alterar a evidência inicial depois que a análise do gestor começou.",
      "OCCURRENCE_LOCKED"
    )
  }
}

async function findMutableOccurrence(occurrenceId: string, citizenId: string) {
  return prisma.occurrence.findFirst({
    where: {
      id: occurrenceId,

      reporterId: citizenId,

      deletedAt: null
    },

    select: {
      id: true,

      status: true,

      _count: {
        select: {
          validations: true,

          informationRequests: true
        }
      }
    }
  })
}

export async function uploadInitialPhoto(
  occurrenceId: string,
  citizenId: string,
  file: Express.Multer.File
) {
  const occurrence = await findMutableOccurrence(occurrenceId, citizenId)

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  assertInitialEvidenceMutable(occurrence)

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
    const media = await prisma.$transaction(async (tx) => {
      /*
       * A regra é verificada novamente
       * dentro da transação para reduzir
       * a janela entre leitura e escrita.
       */
      const current = await tx.occurrence.findFirst({
        where: {
          id: occurrence.id,

          reporterId: citizenId,

          deletedAt: null
        },

        select: {
          id: true,

          status: true,

          _count: {
            select: {
              validations: true,

              informationRequests: true
            }
          }
        }
      })

      if (!current) {
        throw new HttpError(
          404,
          "Ocorrência não encontrada.",
          "OCCURRENCE_NOT_FOUND"
        )
      }

      assertInitialEvidenceMutable(current)

      const duplicate = await tx.occurrenceMedia.findFirst({
        where: {
          occurrenceId: current.id,

          type: "IMAGE",

          isPrimary: true
        },

        select: {
          id: true
        }
      })

      if (duplicate) {
        throw new HttpError(
          409,
          "A ocorrência já possui uma foto principal.",
          "PRIMARY_PHOTO_ALREADY_EXISTS"
        )
      }

      const created = await tx.occurrenceMedia.create({
        data: {
          occurrenceId: current.id,

          type: "IMAGE",

          origin: "INITIAL",

          mimeType: inspected.mimeType,

          storageRef: storedObject.storageRef,

          sizeBytes: BigInt(file.size),

          sha256: inspected.sha256,

          isPrimary: true
        }
      })

      /*
       * Mudança na evidência também altera
       * a versão lógica da ocorrência.
       *
       * Isso invalida qualquer inferência
       * LATEST_EVIDENCE que tenha começado
       * antes desta foto existir.
       */
      await tx.occurrence.update({
        where: {
          id: current.id
        },

        data: {
          updatedAt: new Date()
        }
      })

      return created
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

export async function replaceInitialPhoto(
  occurrenceId: string,
  citizenId: string,
  file: Express.Multer.File
) {
  const occurrence = await findMutableOccurrence(occurrenceId, citizenId)

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  assertInitialEvidenceMutable(occurrence)

  const inspected = await inspectPhoto(file)

  const storageRef =
    `occurrences/${occurrence.id}/initial/` +
    `${randomUUID()}.${inspected.extension}`

  const storedObject = await objectStorage.put({
    key: storageRef,

    body: file.buffer,

    contentType: inspected.mimeType
  })

  let oldStorageRef: string | null = null

  try {
    const media = await prisma.$transaction(async (tx) => {
      const current = await tx.occurrence.findFirst({
        where: {
          id: occurrence.id,

          reporterId: citizenId,

          deletedAt: null
        },

        select: {
          id: true,

          status: true,

          _count: {
            select: {
              validations: true,

              informationRequests: true
            }
          }
        }
      })

      if (!current) {
        throw new HttpError(
          404,
          "Ocorrência não encontrada.",
          "OCCURRENCE_NOT_FOUND"
        )
      }

      assertInitialEvidenceMutable(current)

      const primary = await tx.occurrenceMedia.findFirst({
        where: {
          occurrenceId: current.id,

          type: "IMAGE",

          origin: "INITIAL",

          isPrimary: true
        }
      })

      if (!primary) {
        throw new HttpError(
          409,
          "A ocorrência ainda não possui uma foto principal para substituir.",
          "PRIMARY_PHOTO_NOT_FOUND"
        )
      }

      oldStorageRef = primary.storageRef

      const replaced = await tx.occurrenceMedia.update({
        where: {
          id: primary.id
        },

        data: {
          mimeType: inspected.mimeType,

          storageRef: storedObject.storageRef,

          sizeBytes: BigInt(file.size),

          sha256: inspected.sha256,

          /*
           * Mantemos o mesmo registro
           * lógico de mídia, mas a data
           * passa a representar a
           * evidência atualmente enviada.
           */
          createdAt: new Date()
        }
      })

      await tx.occurrence.update({
        where: {
          id: current.id
        },

        data: {
          updatedAt: new Date()
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: citizenId,

          action: "CITIZEN_PRIMARY_PHOTO_REPLACED",

          entityType: "OCCURRENCE_MEDIA",

          entityId: primary.id,

          beforeData: {
            occurrenceId: current.id,

            mimeType: primary.mimeType,

            sizeBytes:
              primary.sizeBytes === null ? null : Number(primary.sizeBytes),

            sha256: primary.sha256
          },

          afterData: {
            occurrenceId: current.id,

            mimeType: inspected.mimeType,

            sizeBytes: file.size,

            sha256: inspected.sha256
          }
        }
      })

      return replaced
    })

    if (oldStorageRef) {
      try {
        await objectStorage.delete(oldStorageRef)
      } catch (cleanupError) {
        /*
         * O banco já aponta para a nova
         * imagem. Uma eventual falha ao
         * apagar o objeto antigo não deve
         * invalidar a substituição.
         */
        console.error(
          "Falha ao remover a mídia substituída do storage:",
          cleanupError
        )
      }
    }

    triggerPreAnalysis(occurrence.id, "LATEST_EVIDENCE")

    return media
  } catch (error) {
    try {
      await objectStorage.delete(storedObject.storageRef)
    } catch (cleanupError) {
      console.error(
        "Falha ao remover nova mídia após erro na substituição:",
        cleanupError
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
