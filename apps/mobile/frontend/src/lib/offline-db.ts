import type { LocationSource, UrgencyLevel } from "./api"

export type OfflineSyncStatus = "PENDING_SYNC" | "SYNCING" | "ERROR"

export interface OfflinePhoto {
  blob: Blob

  name: string

  type: string

  lastModified: number
}

export interface OfflineOccurrenceRecord {
  clientLocalId: string

  idempotencyKey: string

  description: string

  urgency: UrgencyLevel

  humanRisk: boolean

  latitude: number

  longitude: number

  locationSource: LocationSource

  locationAccuracyM?: number

  reportedAt: string

  photo: OfflinePhoto | null

  syncStatus: OfflineSyncStatus

  attemptCount: number

  lastAttemptAt: string | null

  lastError: string | null

  serverOccurrenceId: string | null

  createdAt: string

  updatedAt: string
}

export type NewOfflineOccurrence = Omit<
  OfflineOccurrenceRecord,
  | "syncStatus"
  | "attemptCount"
  | "lastAttemptAt"
  | "lastError"
  | "serverOccurrenceId"
  | "createdAt"
  | "updatedAt"
>

export const OFFLINE_QUEUE_CHANGED_EVENT = "kamara:offline-queue-changed"

const DB_NAME = "kamara-offline"

const DB_VERSION = 1

const STORE_NAME = "occurrences"

function notifyQueueChanged() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT))
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)

    request.onerror = () =>
      reject(request.error ?? new Error("Falha na operação do IndexedDB."))
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()

    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Falha na transação do IndexedDB."))

    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Transação do IndexedDB cancelada.")
      )
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB não está disponível neste navegador.")
    )
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (database.objectStoreNames.contains(STORE_NAME)) {
        return
      }

      const store = database.createObjectStore(STORE_NAME, {
        keyPath: "clientLocalId"
      })

      store.createIndex("syncStatus", "syncStatus", {
        unique: false
      })

      store.createIndex("createdAt", "createdAt", {
        unique: false
      })
    }

    request.onsuccess = () => resolve(request.result)

    request.onerror = () =>
      reject(request.error ?? new Error("Não foi possível abrir o IndexedDB."))
  })
}

export async function saveOfflineOccurrence(
  input: NewOfflineOccurrence
): Promise<OfflineOccurrenceRecord> {
  const now = new Date().toISOString()

  const record: OfflineOccurrenceRecord = {
    ...input,

    syncStatus: "PENDING_SYNC",

    attemptCount: 0,

    lastAttemptAt: null,

    lastError: null,

    serverOccurrenceId: null,

    createdAt: now,

    updatedAt: now
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    transaction.objectStore(STORE_NAME).put(record)

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  notifyQueueChanged()

  return record
}

export async function getOfflineOccurrence(
  clientLocalId: string
): Promise<OfflineOccurrenceRecord | null> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readonly")

    const request = transaction.objectStore(STORE_NAME).get(clientLocalId)

    const result = await requestToPromise<OfflineOccurrenceRecord | undefined>(
      request
    )

    return result ?? null
  } finally {
    database.close()
  }
}

export async function listOfflineOccurrences(): Promise<
  OfflineOccurrenceRecord[]
> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readonly")

    const request = transaction.objectStore(STORE_NAME).getAll()

    const records = await requestToPromise<OfflineOccurrenceRecord[]>(request)

    return records.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )
  } finally {
    database.close()
  }
}

export async function updateOfflineOccurrence(
  clientLocalId: string,
  patch: Partial<Omit<OfflineOccurrenceRecord, "clientLocalId">>
): Promise<OfflineOccurrenceRecord> {
  const current = await getOfflineOccurrence(clientLocalId)

  if (!current) {
    throw new Error("Ocorrência offline não encontrada.")
  }

  const updated: OfflineOccurrenceRecord = {
    ...current,
    ...patch,

    clientLocalId,

    updatedAt: new Date().toISOString()
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    transaction.objectStore(STORE_NAME).put(updated)

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  notifyQueueChanged()

  return updated
}

export async function deleteOfflineOccurrence(
  clientLocalId: string
): Promise<void> {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    transaction.objectStore(STORE_NAME).delete(clientLocalId)

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  notifyQueueChanged()
}
