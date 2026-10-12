/*
 * Simula quem está logado no aparelho. O offline-db descobre o dono dos
 * registros pela sessão local, então trocar o usuário aqui equivale a
 * outra pessoa entrar no mesmo celular.
 *
 * Uso nos testes:
 *   vi.mock("../src/lib/local-session", () => import("./session-mock"))
 */
let currentUserId: string | null = null

let pendingServerLogout = false

export function readCitizenSession() {
  return currentUserId
    ? {
        user: {
          id: currentUserId
        }
      }
    : null
}

export function clearCitizenSession() {
  currentUserId = null
}

export function markPendingServerLogout() {
  pendingServerLogout = true
}

export function hasPendingServerLogout() {
  return pendingServerLogout
}

export function clearPendingServerLogout() {
  pendingServerLogout = false
}

export function loginAs(userId: string) {
  currentUserId = userId
}

export function logoutDevice() {
  currentUserId = null

  pendingServerLogout = false
}
