import { beforeEach, describe, expect, it, vi } from "vitest"

import { loginAs, logoutDevice } from "./session-mock"

vi.mock("../src/lib/local-session", () => import("./session-mock"))

import {
  clearOfflineOccurrencesOfCurrentUser,
  deleteOfflineOccurrence,
  getOfflineOccurrence,
  listOfflineOccurrences,
  saveOfflineOccurrence,
  updateOfflineOccurrence,
  type NewOfflineOccurrence,
  type OfflineOccurrenceRecord
} from "../src/lib/offline-db"

const CITIZEN_A = "11111111-1111-4111-8111-111111111111"

const CITIZEN_B = "22222222-2222-4222-8222-222222222222"

function newOccurrence(
  clientLocalId: string,
  overrides: Partial<NewOfflineOccurrence> = {}
): NewOfflineOccurrence {
  return {
    clientLocalId,

    idempotencyKey: `idem-${clientLocalId}`,

    description: `Rua alagada (${clientLocalId})`,

    urgency: "HIGH",

    humanRisk: false,

    latitude: -3.1019,

    longitude: -60.025,

    locationSource: "AUTO",

    reportedAt: "2026-10-12T12:00:00.000Z",

    photo: null,

    ...overrides
  }
}

function openRawDatabase(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kamara-offline", version)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains("occurrences")) {
        database.createObjectStore("occurrences", {
          keyPath: "clientLocalId"
        })
      }
    }

    request.onsuccess = () => resolve(request.result)

    request.onerror = () => reject(request.error)
  })
}

async function readAllRawRecords(): Promise<OfflineOccurrenceRecord[]> {
  const database = await openRawDatabase()

  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction("occurrences", "readonly")
        .objectStore("occurrences")
        .getAll()

      request.onsuccess = () => resolve(request.result)

      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

beforeEach(() => {
  logoutDevice()
})

describe("ocorrências offline por usuário", () => {
  it("grava quem salvou e lista só as ocorrências de quem está logado", async () => {
    loginAs(CITIZEN_A)

    const saved = await saveOfflineOccurrence(newOccurrence("a-1"))

    expect(saved.ownerUserId).toBe(CITIZEN_A)

    loginAs(CITIZEN_B)

    await saveOfflineOccurrence(newOccurrence("b-1"))

    expect(
      (await listOfflineOccurrences()).map((record) => record.clientLocalId)
    ).toEqual(["b-1"])

    loginAs(CITIZEN_A)

    expect(
      (await listOfflineOccurrences()).map((record) => record.clientLocalId)
    ).toEqual(["a-1"])
  })

  it("não abre a ocorrência de outra pessoa pelo identificador", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    expect(await getOfflineOccurrence("a-1")).not.toBeNull()

    loginAs(CITIZEN_B)

    expect(await getOfflineOccurrence("a-1")).toBeNull()
  })

  it("não deixa outra pessoa alterar nem apagar a ocorrência", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    loginAs(CITIZEN_B)

    await expect(
      updateOfflineOccurrence("a-1", {
        description: "alterado por outra pessoa"
      })
    ).rejects.toThrow("não encontrada")

    await deleteOfflineOccurrence("a-1")

    loginAs(CITIZEN_A)

    const record = await getOfflineOccurrence("a-1")

    expect(record?.description).toBe("Rua alagada (a-1)")
  })

  it("não troca o dono da ocorrência numa atualização", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    const updated = await updateOfflineOccurrence("a-1", {
      description: "nova descrição",

      ownerUserId: CITIZEN_B
    } as Parameters<typeof updateOfflineOccurrence>[1])

    expect(updated.ownerUserId).toBe(CITIZEN_A)

    loginAs(CITIZEN_B)

    expect(await listOfflineOccurrences()).toEqual([])
  })

  it("apaga a ocorrência quando é o próprio dono", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    await deleteOfflineOccurrence("a-1")

    expect(await getOfflineOccurrence("a-1")).toBeNull()

    expect(await readAllRawRecords()).toEqual([])
  })

  it("no logout apaga só as ocorrências de quem saiu, inclusive a foto", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(
      newOccurrence("a-1", {
        photo: {
          blob: new Blob(["foto"], {
            type: "image/jpeg"
          }),

          name: "foto.jpg",

          type: "image/jpeg",

          lastModified: 1
        }
      })
    )

    await saveOfflineOccurrence(newOccurrence("a-2"))

    loginAs(CITIZEN_B)

    await saveOfflineOccurrence(newOccurrence("b-1"))

    loginAs(CITIZEN_A)

    await clearOfflineOccurrencesOfCurrentUser()

    expect(await listOfflineOccurrences()).toEqual([])

    expect(
      (await readAllRawRecords()).map((record) => record.clientLocalId)
    ).toEqual(["b-1"])
  })

  it("uma atualização em andamento não recria o registro apagado no logout", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    await Promise.allSettled([
      updateOfflineOccurrence("a-1", {
        syncStatus: "SYNCING"
      }),

      clearOfflineOccurrencesOfCurrentUser()
    ])

    expect(await readAllRawRecords()).toEqual([])
  })

  it("sem ninguém logado, não salva nem mostra nada", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    logoutDevice()

    await expect(saveOfflineOccurrence(newOccurrence("x-1"))).rejects.toThrow(
      "Entre na sua conta"
    )

    expect(await listOfflineOccurrences()).toEqual([])

    expect(await getOfflineOccurrence("a-1")).toBeNull()

    await clearOfflineOccurrencesOfCurrentUser()

    expect(await readAllRawRecords()).toHaveLength(1)
  })

  it("apaga na atualização os registros antigos, que não têm dono", async () => {
    const legacy = await openRawDatabase(1)

    await new Promise<void>((resolve, reject) => {
      const transaction = legacy.transaction("occurrences", "readwrite")

      transaction.objectStore("occurrences").put({
        ...newOccurrence("legado-1"),

        syncStatus: "PENDING_SYNC"
      })

      transaction.oncomplete = () => resolve()

      transaction.onerror = () => reject(transaction.error)
    })

    legacy.close()

    loginAs(CITIZEN_A)

    expect(await listOfflineOccurrences()).toEqual([])

    expect(await readAllRawRecords()).toEqual([])

    await saveOfflineOccurrence(newOccurrence("a-1"))

    expect(
      (await listOfflineOccurrences()).map((record) => record.clientLocalId)
    ).toEqual(["a-1"])
  })
})
