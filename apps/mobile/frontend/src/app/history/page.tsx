"use client"

import Link from "next/link"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  AlertTriangle,
  ArrowLeft,
  CloudUpload,
  Image as ImageIcon,
  RefreshCw,
  Send,
  Wifi,
  WifiOff
} from "lucide-react"

import { StatusBadge } from "@/components/badges"

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
    return "Sincronizando"
  }

  if (status === "ERROR") {
    return "Erro"
  }

  return "Pendente"
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

    /*
     * Uma resposta efetiva da API
     * é evidência melhor de
     * conectividade do que apenas
     * navigator.onLine.
     */
    setOnline(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)

    setNotice(null)

    try {
      /*
       * A fila local é carregada
       * sempre, independentemente
       * da disponibilidade da API.
       */
      await loadOffline()

      try {
        await loadServer()
      } catch (error) {
        if (isApiNetworkError(error)) {
          setOnline(false)

          setNotice({
            type: "info",

            text: "Sem conexao com o servidor. Os registros armazenados no dispositivo continuam disponiveis e serao sincronizados quando a conexao voltar."
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
            : "Nao foi possivel carregar o historico."
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

        text: "Sem conexao com o servidor. Os registros armazenados no dispositivo continuam disponiveis."
      })
    }

    function handleOnline() {
      /*
       * Não marcamos Online apenas
       * porque o navegador disparou
       * o evento.
       *
       * A API precisa responder.
       */
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
                : "Nao foi possivel atualizar os dados do servidor."
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

  async function answerRequest(occurrenceId: string, requestId: string) {
    if (!online) {
      setNotice({
        type: "error",

        text: "Conecte-se a internet para responder ao pedido de complemento."
      })

      return
    }

    const text = window.prompt("Resposta ao gestor")

    if (!text?.trim()) {
      return
    }

    try {
      await api.answerInformationRequest(occurrenceId, requestId, {
        text: text.trim()
      })

      setNotice({
        type: "success",

        text: "Complemento enviado ao gestor."
      })

      await loadServer()
    } catch (error) {
      if (isApiNetworkError(error)) {
        setOnline(false)
      }

      setNotice({
        type: "error",

        text:
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar o complemento."
      })
    }
  }

  async function retryOffline(clientLocalId: string) {
    if (!online) {
      setNotice({
        type: "info",

        text: "Sem conexao com o servidor. A ocorrencia continua salva no dispositivo."
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

          text: "Ocorrencia sincronizada com sucesso."
        })

        await Promise.all([loadOffline(), loadServer()])

        return
      }

      if (result.status === "PENDING_SYNC") {
        setOnline(false)
      }

      setNotice({
        type: result.status === "ERROR" ? "error" : "info",

        text: result.error ?? "A ocorrencia continua aguardando sincronizacao."
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
            : "Nao foi possivel sincronizar a ocorrencia."
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

        text: "Sem conexao com o servidor. As ocorrencias continuam armazenadas no dispositivo."
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
            ? `${synchronized} ocorrencia(s) sincronizada(s); ${pending} ainda aguardam nova tentativa.`
            : `${synchronized} ocorrencia(s) sincronizada(s).`
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
            : "Nao foi possivel processar a fila de sincronizacao."
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
      "A ocorrencia ja foi recebida pelo servidor, mas a foto nao foi sincronizada. Deseja descartar apenas a foto pendente e concluir a sincronizacao do relato?"
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
            : "Nao foi possivel atualizar o registro local."
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

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Meu acompanhamento
            </h1>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              {online ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                  Offline
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Atualizar
          </button>
        </div>
      </header>

      <section className="space-y-3 p-4">
        {notice && (
          <p
            className={`rounded-lg p-3 text-sm ${
              notice.type === "error"
                ? "bg-red-50 text-red-700"
                : notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-blue-50 text-blue-800"
            }`}
          >
            {notice.text}
          </p>
        )}

        {loading && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Carregando historico...
          </p>
        )}

        {offlineOccurrences.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Pendencias de sincronizacao
                </p>

                <p className="text-xs text-amber-800">
                  {offlineOccurrences.length} registro(s) ainda possuem dados
                  locais.
                </p>
              </div>

              <button
                disabled={!online || syncingAll}
                onClick={() => void syncAll()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
              >
                <CloudUpload className="h-4 w-4" />

                {syncingAll ? "Enviando..." : "Sincronizar"}
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
              className={`rounded-lg border p-4 shadow-sm ${
                occurrence.syncStatus === "ERROR"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {occurrence.serverOccurrenceId
                      ? "Registro recebido; sincronizacao incompleta"
                      : "Registro salvo no dispositivo"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-600">
                    {new Date(occurrence.reportedAt).toLocaleString("pt-BR")}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${offlineStatusClasses(
                    syncing ? "SYNCING" : occurrence.syncStatus
                  )}`}
                >
                  {syncing
                    ? "Sincronizando"
                    : offlineStatusLabel(occurrence.syncStatus)}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-slate-700">
                {occurrence.description}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <dt className="font-medium text-slate-500">Urgencia</dt>

                  <dd>{urgencyLabels[occurrence.urgency]}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-500">Risco humano</dt>

                  <dd>{occurrence.humanRisk ? "Sim" : "Nao"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-500">Localizacao</dt>

                  <dd>
                    {occurrence.latitude}, {occurrence.longitude}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-500">Tentativas</dt>

                  <dd>{occurrence.attemptCount}</dd>
                </div>
              </dl>

              {occurrence.photo && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 p-2 text-xs text-slate-600">
                  <ImageIcon className="h-4 w-4" />

                  <span className="min-w-0 truncate">
                    Foto armazenada: {occurrence.photo.name}
                  </span>
                </div>
              )}

              {occurrence.serverOccurrenceId && (
                <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
                  O relato ja possui identificador no servidor. A pendencia
                  restante sera reconciliada sem criar outra ocorrencia.
                </p>
              )}

              {occurrence.lastError && (
                <div className="mt-3 flex gap-2 rounded-lg bg-red-100 p-3 text-xs text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />

                  <span>{occurrence.lastError}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={!online || syncing}
                  onClick={() => void retryOffline(occurrence.clientLocalId)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                  />
                  Tentar novamente
                </button>

                {occurrence.syncStatus === "ERROR" &&
                  occurrence.photo &&
                  occurrence.serverOccurrenceId && (
                    <button
                      disabled={!online || syncing}
                      onClick={() => void discardPendingPhoto(occurrence)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:text-slate-400"
                    >
                      Descartar foto pendente
                    </button>
                  )}
              </div>
            </article>
          )
        })}

        {visibleServerOccurrences.map((occurrence) => {
          const openRequest = requests[occurrence.id]?.find(
            (item) => item.status === "OPEN"
          )

          return (
            <article
              key={occurrence.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <RefreshCw className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Ocorrencia enviada
                    </h2>

                    <StatusBadge status={occurrence.status} />
                  </div>

                  <p className="line-clamp-2 text-xs text-slate-600">
                    {occurrence.description}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <dt className="font-medium text-slate-500">Urgencia</dt>

                  <dd>{urgencyLabels[occurrence.urgency]}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-500">Risco humano</dt>

                  <dd>{occurrence.humanRisk ? "Sim" : "Nao"}</dd>
                </div>
              </dl>

              {openRequest && (
                <button
                  disabled={!online}
                  onClick={() =>
                    void answerRequest(occurrence.id, openRequest.id)
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                >
                  <Send className="h-4 w-4" />
                  Enviar complemento
                </button>
              )}
            </article>
          )
        })}

        {!loading &&
          !visibleServerOccurrences.length &&
          !offlineOccurrences.length && (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Nenhuma ocorrencia no historico.
            </p>
          )}
      </section>
    </main>
  )
}
