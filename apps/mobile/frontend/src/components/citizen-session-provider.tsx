"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react"

import {
  ApiError,
  api,
  isApiNetworkError,
  type ApiCitizenAgreementStatus,
  type ApiUser
} from "@/lib/api"

import {
  clearCitizenSession,
  createRequiredCitizenAgreementStatus,
  readCitizenSession,
  saveCitizenSession
} from "@/lib/local-session"

interface CitizenSessionContextValue {
  user: ApiUser | null

  agreement: ApiCitizenAgreementStatus | null

  agreementRequired: boolean

  loading: boolean

  offline: boolean

  refresh: () => Promise<void>

  logout: () => Promise<void>
}

const CitizenSessionContext = createContext<CitizenSessionContextValue | null>(
  null
)

export function CitizenSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)

  const [agreement, setAgreement] = useState<ApiCitizenAgreementStatus | null>(
    null
  )

  const [loading, setLoading] = useState(true)

  const [offline, setOffline] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)

    setOffline(false)

    const localSession = readCitizenSession()

    try {
      const response = await api.me()

      if (
        response.data.role !== "CITIZEN" ||
        response.data.status !== "ACTIVE"
      ) {
        clearCitizenSession()

        setUser(null)

        setAgreement(null)

        return
      }

      const currentAgreement =
        response.agreement ?? createRequiredCitizenAgreementStatus()

      saveCitizenSession(response.data, currentAgreement)

      setUser(response.data)

      setAgreement(currentAgreement)
    } catch (error) {
      if (isApiNetworkError(error) && localSession) {
        setUser(localSession.user)

        setAgreement(localSession.agreement)

        setOffline(true)

        return
      }

      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        clearCitizenSession()
      }

      setUser(null)

      setAgreement(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)

    clearCitizenSession()

    setUser(null)

    setAgreement(null)

    setOffline(false)
  }, [])

  const agreementRequired = Boolean(user) && agreement?.required !== false

  const value = useMemo<CitizenSessionContextValue>(
    () => ({
      user,

      agreement,

      agreementRequired,

      loading,

      offline,

      refresh,

      logout
    }),
    [user, agreement, agreementRequired, loading, offline, refresh, logout]
  )

  return (
    <CitizenSessionContext.Provider value={value}>
      {children}
    </CitizenSessionContext.Provider>
  )
}

export function useCitizenSession() {
  const context = useContext(CitizenSessionContext)

  if (!context) {
    throw new Error(
      "useCitizenSession deve ser usado dentro de CitizenSessionProvider."
    )
  }

  return context
}
