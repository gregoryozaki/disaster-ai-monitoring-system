"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { OccurrenceStatus } from "@kamara/shared-types"

import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  Filter,
  MapPinned,
  RotateCcw,
  ShieldCheck,
  UserRound
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"

import { CategoryIcon } from "@/components/category-icon"

import { StatusBadge } from "@/components/badges"

import {
  api,
  type ApiCategory,
  type ApiOccurrence,
  type ApiUser,
  type ManagerOccurrenceFilters
} from "@/lib/api"

import {
  categoryType,
  occurrenceLatitude,
  occurrenceLongitude
} from "@/lib/category"

const ManagerMap = dynamic(() => import("@/components/manager-map"), {
  ssr: false,

  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-100 text-sm text-slate-500">
      Carregando mapa operacional...
    </div>
  )
})

type HumanRiskFilter = "" | "YES" | "NO"

const operationalStatuses: Array<{
  value: OccurrenceStatus
  label: string
}> = [
  {
    value: "UNDER_REVIEW",
    label: "Em análise"
  },

  {
    value: "NEEDS_MORE_INFO",
    label: "Complemento solicitado"
  },

  {
    value: "CONFIRMED",
    label: "Confirmada"
  },

  {
    value: "REJECTED",
    label: "Rejeitada"
  },

  {
    value: "SYNCED",
    label: "Sincronizada"
  },

  {
    value: "PENDING_SYNC",
    label: "Sincronização pendente"
  },

  {
    value: "DRAFT",
    label: "Rascunho"
  }
]

function occurrenceCategory(occurrence: ApiOccurrence) {
  return (
    occurrence.confirmedCategory ??
    occurrence.aiClassification?.predictedCategory ??
    null
  )
}

function hasValidCoordinates(occurrence: ApiOccurrence) {
  const latitude = occurrenceLatitude(occurrence)

  const longitude = occurrenceLongitude(occurrence)

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  )
}

export default function DashboardHomePage() {
  const [user, setUser] = useState<ApiUser | null>(null)

  const [occurrences, setOccurrences] = useState<ApiOccurrence[]>([])

  const [categories, setCategories] = useState<ApiCategory[]>([])

  const [status, setStatus] = useState<OccurrenceStatus | "">("")

  const [categoryId, setCategoryId] = useState("")

  const [dateFrom, setDateFrom] = useState("")

  const [dateTo, setDateTo] = useState("")

  const [humanRisk, setHumanRisk] = useState<HumanRiskFilter>("")

  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<
    string | null
  >(null)

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [sessionLoading, setSessionLoading] = useState(true)

  const [occurrencesLoading, setOccurrencesLoading] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  const occurrenceRefs = useRef<Record<string, HTMLDivElement | null>>({})

  /*
   * Identifica a consulta mais recente.
   *
   * Se o gestor alterar vários filtros rapidamente,
   * uma resposta antiga não deve sobrescrever uma
   * consulta mais nova.
   */
  const occurrenceRequestVersion = useRef(0)

  const managerFilters = useMemo<ManagerOccurrenceFilters>(
    () => ({
      status: status || undefined,

      categoryId: categoryId || undefined,

      humanRisk: humanRisk === "" ? undefined : humanRisk === "YES",

      dateFrom: dateFrom || undefined,

      dateTo: dateTo || undefined
    }),
    [status, categoryId, humanRisk, dateFrom, dateTo]
  )

  const loadSession = useCallback(async () => {
    setSessionLoading(true)

    setMessage(null)

    try {
      const me = await api.me()

      if (!["MANAGER", "ADMIN"].includes(me.data.role)) {
        setUser(null)

        setMessage("Esta área exige perfil de gestor ou administrador.")

        return
      }

      const categoryResponse = await api.listCategories()

      setCategories(categoryResponse.data)

      setUser(me.data)
    } catch (error) {
      setUser(null)

      setOccurrences([])

      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o dashboard."
      )
    } finally {
      setSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const loadOccurrences = useCallback(async () => {
    if (!user) {
      return
    }

    const requestVersion = ++occurrenceRequestVersion.current

    setOccurrencesLoading(true)

    setMessage(null)

    try {
      const response = await api.listManagerOccurrences(managerFilters)

      if (requestVersion !== occurrenceRequestVersion.current) {
        return
      }

      setOccurrences(response.data)
    } catch (error) {
      if (requestVersion !== occurrenceRequestVersion.current) {
        return
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as ocorrências."
      )
    } finally {
      if (requestVersion === occurrenceRequestVersion.current) {
        setOccurrencesLoading(false)
      }
    }
  }, [user, managerFilters])

  useEffect(() => {
    void loadOccurrences()
  }, [loadOccurrences])

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSessionLoading(true)

    setMessage(null)

    try {
      const response = await api.login({
        email,
        password
      })

      if (!["MANAGER", "ADMIN"].includes(response.data.role)) {
        await api.logout().catch(() => undefined)

        setUser(null)

        setMessage("Use uma conta de gestor ou administrador.")

        return
      }

      await loadSession()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível autenticar."
      )
    } finally {
      setSessionLoading(false)
    }
  }

  const visibleWithCoordinates = useMemo(
    () => occurrences.filter(hasValidCoordinates),
    [occurrences]
  )

  /*
   * Se a ocorrência selecionada deixar de fazer
   * parte do resultado depois de um filtro,
   * a seleção é descartada.
   */
  useEffect(() => {
    if (!selectedOccurrenceId) {
      return
    }

    const stillVisible = occurrences.some(
      (occurrence) => occurrence.id === selectedOccurrenceId
    )

    if (!stillVisible) {
      setSelectedOccurrenceId(null)
    }
  }, [occurrences, selectedOccurrenceId])

  const underReview = useMemo(
    () => occurrences.filter((item) => item.status === "UNDER_REVIEW"),
    [occurrences]
  )

  const confirmed = useMemo(
    () => occurrences.filter((item) => item.status === "CONFIRMED"),
    [occurrences]
  )

  const needsMoreInfo = useMemo(
    () => occurrences.filter((item) => item.status === "NEEDS_MORE_INFO"),
    [occurrences]
  )

  const selectFromMap = useCallback((occurrenceId: string) => {
    setSelectedOccurrenceId(occurrenceId)

    window.requestAnimationFrame(() => {
      occurrenceRefs.current[occurrenceId]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      })
    })
  }, [])

  function selectFromList(occurrenceId: string) {
    setSelectedOccurrenceId(occurrenceId)
  }

  function clearFilters() {
    setStatus("")

    setCategoryId("")

    setDateFrom("")

    setDateTo("")

    setHumanRisk("")

    setSelectedOccurrenceId(null)
  }

  if (!user) {
    return (
      <DashboardShell>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <UserRound className="h-5 w-5 text-emerald-700" />
              Acesso do gestor
            </div>

            <form onSubmit={submitLogin} className="space-y-3">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="E-mail"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />

              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Senha"
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />

              {message && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {message}
                </p>
              )}

              <button
                disabled={sessionLoading}
                className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                {sessionLoading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </section>
        </main>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Mapa operacional
            </h1>

            <p className="text-sm text-slate-500">
              Triagem geográfica, filtros e acompanhamento das ocorrências
              registradas.
            </p>
          </div>

          <button
            onClick={() => void loadOccurrences()}
            disabled={occurrencesLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400"
          >
            <RotateCcw className="h-4 w-4" />

            {occurrencesLoading ? "Atualizando..." : "Atualizar dados"}
          </button>
        </div>
      </header>

      {message && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <main className="grid min-h-[calc(100vh-81px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="border-r border-slate-200 bg-white p-5 lg:overflow-auto">
          <div className="mb-5 flex items-center gap-2 font-semibold text-slate-800">
            <Filter className="h-5 w-5" />
            Filtros operacionais
          </div>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Status
              </span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as OccurrenceStatus | "")
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Todos</option>

                {operationalStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Categoria
              </span>

              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Todas</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Risco humano
              </span>

              <select
                value={humanRisk}
                onChange={(event) =>
                  setHumanRisk(event.target.value as HumanRiskFilter)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Todos</option>

                <option value="YES">Sim</option>

                <option value="NO">Não</option>
              </select>
            </label>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <CalendarDays className="h-4 w-4" />
                Período do relato
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-slate-500">
                  De
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="block text-xs text-slate-500">
                  Até
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {occurrencesLoading ? (
              <span>Consultando ocorrências no servidor...</span>
            ) : (
              <>
                <strong>{occurrences.length}</strong> ocorrência(s) retornada(s)
                pelos filtros atuais.
              </>
            )}
          </div>

          {occurrences.length !== visibleWithCoordinates.length && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />

              <span>
                {occurrences.length - visibleWithCoordinates.length}{" "}
                ocorrência(s) não possuem coordenadas válidas para o mapa.
              </span>
            </div>
          )}
        </aside>

        <section className="relative min-h-[520px] bg-slate-100">
          <ManagerMap
            occurrences={visibleWithCoordinates}
            selectedOccurrenceId={selectedOccurrenceId}
            onSelectOccurrence={selectFromMap}
          />

          <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <MapPinned className="h-4 w-4 text-emerald-700" />
              {visibleWithCoordinates.length} ponto(s) no mapa
            </div>

            <p className="mt-1 text-slate-500">
              Contorno = status · preenchimento = categoria
            </p>
          </div>
        </section>

        <aside className="border-l border-slate-200 bg-white p-5 lg:max-h-[calc(100vh-81px)] lg:overflow-auto">
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-xs text-yellow-800">Em análise</p>

              <p className="text-2xl font-semibold text-yellow-800">
                {underReview.length}
              </p>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs text-orange-800">Complemento</p>

              <p className="text-2xl font-semibold text-orange-800">
                {needsMoreInfo.length}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800">Confirmadas</p>

              <p className="text-2xl font-semibold text-emerald-800">
                {confirmed.length}
              </p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Ocorrências</h2>

            <ShieldCheck className="h-5 w-5 text-emerald-700" />
          </div>

          {occurrencesLoading && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Atualizando ocorrências...
            </p>
          )}

          {!occurrencesLoading && occurrences.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Nenhuma ocorrência corresponde aos filtros selecionados.
            </p>
          )}

          <div className="space-y-3">
            {occurrences.map((occurrence) => {
              const category = occurrenceCategory(occurrence)

              const latitude = occurrenceLatitude(occurrence)

              const longitude = occurrenceLongitude(occurrence)

              const selected = occurrence.id === selectedOccurrenceId

              return (
                <div
                  key={occurrence.id}
                  ref={(element) => {
                    occurrenceRefs.current[occurrence.id] = element
                  }}
                  onClick={() => selectFromList(occurrence.id)}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-100"
                      : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                      <CategoryIcon
                        type={categoryType(category)}
                        className="h-4 w-4 shrink-0"
                      />

                      <span className="line-clamp-1">
                        {category?.name ?? "Sem classificação"}
                      </span>
                    </div>

                    <StatusBadge status={occurrence.status} />
                  </div>

                  {occurrence.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {occurrence.description}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>
                      <span className="block font-medium text-slate-600">
                        Relatado em
                      </span>

                      {new Date(occurrence.reportedAt).toLocaleString("pt-BR")}
                    </div>

                    <div>
                      <span className="block font-medium text-slate-600">
                        Risco humano
                      </span>

                      {occurrence.humanRisk ? "Sim" : "Não"}
                    </div>
                  </div>

                  {hasValidCoordinates(occurrence) && (
                    <div className="mt-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        Coordenadas operacionais:
                      </span>{" "}
                      {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </div>
                  )}

                  {occurrence.aiClassification &&
                    occurrence.aiClassification.confidence !== null && (
                      <div className="mt-2 text-xs text-blue-700">
                        Confiança da pré-análise:{" "}
                        <strong>
                          {Math.round(
                            occurrence.aiClassification.confidence * 100
                          )}
                          %
                        </strong>
                      </div>
                    )}

                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/occurrences/${occurrence.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver detalhes
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </main>
    </DashboardShell>
  )
}
