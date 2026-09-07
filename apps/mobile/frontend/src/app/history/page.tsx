"use client"

import Link from "next/link"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  AlertTriangle,
  ChevronRight,
  CloudUpload,
  Image as ImageIcon,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react"

import { StatusBadge } from "@/components/badges"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ProtectedCitizen } from "@/components/protected-citizen"

import {
  api,
  isApiNetworkError,
  type ApiInformationRequest,
  type ApiOccurrence
} from "@/lib/api"

import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  listOfflineOccurrences,
  updateOfflineOccurrence,
  type OfflineOccurrenceRecord
} from "@/lib/offline-db"

import {
  syncAllOfflineOccurrences,
  syncOfflineOccurrence
} from "@/lib/offline-sync"

import { urgencyLabels } from "@/lib/labels"

type Notice = {
  type: "error" | "success" | "info"

  text: string
}

function offlineStatusLabel(status: OfflineOccurrenceRecord["syncStatus"]) {
  if (status === "SYNCING") {
    return "Enviando"
  }

  if (status === "ERROR") {
    return "Erro no envio"
  }

  return "Aguardando envio"
}

function offlineStatusClasses(status: OfflineOccurrenceRecord["syncStatus"]) {
  if (status === "SYNCING") {
    return "bg-blue-100 text-blue-800"
  }

  if (status === "ERROR") {
    return "bg-red-100 text-red-800"
  }

  return "bg-amber-100 text-amber-800"
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",

    timeStyle: "short"
  }).format(new Date(value))
}

export default function HistoryPage() {
  const [occurrences, setOccurrences] = useState<ApiOccurrence[]>([])

  const [offlineOccurrences, setOfflineOccurrences] = useState<
    OfflineOccurrenceRecord[]
  >([])

  const [requests, setRequests] = useState<
    Record<string, ApiInformationRequest[]>
  >({})

  const [notice, setNotice] = useState<Notice | null>(null)

  const [loading, setLoading] = useState(true)

  const [online, setOnline] = useState(true)

  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set())

  const [syncingAll, setSyncingAll] = useState(false)

  const loadOffline = useCallback(async () => {
    const records = await listOfflineOccurrences()

    setOfflineOccurrences(records)
  }, [])

  const loadServer = useCallback(async () => {
    const response = await api.listCitizenOccurrences()

    setOccurrences(response.data)

    const requestPairs = await Promise.all(
      response.data
        .filter((item) => item.status === "NEEDS_MORE_INFO")
        .map(
          async (item) =>
            [
              item.id,

              (await api.listInformationRequests(item.id)).data
            ] as const
        )
    )

    setRequests(Object.fromEntries(requestPairs))

    setOnline(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)

    setNotice(null)

    try {
      await loadOffline()

      try {
        await loadServer()
      } catch (error) {
        if (isApiNetworkError(error)) {
          setOnline(false)

          setNotice({
            type: "info",

            text: "Você está sem internet. Seus registros continuam salvos neste aparelho."
          })

          return
        }

        throw error
      }
    } catch (error) {
      setNotice({
        type: "error",

        text:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar seu histórico."
      })
    } finally {
      setLoading(false)
    }
  }, [loadOffline, loadServer])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function handleOffline() {
      setOnline(false)

      setNotice({
        type: "info",

        text: "Você está sem internet. Seus registros continuam disponíveis neste aparelho."
      })
    }

    function handleOnline() {
      void loadServer()
        .then(() => {
          setOnline(true)
        })
        .catch((error) => {
          if (isApiNetworkError(error)) {
            setOnline(false)

            return
          }

          setNotice({
            type: "error",

            text:
              error instanceof Error
                ? error.message
                : "Não foi possível atualizar seus registros."
          })
        })
    }

    window.addEventListener("online", handleOnline)

    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)

      window.removeEventListener("offline", handleOffline)
    }
  }, [loadServer])

  useEffect(() => {
    function handleQueueChanged() {
      void loadOffline().catch(() => undefined)
    }

    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged)

    return () => {
      window.removeEventListener(
        OFFLINE_QUEUE_CHANGED_EVENT,
        handleQueueChanged
      )
    }
  }, [loadOffline])

  async function retryOffline(clientLocalId: string) {
    if (!online) {
      setNotice({
        type: "info",

        text: "Você está sem internet. A ocorrência continua salva neste aparelho."
      })

      return
    }

    setSyncingIds((current) => {
      const next = new Set(current)

      next.add(clientLocalId)

      return next
    })

    setNotice(null)

    try {
      const result = await syncOfflineOccurrence(clientLocalId, {
        force: true
      })

      if (result.status === "SYNCED") {
        setNotice({
          type: "success",

          text: "Ocorrência enviada com sucesso."
        })

        await Promise.all([loadOffline(), loadServer()])

        return
      }

      if (result.status === "PENDING_SYNC") {
        setOnline(false)
      }

      setNotice({
        type: result.status === "ERROR" ? "error" : "info",

        text:
          result.status === "ERROR"
            ? "Não foi possível concluir o envio. Tente novamente."
            : "Sua ocorrência continua salva e será enviada quando possível."
      })

      await loadOffline()
    } catch (error) {
      if (isApiNetworkError(error)) {
        setOnline(false)
      }

      setNotice({
        type: "error",

        text:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a ocorrência."
      })

      await loadOffline().catch(() => undefined)
    } finally {
      setSyncingIds((current) => {
        const next = new Set(current)

        next.delete(clientLocalId)

        return next
      })
    }
  }

  async function syncAll() {
    if (!online) {
      setNotice({
        type: "info",

        text: "Você está sem internet. Seus registros continuam salvos neste aparelho."
      })

      return
    }

    setSyncingAll(true)

    setNotice(null)

    try {
      const results = await syncAllOfflineOccurrences()

      const synchronized = results.filter(
        (result) => result.status === "SYNCED"
      ).length

      const pending = results.filter(
        (result) => result.status === "PENDING_SYNC"
      ).length

      if (pending > 0) {
        setOnline(false)
      }

      setNotice({
        type: pending > 0 ? "info" : "success",

        text:
          pending > 0
            ? `${synchronized} ocorrência(s) enviada(s). ${pending} ainda aguardam uma nova tentativa.`
            : `${synchronized} ocorrência(s) enviada(s).`
      })

      await Promise.all([
        loadOffline(),

        pending === 0 ? loadServer() : Promise.resolve()
      ])
    } catch (error) {
      if (isApiNetworkError(error)) {
        setOnline(false)
      }

      setNotice({
        type: "error",

        text:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar os registros agora."
      })
    } finally {
      setSyncingAll(false)
    }
  }

  async function discardPendingPhoto(record: OfflineOccurrenceRecord) {
    if (!record.photo || !record.serverOccurrenceId) {
      return
    }

    const confirmed = window.confirm(
      "A ocorrência já foi recebida, mas a foto ainda não foi enviada. Deseja continuar sem essa foto?"
    )

    if (!confirmed) {
      return
    }

    try {
      await updateOfflineOccurrence(record.clientLocalId, {
        photo: null,

        syncStatus: "PENDING_SYNC",

        lastError: null
      })

      await retryOffline(record.clientLocalId)
    } catch (error) {
      setNotice({
        type: "error",

        text:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar esse registro."
      })
    }
  }

  const pendingServerIds = useMemo(
    () =>
      new Set(
        offlineOccurrences
          .map((item) => item.serverOccurrenceId)
          .filter((value): value is string => Boolean(value))
      ),
    [offlineOccurrences]
  )

  const visibleServerOccurrences = useMemo(
    () =>
      occurrences.filter((occurrence) => !pendingServerIds.has(occurrence.id)),
    [occurrences, pendingServerIds]
  )

  const orderedServerOccurrences = useMemo(() => {
    return [...visibleServerOccurrences].sort((left, right) => {
      const leftNeedsInfo =
        left.status === "NEEDS_MORE_INFO" &&
        Boolean(requests[left.id]?.some((request) => request.status === "OPEN"))

      const rightNeedsInfo =
        right.status === "NEEDS_MORE_INFO" &&
        Boolean(
          requests[right.id]?.some((request) => request.status === "OPEN")
        )

      if (leftNeedsInfo !== rightNeedsInfo) {
        return leftNeedsInfo ? -1 : 1
      }

      return (
        new Date(right.reportedAt).getTime() -
        new Date(left.reportedAt).getTime()
      )
    })
  }, [visibleServerOccurrences, requests])

  return (
    <ProtectedCitizen nextPath="/history">
      <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24">
        <header className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Minhas ocorrências
              </h1>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                {online ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-emerald-600" />

                    <span>Atualizado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-600" />

                    <span>Sem internet</span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </header>

        <section className="space-y-3 p-4">
          {notice && (
            <p
              className={`rounded-xl border p-3 text-sm ${
                notice.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : notice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {notice.text}
            </p>
          )}

          {loading && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Carregando suas ocorrências...
            </p>
          )}

          {offlineOccurrences.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-950">
                    Registros aguardando envio
                  </p>

                  <p className="mt-1 text-xs text-amber-800">
                    {offlineOccurrences.length} registro(s) ainda precisam ser
                    enviados.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!online || syncingAll}
                  onClick={() => void syncAll()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                >
                  <CloudUpload className="h-4 w-4" />

                  {syncingAll ? "Enviando..." : "Enviar agora"}
                </button>
              </div>
            </div>
          )}

          {offlineOccurrences.map((occurrence) => {
            const syncing =
              syncingIds.has(occurrence.clientLocalId) ||
              occurrence.syncStatus === "SYNCING"

            return (
              <article
                key={occurrence.clientLocalId}
                className={`rounded-xl border p-4 shadow-sm ${
                  occurrence.syncStatus === "ERROR"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {occurrence.serverOccurrenceId
                        ? "Ocorrência aguardando conclusão do envio"
                        : "Ocorrência salva"}
                    </h2>

                    <p className="mt-1 text-xs text-slate-600">
                      {formatDateTime(occurrence.reportedAt)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${offlineStatusClasses(
                      syncing ? "SYNCING" : occurrence.syncStatus
                    )}`}
                  >
                    {syncing
                      ? "Enviando"
                      : offlineStatusLabel(occurrence.syncStatus)}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-slate-700">
                  {occurrence.description}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <dt className="font-medium text-slate-500">Urgência</dt>

                    <dd>{urgencyLabels[occurrence.urgency]}</dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500">
                      Pessoas em risco
                    </dt>

                    <dd>{occurrence.humanRisk ? "Sim" : "Não"}</dd>
                  </div>
                </dl>

                {occurrence.photo && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-2 text-xs text-slate-600">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    Foto adicionada
                  </div>
                )}

                {occurrence.lastError && (
                  <div className="mt-3 flex gap-2 rounded-xl bg-red-100 p-3 text-xs text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />

                    <span>
                      Não foi possível concluir o envio. Tente novamente.
                    </span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!online || syncing}
                    onClick={() => void retryOffline(occurrence.clientLocalId)}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                    />
                    Tentar novamente
                  </button>

                  {occurrence.serverOccurrenceId ? (
                    <Link
                      href={`/occurrences/${occurrence.serverOccurrenceId}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Ver ocorrência
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : !syncing ? (
                    <Link
                      href={`/offline-occurrences/${occurrence.clientLocalId}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      Editar ou cancelar
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : null}

                  {occurrence.syncStatus === "ERROR" &&
                    occurrence.photo &&
                    occurrence.serverOccurrenceId && (
                      <button
                        type="button"
                        disabled={!online || syncing}
                        onClick={() => void discardPendingPhoto(occurrence)}
                        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:text-slate-400"
                      >
                        Continuar sem a foto
                      </button>
                    )}
                </div>
              </article>
            )
          })}

          {orderedServerOccurrences.map((occurrence) => {
            const openRequest = requests[occurrence.id]?.find(
              (item) => item.status === "OPEN"
            )

            return (
              <Link
                key={occurrence.id}
                href={`/occurrences/${occurrence.id}`}
                className={`block rounded-xl border bg-white p-4 shadow-sm transition active:scale-[0.99] ${
                  openRequest
                    ? "border-orange-300 ring-1 ring-orange-100"
                    : "border-slate-200"
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      openRequest
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {openRequest ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <RefreshCw className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {openRequest
                          ? "Precisamos de mais informações"
                          : "Ocorrência registrada"}
                      </h2>

                      <StatusBadge status={occurrence.status} />
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {occurrence.description}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(occurrence.reportedAt)}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="font-medium text-slate-500">Urgência</dt>

                    <dd>{urgencyLabels[occurrence.urgency]}</dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500">
                      Pessoas em risco
                    </dt>

                    <dd>{occurrence.humanRisk ? "Sim" : "Não"}</dd>
                  </div>
                </dl>

                {openRequest && (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs leading-relaxed text-orange-900">
                      {openRequest.message}
                    </p>

                    <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-orange-700">
                      Ver pedido e responder
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                )}

                {!openRequest && (
                  <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-700">
                    Ver detalhes
                    <ChevronRight className="h-4 w-4" />
                  </div>
                )}
              </Link>
            )
          })}

          {!loading &&
            !orderedServerOccurrences.length &&
            !offlineOccurrences.length && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-800">
                  Você ainda não registrou nenhuma ocorrência.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Quando você fizer um registro, poderá acompanhar o andamento
                  por aqui.
                </p>

                <Link
                  href="/report"
                  className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Registrar ocorrência
                </Link>
              </div>
            )}
        </section>

        <MobileBottomNav />
      </main>
    </ProtectedCitizen>
  )
}
