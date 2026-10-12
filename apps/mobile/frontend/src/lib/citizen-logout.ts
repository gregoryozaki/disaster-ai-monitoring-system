import { api, isApiNetworkError } from "./api"

import {
  clearCitizenSession,
  clearPendingServerLogout,
  hasPendingServerLogout,
  markPendingServerLogout
} from "./local-session"

import { clearOfflineOccurrencesOfCurrentUser } from "./offline-db"

/*
 * Sai da conta neste aparelho: apaga as ocorrências offline de quem está
 * saindo, encerra a sessão no servidor e esquece a sessão local.
 */
export async function logoutFromDevice() {
  // Vem antes de apagar a sessão local, que diz de quem são os registros.
  await clearOfflineOccurrencesOfCurrentUser().catch(() => undefined)

  try {
    await api.logout()
  } catch (error) {
    // Sem internet o cookie continua valendo no servidor. A marca faz o
    // PWA encerrar essa sessão assim que houver conexão.
    if (isApiNetworkError(error)) {
      markPendingServerLogout()
    }
  }

  clearCitizenSession()
}

/*
 * Termina no servidor um logout feito sem internet, antes de qualquer outra
 * chamada que usaria o cookie antigo. Devolve true quando havia um logout
 * pendente: nesse caso ninguém deve ser considerado logado.
 */
export async function finishPendingServerLogout(): Promise<boolean> {
  if (!hasPendingServerLogout()) {
    return false
  }

  try {
    await api.logout()

    clearPendingServerLogout()
  } catch (error) {
    // Se o servidor respondeu, mesmo com erro (como 401), a sessão antiga
    // já não vale. Só mantém a marca quando continua sem internet.
    if (!isApiNetworkError(error)) {
      clearPendingServerLogout()
    }
  }

  return true
}
