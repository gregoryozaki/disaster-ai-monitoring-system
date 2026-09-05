import type { UserRole } from "../../generated/prisma/enums.js"

import { objectStorage } from "../../integrations/storage/s3-storage.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import type { CreateExportInput } from "./export.schema.js"

interface ExportViewer {
  id: string
  role: UserRole
}

interface AnonymizedOccurrenceRow {
  recordNumber: number

  reportedDate: string

  status: string

  urgency: string

  humanRisk: boolean

  cobradeCode: string | null

  categoryName: string | null

  latitudeApprox: number

  longitudeApprox: number
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(2))
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  const text = String(value)

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function buildCsv(rows: AnonymizedOccurrenceRow[]) {
  const header = [
    "record_number",
    "reported_date",
    "status",
    "urgency",
    "human_risk",
    "cobrade_code",
    "category_name",
    "latitude_approx",
    "longitude_approx"
  ]

  const lines = [
    header.join(","),

    ...rows.map((row) =>
      [
        row.recordNumber,
        row.reportedDate,
        row.status,
        row.urgency,
        row.humanRisk,
        row.cobradeCode,
        row.categoryName,
        row.latitudeApprox,
        row.longitudeApprox
      ]
        .map(csvCell)
        .join(",")
    )
  ]

  return Buffer.from(`\uFEFF${lines.join("\n")}\n`, "utf8")
}

function buildJson(rows: AnonymizedOccurrenceRow[]) {
  return Buffer.from(`${JSON.stringify(rows, null, 2)}\n`, "utf8")
}

async function buildAnonymizedDataset() {
  const occurrences = await prisma.occurrence.findMany({
    where: {
      deletedAt: null
    },

    select: {
      id: true,

      urgency: true,

      humanRisk: true,

      reportedAt: true,

      latitude: true,

      longitude: true,

      status: true,

      confirmedCategory: {
        select: {
          cobradeCode: true,

          name: true
        }
      }
    },

    orderBy: [
      {
        reportedAt: "asc"
      },

      {
        id: "asc"
      }
    ]
  })

  return occurrences.map((occurrence, index): AnonymizedOccurrenceRow => ({
    recordNumber: index + 1,

    reportedDate: occurrence.reportedAt.toISOString().slice(0, 10),

    status: occurrence.status,

    urgency: occurrence.urgency,

    humanRisk: occurrence.humanRisk,

    cobradeCode: occurrence.confirmedCategory?.cobradeCode ?? null,

    categoryName: occurrence.confirmedCategory?.name ?? null,

    latitudeApprox: roundCoordinate(Number(occurrence.latitude)),

    longitudeApprox: roundCoordinate(Number(occurrence.longitude))
  }))
}

function canAccessExport(
  job: {
    requestedById: string
  },
  viewer: ExportViewer
) {
  return job.requestedById === viewer.id || viewer.role === "ADMIN"
}

export async function createExport(
  requestedById: string,
  input: CreateExportInput
) {
  const job = await prisma.exportJob.create({
    data: {
      requestedById,

      format: input.format,

      status: "PROCESSING",

      filters: {},

      anonymized: true
    }
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: requestedById,

      action: "EXPORT_REQUESTED",

      entityType: "EXPORT_JOB",

      entityId: job.id,

      metadata: {
        format: input.format,

        anonymized: true
      }
    }
  })

  let storageRef: string | null = null

  try {
    const rows = await buildAnonymizedDataset()

    const extension = input.format === "CSV" ? "csv" : "json"

    const contentType =
      input.format === "CSV"
        ? "text/csv; charset=utf-8"
        : "application/json; charset=utf-8"

    const body = input.format === "CSV" ? buildCsv(rows) : buildJson(rows)

    const stored = await objectStorage.put({
      key: `exports/${requestedById}/${job.id}.${extension}`,

      body,

      contentType
    })

    storageRef = stored.storageRef

    const readyJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.exportJob.update({
        where: {
          id: job.id
        },

        data: {
          status: "READY",

          fileRef: storageRef,

          completedAt: new Date()
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: requestedById,

          action: "EXPORT_READY",

          entityType: "EXPORT_JOB",

          entityId: job.id,

          metadata: {
            format: input.format,

            records: rows.length,

            anonymized: true
          }
        }
      })

      return updated
    })

    return readyJob
  } catch (error) {
    if (storageRef) {
      await objectStorage.delete(storageRef).catch(() => undefined)
    }

    await prisma.$transaction(async (tx) => {
      await tx.exportJob.update({
        where: {
          id: job.id
        },

        data: {
          status: "FAILED",

          errorMessage: "Falha ao gerar o arquivo de exportação.",

          completedAt: new Date()
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: requestedById,

          action: "EXPORT_FAILED",

          entityType: "EXPORT_JOB",

          entityId: job.id,

          metadata: {
            format: input.format
          }
        }
      })
    })

    throw error
  }
}

export async function getExportJob(exportId: string, viewer: ExportViewer) {
  const job = await prisma.exportJob.findUnique({
    where: {
      id: exportId
    }
  })

  if (!job || !canAccessExport(job, viewer)) {
    throw new HttpError(404, "Exportação não encontrada.", "EXPORT_NOT_FOUND")
  }

  return job
}

export async function getExportContent(exportId: string, viewer: ExportViewer) {
  const job = await getExportJob(exportId, viewer)

  if (job.status !== "READY" || !job.fileRef) {
    throw new HttpError(
      409,
      "O arquivo de exportação ainda não está disponível.",
      "EXPORT_NOT_READY"
    )
  }

  const content = await objectStorage.get(job.fileRef)

  const extension = job.format === "CSV" ? "csv" : "json"

  return {
    job,

    content,

    filename: `kamara-occurrences-${job.id}.${extension}`
  }
}
