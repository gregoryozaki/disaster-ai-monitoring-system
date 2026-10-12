import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_RESPONSIBLE_USE_VERSION,
  CURRENT_TERMS_VERSION
} from "@kamara/shared-types"

import type { ApiCitizenAgreementStatus, ApiUser } from "./api"

const STORAGE_KEY = "kamara:citizen-session:v2"

const LEGACY_STORAGE_KEY = "kamara:citizen-session:v1"

const PENDING_SERVER_LOGOUT_KEY = "kamara:citizen-pending-server-logout"

export interface StoredCitizenSession {
  user: ApiUser

  agreement: ApiCitizenAgreementStatus

  validatedAt: string
}

export function createRequiredCitizenAgreementStatus(): ApiCitizenAgreementStatus {
  return {
    required: true,

    termsVersion: CURRENT_TERMS_VERSION,

    privacyVersion: CURRENT_PRIVACY_VERSION,

    responsibleUseVersion: CURRENT_RESPONSIBLE_USE_VERSION,

    acceptedAt: null
  }
}

function normalizeAgreement(
  agreement: ApiCitizenAgreementStatus | null | undefined
): ApiCitizenAgreementStatus {
  const versionsAreCurrent =
    agreement?.termsVersion === CURRENT_TERMS_VERSION &&
    agreement?.privacyVersion === CURRENT_PRIVACY_VERSION &&
    agreement?.responsibleUseVersion === CURRENT_RESPONSIBLE_USE_VERSION

  if (!versionsAreCurrent) {
    return createRequiredCitizenAgreementStatus()
  }

  if (
    agreement.required === false &&
    typeof agreement.acceptedAt === "string" &&
    agreement.acceptedAt
  ) {
    return {
      ...agreement,

      required: false
    }
  }

  return createRequiredCitizenAgreementStatus()
}

export function saveCitizenSession(
  user: ApiUser,
  agreement?: ApiCitizenAgreementStatus | null
) {
  if (typeof window === "undefined" || user.role !== "CITIZEN") {
    return
  }

  const value: StoredCitizenSession = {
    user,

    agreement: normalizeAgreement(agreement),

    validatedAt: new Date().toISOString()
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))

  localStorage.removeItem(LEGACY_STORAGE_KEY)

  // Uma sessão nova substitui o cookie antigo neste aparelho.
  localStorage.removeItem(PENDING_SERVER_LOGOUT_KEY)
}

export function readCitizenSession(): StoredCitizenSession | null {
  if (typeof window === "undefined") {
    return null
  }

  if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
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
      user.role !== "CITIZEN" ||
      user.status !== "ACTIVE"
    ) {
      clearCitizenSession()

      return null
    }

    return {
      user,

      agreement: normalizeAgreement(parsed.agreement),

      validatedAt:
        typeof parsed.validatedAt === "string"
          ? parsed.validatedAt
          : new Date(0).toISOString()
    }
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

  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

/*
 * Quando alguém sai da conta sem internet, o servidor não fica sabendo e o
 * cookie de sessão continua valendo. Esta marca faz o PWA encerrar essa
 * sessão no servidor assim que houver conexão, antes de usar o cookie.
 */
export function markPendingServerLogout() {
  if (typeof window === "undefined") {
    return
  }

  localStorage.setItem(PENDING_SERVER_LOGOUT_KEY, new Date().toISOString())
}

export function hasPendingServerLogout(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  return localStorage.getItem(PENDING_SERVER_LOGOUT_KEY) !== null
}

export function clearPendingServerLogout() {
  if (typeof window === "undefined") {
    return
  }

  localStorage.removeItem(PENDING_SERVER_LOGOUT_KEY)
}
