import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginAs, logoutDevice } from "./session-mock"

vi.mock("../src/lib/local-session", () => import("./session-mock"))

import { api, type ApiOccurrence } from "../src/lib/api"

import {
  getOfflineOccurrence,
  saveOfflineOccurrence,
  type NewOfflineOccurrence
} from "../src/lib/offline-db"

import {
  syncAllOfflineOccurrences,
  syncOfflineOccurrence
} from "../src/lib/offline-sync"

const CITIZEN_A = "11111111-1111-4111-8111-111111111111"

const CITIZEN_B = "22222222-2222-4222-8222-222222222222"

function newOccurrence(clientLocalId: string): NewOfflineOccurrence {
  return {
    clientLocalId,

    idempotencyKey: `idem-${clientLocalId}`,

    description: `Deslizamento (${clientLocalId})`,

    urgency: "CRITICAL",

    humanRisk: true,

    latitude: -3.1,

    longitude: -60.02,

    locationSource: "MANUAL",

    reportedAt: "2026-10-12T12:00:00.000Z",

    photo: null
  }
}

function mockSyncEndpoint() {
  return vi.spyOn(api, "syncOccurrence").mockImplementation(
    async (payload) =>
      ({
        data: {
          id: `servidor-${payload.clientLocalId}`
        } as ApiOccurrence,

        meta: {}
      }) as Awaited<ReturnType<typeof api.syncOccurrence>>
  )
}

beforeEach(() => {
  logoutDevice()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sincronização offline por usuário", () => {
  it("envia só as ocorrências de quem está logado", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    loginAs(CITIZEN_B)

    await saveOfflineOccurrence(newOccurrence("b-1"))

    const syncSpy = mockSyncEndpoint()

    const results = await syncAllOfflineOccurrences()

    expect(results).toEqual([
      {
        clientLocalId: "b-1",

        status: "SYNCED",

        occurrenceId: "servidor-b-1"
      }
    ])

    expect(syncSpy).toHaveBeenCalledTimes(1)

    expect(syncSpy.mock.calls[0][0].clientLocalId).toBe("b-1")

    loginAs(CITIZEN_A)

    expect(await getOfflineOccurrence("a-1")).not.toBeNull()
  })

  it("não envia a ocorrência de outra pessoa pelo identificador", async () => {
    loginAs(CITIZEN_A)

    await saveOfflineOccurrence(newOccurrence("a-1"))

    loginAs(CITIZEN_B)

    const syncSpy = mockSyncEndpoint()

    const result = await syncOfflineOccurrence("a-1", {
      force: true
    })

    expect(result.status).toBe("ERROR")

    expect(syncSpy).not.toHaveBeenCalled()

    loginAs(CITIZEN_A)

    expect((await getOfflineOccurrence("a-1"))?.syncStatus).toBe("PENDING_SYNC")
  })
})
