import type { LocationSource, UrgencyLevel } from "./api"

import { readCitizenSession } from "./local-session"

export type OfflineSyncStatus = "PENDING_SYNC" | "SYNCING" | "ERROR"

export interface OfflinePhoto {
  blob: Blob

  name: string

  type: string

  lastModified: number
}

export interface OfflineOccurrenceRecord {
  clientLocalId: string

  // Cidadão que salvou o registro. Cada pessoa só vê e envia os próprios.
  ownerUserId: string

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
  | "ownerUserId"
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

const DB_VERSION = 2

const STORE_NAME = "occurrences"

const OWNER_INDEX = "ownerUserId"

/*
 * O dono dos registros é o cidadão da sessão salva neste aparelho
 * (a mesma que o PWA usa quando está sem internet).
 */
function currentOwnerId(): string | null {
  return readCitizenSession()?.user.id ?? null
}

function requireOwnerId(): string {
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    throw new Error("Entre na sua conta para salvar ocorrências offline.")
  }

  return ownerUserId
}

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

    request.onupgradeneeded = (event) => {
      const database = request.result

      const upgradeTransaction = request.transaction

      if (!upgradeTransaction) {
        return
      }

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const created = database.createObjectStore(STORE_NAME, {
          keyPath: "clientLocalId"
        })

        created.createIndex("syncStatus", "syncStatus", {
          unique: false
        })

        created.createIndex("createdAt", "createdAt", {
          unique: false
        })
      }

      const store = upgradeTransaction.objectStore(STORE_NAME)

      if (event.oldVersion < 2) {
        /*
         * Registros da versão 1 não sabem de quem são. Não dá para
         * atribuí-los com segurança a ninguém, então são apagados.
         */
        store.clear()
      }

      if (!store.indexNames.contains(OWNER_INDEX)) {
        store.createIndex(OWNER_INDEX, "ownerUserId", {
          unique: false
        })
      }
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

    ownerUserId: requireOwnerId(),

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
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    return null
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readonly")

    const request = transaction.objectStore(STORE_NAME).get(clientLocalId)

    const result = await requestToPromise<OfflineOccurrenceRecord | undefined>(
      request
    )

    return result?.ownerUserId === ownerUserId ? result : null
  } finally {
    database.close()
  }
}

export async function listOfflineOccurrences(): Promise<
  OfflineOccurrenceRecord[]
> {
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    return []
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readonly")

    const request = transaction
      .objectStore(STORE_NAME)
      .index(OWNER_INDEX)
      .getAll(ownerUserId)

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
  patch: Partial<Omit<OfflineOccurrenceRecord, "clientLocalId" | "ownerUserId">>
): Promise<OfflineOccurrenceRecord> {
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    throw new Error("Ocorrência offline não encontrada.")
  }

  const database = await openDatabase()

  let updated = null as OfflineOccurrenceRecord | null

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    const store = transaction.objectStore(STORE_NAME)

    const request = store.get(clientLocalId)

    /*
     * Lê e grava na mesma transação. Assim uma atualização não recria um
     * registro que o logout acabou de apagar.
     */
    request.onsuccess = () => {
      const current = request.result as OfflineOccurrenceRecord | undefined

      if (current?.ownerUserId !== ownerUserId) {
        return
      }

      updated = {
        ...current,
        ...patch,

        clientLocalId,

        ownerUserId,

        updatedAt: new Date().toISOString()
      }

      store.put(updated)
    }

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  if (!updated) {
    throw new Error("Ocorrência offline não encontrada.")
  }

  notifyQueueChanged()

  return updated
}

export async function deleteOfflineOccurrence(
  clientLocalId: string
): Promise<void> {
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    return
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    const store = transaction.objectStore(STORE_NAME)

    const request = store.get(clientLocalId)

    // Só apaga se o registro for de quem está logado.
    request.onsuccess = () => {
      const record = request.result as OfflineOccurrenceRecord | undefined

      if (record?.ownerUserId === ownerUserId) {
        store.delete(clientLocalId)
      }
    }

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  notifyQueueChanged()
}

/*
 * Chamado no logout, antes de apagar a sessão local. Remove do aparelho
 * todos os registros offline de quem está saindo, inclusive as fotos.
 */
export async function clearOfflineOccurrencesOfCurrentUser(): Promise<void> {
  const ownerUserId = currentOwnerId()

  if (!ownerUserId) {
    return
  }

  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")

    const store = transaction.objectStore(STORE_NAME)

    const request = store.index(OWNER_INDEX).getAllKeys(ownerUserId)

    request.onsuccess = () => {
      for (const key of request.result) {
        store.delete(key)
      }
    }

    await transactionToPromise(transaction)
  } finally {
    database.close()
  }

  notifyQueueChanged()
}
