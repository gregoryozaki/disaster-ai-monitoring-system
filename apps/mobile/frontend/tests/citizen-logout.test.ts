import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  hasPendingServerLogout,
  loginAs,
  logoutDevice,
  markPendingServerLogout,
  readCitizenSession
} from "./session-mock"

vi.mock("../src/lib/local-session", () => import("./session-mock"))

import { ApiError, ApiNetworkError, api } from "../src/lib/api"

import {
  finishPendingServerLogout,
  logoutFromDevice
} from "../src/lib/citizen-logout"

import {
  listOfflineOccurrences,
  saveOfflineOccurrence
} from "../src/lib/offline-db"

const CITIZEN_A = "11111111-1111-4111-8111-111111111111"

async function saveOne(clientLocalId: string) {
  await saveOfflineOccurrence({
    clientLocalId,

    idempotencyKey: `idem-${clientLocalId}`,

    description: "Árvore caída bloqueando a rua",

    urgency: "MEDIUM",

    humanRisk: false,

    latitude: -3.1,

    longitude: -60.02,

    locationSource: "AUTO",

    reportedAt: "2026-10-12T12:00:00.000Z",

    photo: null
  })
}

beforeEach(() => {
  logoutDevice()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("logout no aparelho", () => {
  it("com internet, apaga os dados offline e encerra a sessão no servidor", async () => {
    loginAs(CITIZEN_A)

    await saveOne("a-1")

    const logoutSpy = vi.spyOn(api, "logout").mockResolvedValue(undefined)

    await logoutFromDevice()

    expect(logoutSpy).toHaveBeenCalledTimes(1)

    expect(readCitizenSession()).toBeNull()

    expect(hasPendingServerLogout()).toBe(false)

    loginAs(CITIZEN_A)

    expect(await listOfflineOccurrences()).toEqual([])
  })

  it("sem internet, apaga os dados offline e deixa o logout do servidor pendente", async () => {
    loginAs(CITIZEN_A)

    await saveOne("a-1")

    vi.spyOn(api, "logout").mockRejectedValue(new ApiNetworkError())

    await logoutFromDevice()

    expect(readCitizenSession()).toBeNull()

    expect(hasPendingServerLogout()).toBe(true)

    loginAs(CITIZEN_A)

    expect(await listOfflineOccurrences()).toEqual([])
  })

  it("termina o logout pendente quando a internet volta", async () => {
    markPendingServerLogout()

    const logoutSpy = vi.spyOn(api, "logout").mockResolvedValue(undefined)

    expect(await finishPendingServerLogout()).toBe(true)

    expect(logoutSpy).toHaveBeenCalledTimes(1)

    expect(hasPendingServerLogout()).toBe(false)
  })

  it("mantém o logout pendente enquanto continua sem internet", async () => {
    markPendingServerLogout()

    vi.spyOn(api, "logout").mockRejectedValue(new ApiNetworkError())

    expect(await finishPendingServerLogout()).toBe(true)

    expect(hasPendingServerLogout()).toBe(true)
  })

  it("considera encerrada a sessão que o servidor já não aceita", async () => {
    markPendingServerLogout()

    vi.spyOn(api, "logout").mockRejectedValue(
      new ApiError("Sessão expirada.", 401)
    )

    expect(await finishPendingServerLogout()).toBe(true)

    expect(hasPendingServerLogout()).toBe(false)
  })

  it("sem logout pendente, não chama o servidor", async () => {
    const logoutSpy = vi.spyOn(api, "logout")

    expect(await finishPendingServerLogout()).toBe(false)

    expect(logoutSpy).not.toHaveBeenCalled()
  })
})
