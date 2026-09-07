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

import { ApiError, api, isApiNetworkError, type ApiUser } from "@/lib/api"

import {
  clearCitizenSession,
  readCitizenSession,
  saveCitizenSession
} from "@/lib/local-session"

interface CitizenSessionContextValue {
  user: ApiUser | null

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

        return
      }

      saveCitizenSession(response.data)

      setUser(response.data)
    } catch (error) {
      if (isApiNetworkError(error) && localSession) {
        setUser(localSession)

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

    setOffline(false)
  }, [])

  const value = useMemo<CitizenSessionContextValue>(
    () => ({
      user,
      loading,
      offline,
      refresh,
      logout
    }),
    [user, loading, offline, refresh, logout]
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
