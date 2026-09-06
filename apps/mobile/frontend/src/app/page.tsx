"use client"

import dynamic from "next/dynamic"

import Link from "next/link"

import { useCallback, useEffect, useState } from "react"

import {
  Camera,
  History,
  LocateFixed,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRound,
  WifiOff
} from "lucide-react"

import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

import { CategoryIcon, categoryColor } from "@/components/category-icon"

import { PasswordField } from "@/components/password-field"

import { PasswordRequirements } from "@/components/password-requirements"

import { StatusBadge } from "@/components/badges"

import { ShellHeader } from "@/components/shell-header"

import {
  ApiError,
  api,
  ApiPublicOccurrence,
  ApiPublicOccurrenceMeta,
  ApiUser,
  isApiNetworkError
} from "@/lib/api"

import { categoryType } from "@/lib/category"

import {
  clearCitizenSession,
  readCitizenSession,
  saveCitizenSession
} from "@/lib/local-session"

const PublicMap = dynamic(() => import("@/components/public-map"), {
  ssr: false,

  loading: () => (
    <div className="flex h-[300px] items-center justify-center bg-slate-100 text-sm text-slate-500">
      Carregando mapa...
    </div>
  )
})

type LocationState = "LOCATING" | "AVAILABLE" | "DENIED" | "UNSUPPORTED"

interface CitizenPosition {
  latitude: number

  longitude: number

  accuracyM: number | null
}

const RADIUS_OPTIONS = [5, 10, 25, 50] as const

export default function CitizenHomePage() {
  const [user, setUser] = useState<ApiUser | null>(null)

  const [publicOccurrences, setPublicOccurrences] = useState<
    ApiPublicOccurrence[]
  >([])

  const [publicMeta, setPublicMeta] = useState<ApiPublicOccurrenceMeta | null>(
    null
  )

  const [position, setPosition] = useState<CitizenPosition | null>(null)

  const [locationState, setLocationState] = useState<LocationState>("LOCATING")

  const [radiusKm, setRadiusKm] = useState<number>(10)

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [passwordConfirmation, setPasswordConfirmation] = useState("")

  const [name, setName] = useState("")

  const [mode, setMode] = useState<"login" | "register">("login")

  const [loading, setLoading] = useState(true)

  const [message, setMessage] = useState<string | null>(null)

  const [publicMessage, setPublicMessage] = useState<string | null>(null)

  const [offlineMode, setOfflineMode] = useState(false)

  const loadPublicOccurrences = useCallback(
    async (
      nextPosition: CitizenPosition | null,

      nextRadiusKm: number
    ) => {
      try {
        const response = await api.listPublicOccurrences(
          nextPosition
            ? {
                latitude: nextPosition.latitude,

                longitude: nextPosition.longitude,

                radiusKm: nextRadiusKm,

                limit: 100
              }
            : undefined
        )

        setPublicOccurrences(response.data)

        setPublicMeta(response.meta)

        setPublicMessage(null)
      } catch (error) {
        if (isApiNetworkError(error)) {
          setPublicMessage(
            "Sem conexão para atualizar as ocorrências públicas."
          )

          return
        }

        setPublicMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar as ocorrências públicas."
        )
      }
    },
    []
  )

  const loadSession = useCallback(async () => {
    setLoading(true)

    setMessage(null)

    setOfflineMode(false)

    const localSession = readCitizenSession()

    /*
     * Enquanto a geolocalização
     * ainda não foi resolvida,
     * carregamos apenas as
     * ocorrências confirmadas.
     */
    await loadPublicOccurrences(null, radiusKm)

    try {
      const response = await api.me()

      if (response.data.role === "CITIZEN") {
        setUser(response.data)

        saveCitizenSession(response.data)

        setOfflineMode(false)

        return
      }

      setUser(null)

      clearCitizenSession()
    } catch (error) {
      if (isApiNetworkError(error) && localSession) {
        setUser(localSession)

        setOfflineMode(true)

        setMessage(
          "Modo offline. Voce pode registrar ocorrencias; elas serao sincronizadas quando a conexao voltar."
        )

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
  }, [loadPublicOccurrences, radiusKm])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState("UNSUPPORTED")

      return
    }

    setLocationState("LOCATING")

    navigator.geolocation.getCurrentPosition(
      (current) => {
        const nextPosition: CitizenPosition = {
          latitude: current.coords.latitude,

          longitude: current.coords.longitude,

          accuracyM: Number.isFinite(current.coords.accuracy)
            ? Math.round(current.coords.accuracy)
            : null
        }

        setPosition(nextPosition)

        setLocationState("AVAILABLE")
      },

      () => {
        setLocationState("DENIED")

        setPosition(null)
      },

      {
        enableHighAccuracy: true,

        timeout: 8000,

        maximumAge: 60_000
      }
    )
  }, [])

  useEffect(() => {
    if (!position) {
      return
    }

    void loadPublicOccurrences(position, radiusKm)
  }, [loadPublicOccurrences, position, radiusKm])

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (mode === "register") {
      if (!isStrongPassword(password)) {
        setMessage("A senha ainda não atende a todos os requisitos.")

        return
      }

      if (password !== passwordConfirmation) {
        setMessage("As senhas não coincidem.")

        return
      }
    }

    try {
      const response =
        mode === "login"
          ? await api.login({
              email,
              password
            })
          : await api.registerCitizen({
              name,
              email,
              password
            })

      if (response.data.role !== "CITIZEN") {
        setMessage("Esta tela aceita somente conta de cidadão.")

        return
      }

      if (mode === "register") {
        await api.login({
          email,
          password
        })
      }

      setUser(response.data)

      saveCitizenSession(response.data)

      setOfflineMode(false)

      setPassword("")

      setPasswordConfirmation("")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível autenticar."
      )
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined)

    clearCitizenSession()

    setUser(null)

    setOfflineMode(false)

    setMessage(null)

    setPassword("")

    setPasswordConfirmation("")
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode)

    setPassword("")

    setPasswordConfirmation("")

    setMessage(null)
  }

  function locationLabel() {
    if (locationState === "LOCATING") {
      return "Obtendo sua localização..."
    }

    if (locationState === "AVAILABLE" && position) {
      return position.accuracyM !== null
        ? `Sua localização · precisão aproximada ${position.accuracyM} m`
        : "Sua localização"
    }

    if (locationState === "DENIED") {
      return "Localização não autorizada"
    }

    return "Geolocalização não disponível"
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
        <ShellHeader
          title="Kamara"
          subtitle="Registro cidadão e mapa público"
        />

        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-600">
          Carregando dados da API...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
      <ShellHeader title="Kamara" subtitle="Registro cidadão e mapa público" />

      {offlineMode && user && (
        <section className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />

            <div>
              <p className="font-medium">Modo offline</p>

              <p className="mt-1 text-xs">
                A sessão foi validada anteriormente neste dispositivo. Novos
                registros ficarão armazenados localmente até a conexão voltar.
              </p>
            </div>
          </div>
        </section>
      )}

      {!user && (
        <section className="border-b border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserRound className="h-4 w-4 text-emerald-700" />
            Acesso do cidadão
          </div>

          <form onSubmit={submitAuth} className="space-y-3">
            {mode === "register" && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Nome
                </span>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                E-mail
              </span>

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="voce@exemplo.com"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                required
              />
            </label>

            <PasswordField
              label="Senha"
              value={password}
              onChange={setPassword}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? PASSWORD_MIN_LENGTH : undefined}
              maxLength={PASSWORD_MAX_LENGTH}
              placeholder={
                mode === "register"
                  ? "Crie uma senha forte"
                  : "Digite sua senha"
              }
            />

            {mode === "register" && (
              <>
                <PasswordRequirements password={password} />

                <PasswordField
                  label="Confirmar senha"
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  placeholder="Digite novamente a senha"
                />

                {passwordConfirmation && password !== passwordConfirmation && (
                  <p className="text-xs text-red-600">
                    As senhas ainda não coincidem.
                  </p>
                )}
              </>
            )}

            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}

            {message && (
              <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
            >
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <button
              type="button"
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {mode === "login" ? "Criar nova conta" : "Já tenho conta"}
            </button>
          </form>
        </section>
      )}

      {user && (
        <section className="flex items-center justify-between border-b border-slate-200 bg-white p-4 text-sm">
          <span className="font-medium text-slate-700">
            {user.name ?? user.email}
          </span>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </section>
      )}

      <section className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2">
            {locationState === "AVAILABLE" ? (
              <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            )}

            <div>
              <p className="text-sm font-medium text-slate-700">
                {locationLabel()}
              </p>

              {locationState !== "AVAILABLE" && (
                <p className="mt-1 text-xs text-slate-500">
                  As ocorrências confirmadas serão mostradas sem filtro de
                  proximidade.
                </p>
              )}
            </div>
          </div>

          <label className="shrink-0 text-xs text-slate-600">
            <span className="mb-1 block">Raio</span>

            <select
              value={radiusKm}
              disabled={!position}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
            >
              {RADIUS_OPTIONS.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>
          </label>
        </div>

        {position && publicMeta?.radiusKm && (
          <p className="mt-2 text-xs text-slate-500">
            {publicMeta.count} ocorrência(s) confirmada(s) em até{" "}
            {publicMeta.radiusKm} km.
          </p>
        )}

        {publicMessage && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            {publicMessage}
          </p>
        )}
      </section>

      <section className="relative h-[300px] border-b border-slate-200 bg-slate-100">
        <PublicMap
          occurrences={publicOccurrences}
          userPosition={
            position
              ? {
                  latitude: position.latitude,

                  longitude: position.longitude
                }
              : null
          }
          radiusKm={radiusKm}
        />
      </section>

      <section className="flex-1 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {position
                ? "Ocorrências públicas próximas"
                : "Ocorrências públicas confirmadas"}
            </h1>

            <p className="text-xs text-slate-500">
              A posição exibida no mapa é aproximada para preservar privacidade.
            </p>
          </div>

          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
        </div>

        {publicOccurrences.length ? (
          publicOccurrences.map((occurrence) => {
            const type = categoryType(occurrence.category)

            return (
              <article
                key={occurrence.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${categoryColor(type)}18`,

                      color: categoryColor(type)
                    }}
                  >
                    <CategoryIcon type={type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h2 className="line-clamp-1 text-sm font-semibold text-slate-900">
                        {occurrence.category?.name ?? "Ocorrência confirmada"}
                      </h2>

                      <StatusBadge status={occurrence.status} />
                    </div>

                    {occurrence.description && (
                      <p className="line-clamp-2 text-xs text-slate-600">
                        {occurrence.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {occurrence.distanceKm !== null && (
                        <span>{occurrence.distanceKm} km de você</span>
                      )}

                      <span>Posição aproximada</span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {position
              ? `Nenhuma ocorrência confirmada encontrada no raio de ${radiusKm} km.`
              : "Nenhuma ocorrência pública confirmada retornada pela API."}
          </p>
        )}
      </section>

      <nav className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-white p-4">
        <Link
          href={user ? "/report" : "/"}
          className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold shadow-sm ${
            user ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          <Camera className="h-5 w-5" />
          Registrar
        </Link>

        <Link
          href={user ? "/history" : "/"}
          className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-semibold ${
            user
              ? "border-slate-300 text-slate-700"
              : "border-slate-200 text-slate-400"
          }`}
        >
          <History className="h-5 w-5" />
          Histórico
        </Link>
      </nav>
    </main>
  )
}
