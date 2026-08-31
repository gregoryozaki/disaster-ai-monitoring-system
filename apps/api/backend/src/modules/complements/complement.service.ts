import { randomUUID } from "node:crypto"

import type { OccurrenceMedia } from "../../generated/prisma/client.js"

import { objectStorage } from "../../integrations/storage/s3-storage.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { inspectPhoto } from "../media/media-image.js"

import type { CreateComplementInput } from "./complement.schema.js"

interface StoredComplementPhoto {
  storageRef: string
  mimeType: string
  sizeBytes: bigint
  sha256: string
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

async function assertCanAnswerWithMedia(
  occurrenceId: string,
  requestId: string,
  citizenId: string
): Promise<void> {
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

  if (occurrence.status !== "NEEDS_MORE_INFO") {
    throw new HttpError(
      409,
      "A ocorrência não está aguardando informações adicionais.",
      "OCCURRENCE_NOT_WAITING_FOR_INFO"
    )
  }

  const request = await prisma.informationRequest.findFirst({
    where: {
      id: requestId,
      occurrenceId,
      status: "OPEN"
    },

    select: {
      id: true
    }
  })

  if (!request) {
    throw new HttpError(
      404,
      "Solicitação de informações pendente não encontrada.",
      "INFORMATION_REQUEST_NOT_FOUND"
    )
  }
}

export async function listCitizenInformationRequests(
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

  return prisma.informationRequest.findMany({
    where: {
      occurrenceId
    },

    orderBy: {
      createdAt: "desc"
    }
  })
}

export async function answerInformationRequest(
  occurrenceId: string,
  requestId: string,
  citizenId: string,
  input: CreateComplementInput,
  file?: Express.Multer.File
) {
  if (!input.text && !file) {
    throw new HttpError(
      400,
      "Informe um texto ou envie uma foto como complemento.",
      "COMPLEMENT_CONTENT_REQUIRED"
    )
  }

  /*
   * O ID é criado antes da transação para também
   * podermos utilizá-lo na chave do object storage.
   */
  const complementId = randomUUID()

  let storedPhoto: StoredComplementPhoto | null = null

  /*
   * Quando existe arquivo, fazemos uma pré-validação
   * de ownership/estado antes de enviar bytes ao MinIO.
   *
   * A mesma condição será verificada novamente dentro
   * da transação para proteção contra concorrência.
   */
  if (file) {
    await assertCanAnswerWithMedia(occurrenceId, requestId, citizenId)

    const inspected = await inspectPhoto(file)

    const storageRef =
      `occurrences/${occurrenceId}/complements/` +
      `${complementId}/` +
      `${randomUUID()}.${inspected.extension}`

    const storedObject = await objectStorage.put({
      key: storageRef,
      body: file.buffer,
      contentType: inspected.mimeType
    })

    storedPhoto = {
      storageRef: storedObject.storageRef,

      mimeType: inspected.mimeType,

      sizeBytes: BigInt(file.size),

      sha256: inspected.sha256
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const occurrence = await tx.occurrence.findFirst({
        where: {
          id: occurrenceId,
          reporterId: citizenId,
          deletedAt: null
        }
      })

      if (!occurrence) {
        throw new HttpError(
          404,
          "Ocorrência não encontrada.",
          "OCCURRENCE_NOT_FOUND"
        )
      }

      if (occurrence.status !== "NEEDS_MORE_INFO") {
        throw new HttpError(
          409,
          "A ocorrência não está aguardando informações adicionais.",
          "OCCURRENCE_NOT_WAITING_FOR_INFO"
        )
      }

      const request = await tx.informationRequest.findFirst({
        where: {
          id: requestId,
          occurrenceId,
          status: "OPEN"
        }
      })

      if (!request) {
        throw new HttpError(
          404,
          "Solicitação de informações pendente não encontrada.",
          "INFORMATION_REQUEST_NOT_FOUND"
        )
      }

      /*
       * Somente uma requisição concorrente
       * consegue transformar OPEN em ANSWERED.
       */
      const requestUpdate = await tx.informationRequest.updateMany({
        where: {
          id: request.id,
          status: "OPEN"
        },

        data: {
          status: "ANSWERED",
          answeredAt: new Date()
        }
      })

      if (requestUpdate.count !== 1) {
        throw new HttpError(
          409,
          "A solicitação já foi respondida.",
          "INFORMATION_REQUEST_ALREADY_ANSWERED"
        )
      }

      /*
       * A ocorrência somente volta para análise
       * se ainda estiver aguardando complemento.
       */
      const occurrenceUpdate = await tx.occurrence.updateMany({
        where: {
          id: occurrence.id,
          reporterId: citizenId,
          status: "NEEDS_MORE_INFO",
          deletedAt: null
        },

        data: {
          status: "UNDER_REVIEW"
        }
      })

      if (occurrenceUpdate.count !== 1) {
        throw new HttpError(
          409,
          "A ocorrência foi modificada por outra operação.",
          "OCCURRENCE_CONCURRENT_UPDATE"
        )
      }

      const complement = await tx.occurrenceComplement.create({
        data: {
          id: complementId,

          occurrenceId: occurrence.id,

          requestId: request.id,

          citizenId,

          text: input.text ?? null
        }
      })

      let media: OccurrenceMedia | null = null

      if (storedPhoto) {
        media = await tx.occurrenceMedia.create({
          data: {
            occurrenceId: occurrence.id,

            complementId: complement.id,

            type: "IMAGE",

            origin: "COMPLEMENT",

            mimeType: storedPhoto.mimeType,

            storageRef: storedPhoto.storageRef,

            sizeBytes: storedPhoto.sizeBytes,

            sha256: storedPhoto.sha256,

            /*
             * Complemento não substitui
             * automaticamente a foto principal.
             */
            isPrimary: false
          }
        })
      }

      await tx.statusHistory.create({
        data: {
          occurrenceId: occurrence.id,

          fromStatus: "NEEDS_MORE_INFO",

          toStatus: "UNDER_REVIEW",

          changedByUserId: citizenId,

          actorType: "USER",

          reason: "Informações complementares enviadas pelo cidadão."
        }
      })

      const updatedOccurrence = await tx.occurrence.findUniqueOrThrow({
        where: {
          id: occurrence.id
        }
      })

      return {
        complement,
        media,
        occurrence: updatedOccurrence
      }
    })
  } catch (error) {
    /*
     * MinIO e PostgreSQL não compartilham uma
     * transação ACID.
     *
     * Se o arquivo foi salvo mas o banco falhou,
     * apagamos o objeto como compensação.
     */
    if (storedPhoto) {
      try {
        await objectStorage.delete(storedPhoto.storageRef)
      } catch (cleanupError) {
        console.error(
          "Falha ao remover mídia de complemento órfã do storage:",
          cleanupError
        )
      }
    }

    /*
     * UNIQUE(requestId) também protege contra
     * duas respostas para a mesma solicitação.
     */
    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        409,
        "A solicitação já foi respondida.",
        "INFORMATION_REQUEST_ALREADY_ANSWERED"
      )
    }

    throw error
  }
}
