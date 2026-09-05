import type { ApiUser } from "./api"

const STORAGE_KEY = "kamara:citizen-session:v1"

interface StoredCitizenSession {
  user: ApiUser

  validatedAt: string
}

/*
 * Este registro NÃO substitui
 * autenticação.
 *
 * A autenticação real continua
 * dependendo do cookie HttpOnly
 * validado pelo backend.
 *
 * Esse dado serve somente para que
 * a PWA saiba que este navegador
 * possuía uma sessão de cidadão
 * validada anteriormente quando
 * estiver sem acesso à API.
 */
export function saveCitizenSession(user: ApiUser) {
  if (typeof window === "undefined" || user.role !== "CITIZEN") {
    return
  }

  const value: StoredCitizenSession = {
    user,

    validatedAt: new Date().toISOString()
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function readCitizenSession(): ApiUser | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCitizenSession>

    const user = parsed.user

    if (
      !user ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      user.role !== "CITIZEN"
    ) {
      clearCitizenSession()

      return null
    }

    return user
  } catch {
    clearCitizenSession()

    return null
  }
}

export function clearCitizenSession() {
  if (typeof window === "undefined") {
    return
  }

  localStorage.removeItem(STORAGE_KEY)
}
