import { api, ApiError } from "./api"

import {
  deleteOfflineOccurrence,
  getOfflineOccurrence,
  listOfflineOccurrences,
  updateOfflineOccurrence,
  type OfflineOccurrenceRecord
} from "./offline-db"

export interface OfflineSyncResult {
  clientLocalId: string

  status: "SYNCED" | "PENDING_SYNC" | "ERROR"

  occurrenceId?: string

  error?: string
}

const activeSyncs = new Map<string, Promise<OfflineSyncResult>>()

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return "Erro desconhecido durante a sincronização."
}

function shouldRemainPending(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return true
  }

  if (error.status === 401 || error.status === 403) {
    return true
  }

  if (error.status === 408 || error.status === 429) {
    return true
  }

  if (error.status >= 500) {
    return true
  }

  return false
}

async function ensurePhoto(
  occurrenceId: string,
  record: OfflineOccurrenceRecord
): Promise<void> {
  if (!record.photo) {
    return
  }

  const mediaResponse = await api.listOccurrenceMedia(occurrenceId)

  const alreadyUploaded = mediaResponse.data.some(
    (item) => item.type === "IMAGE" && item.origin === "INITIAL"
  )

  if (alreadyUploaded) {
    return
  }

  const file = new File([record.photo.blob], record.photo.name, {
    type: record.photo.type,

    lastModified: record.photo.lastModified
  })

  await api.uploadInitialPhoto(occurrenceId, file)
}

async function performSync(
  record: OfflineOccurrenceRecord
): Promise<OfflineSyncResult> {
  const attempted = await updateOfflineOccurrence(record.clientLocalId, {
    syncStatus: "SYNCING",

    attemptCount: record.attemptCount + 1,

    lastAttemptAt: new Date().toISOString(),

    lastError: null
  })

  try {
    const response = await api.syncOccurrence({
      clientLocalId: attempted.clientLocalId,

      idempotencyKey: attempted.idempotencyKey,

      description: attempted.description,

      urgency: attempted.urgency,

      humanRisk: attempted.humanRisk,

      latitude: attempted.latitude,

      longitude: attempted.longitude,

      locationSource: attempted.locationSource,

      ...(attempted.locationAccuracyM !== undefined
        ? {
            locationAccuracyM: attempted.locationAccuracyM
          }
        : {}),

      reportedAt: attempted.reportedAt
    })

    const occurrenceId = response.data.id

    await updateOfflineOccurrence(attempted.clientLocalId, {
      serverOccurrenceId: occurrenceId
    })

    await ensurePhoto(occurrenceId, attempted)

    await deleteOfflineOccurrence(attempted.clientLocalId)

    return {
      clientLocalId: attempted.clientLocalId,

      status: "SYNCED",

      occurrenceId
    }
  } catch (error) {
    const pending = shouldRemainPending(error)

    const message = errorMessage(error)

    await updateOfflineOccurrence(attempted.clientLocalId, {
      syncStatus: pending ? "PENDING_SYNC" : "ERROR",

      lastError: message
    })

    return {
      clientLocalId: attempted.clientLocalId,

      status: pending ? "PENDING_SYNC" : "ERROR",

      error: message
    }
  }
}

export async function syncOfflineOccurrence(
  clientLocalId: string,
  options: {
    force?: boolean
  } = {}
): Promise<OfflineSyncResult> {
  const existingPromise = activeSyncs.get(clientLocalId)

  if (existingPromise) {
    return existingPromise
  }

  const record = await getOfflineOccurrence(clientLocalId)

  if (!record) {
    return {
      clientLocalId,

      status: "ERROR",

      error: "Ocorrência offline não encontrada."
    }
  }

  if (record.syncStatus === "ERROR" && !options.force) {
    return {
      clientLocalId,

      status: "ERROR",

      error:
        record.lastError ??
        "A ocorrência exige intervenção antes de nova tentativa."
    }
  }

  const promise = performSync(record).finally(() => {
    activeSyncs.delete(clientLocalId)
  })

  activeSyncs.set(clientLocalId, promise)

  return promise
}

export async function syncAllOfflineOccurrences(): Promise<
  OfflineSyncResult[]
> {
  const records = await listOfflineOccurrences()

  const eligible = records.filter((record) => record.syncStatus !== "ERROR")

  const results: OfflineSyncResult[] = []

  for (const record of eligible) {
    const result = await syncOfflineOccurrence(record.clientLocalId)

    results.push(result)

    if (
      result.status === "PENDING_SYNC" &&
      typeof navigator !== "undefined" &&
      !navigator.onLine
    ) {
      break
    }
  }

  return results
}
