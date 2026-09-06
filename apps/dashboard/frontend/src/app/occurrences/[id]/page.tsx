"use client"

import { AuthenticatedMediaImage } from "@/components/authenticated-media-image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ArrowLeft,
  Brain,
  Image as ImageIcon,
  MapPin,
  UserRound
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { CategoryIcon } from "@/components/category-icon"
import { StatusBadge } from "@/components/badges"

import { api, ApiCategory, ApiMedia, ApiOccurrence } from "@/lib/api"

import {
  categoryType,
  occurrenceLatitude,
  occurrenceLongitude
} from "@/lib/category"

import { urgencyLabels } from "@/lib/labels"

export default function OccurrenceDetailPage({
  params
}: {
  params: {
    id: string
  }
}) {
  const [occurrence, setOccurrence] = useState<ApiOccurrence | null>(null)

  const [media, setMedia] = useState<ApiMedia[]>([])

  const [categories, setCategories] = useState<ApiCategory[]>([])

  const [selectedCategoryId, setSelectedCategoryId] = useState("")

  const [message, setMessage] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    try {
      const [occurrenceResponse, mediaResponse, categoryResponse] =
        await Promise.all([
          api.getManagerOccurrence(params.id),
          api.listOccurrenceMedia(params.id),
          api.listCategories()
        ])

      setOccurrence(occurrenceResponse.data)

      setMedia(mediaResponse.data)

      setCategories(categoryResponse.data)

      setSelectedCategoryId(
        occurrenceResponse.data.confirmedCategoryId ??
          occurrenceResponse.data.aiClassification?.predictedCategory?.id ??
          ""
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar a ocorrencia."
      )
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  async function submitDecision(
    decision: "CONFIRM" | "CORRECT" | "REJECT" | "REQUEST_MORE_INFO"
  ) {
    if (!occurrence) {
      return
    }

    setSubmitting(true)

    setMessage(null)

    try {
      if (decision === "CONFIRM" || decision === "CORRECT") {
        if (!selectedCategoryId) {
          throw new Error("Selecione uma categoria.")
        }

        await api.validateOccurrence(occurrence.id, {
          decision,

          finalCategoryId: selectedCategoryId,

          note:
            decision === "CONFIRM"
              ? "Ocorrencia confirmada pelo dashboard."
              : "Categoria corrigida pelo dashboard."
        })
      }

      if (decision === "REJECT") {
        const rejectionReason = window.prompt("Motivo da rejeicao")

        if (!rejectionReason) {
          return
        }

        await api.validateOccurrence(occurrence.id, {
          decision,

          rejectionReason
        })
      }

      if (decision === "REQUEST_MORE_INFO") {
        const informationRequestMessage = window.prompt(
          "Mensagem para o cidadao"
        )

        if (!informationRequestMessage) {
          return
        }

        await api.validateOccurrence(occurrence.id, {
          decision,

          informationRequestMessage
        })
      }

      await load()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel registrar a decisao."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const category =
    occurrence?.confirmedCategory ??
    occurrence?.aiClassification?.predictedCategory ??
    null

  const primaryImage = useMemo(
    () =>
      media.find(
        (item) =>
          item.type === "IMAGE" && item.origin === "INITIAL" && item.isPrimary
      ) ??
      media.find(
        (item) => item.type === "IMAGE" && item.origin === "INITIAL"
      ) ??
      null,

    [media]
  )

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao mapa
        </Link>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Detalhes da ocorrencia
            </h1>

            <p className="text-sm text-slate-500">ID {params.id}</p>
          </div>

          {occurrence && <StatusBadge status={occurrence.status} />}
        </div>
      </header>

      <main className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {loading && (
            <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Carregando ocorrencia pela API...
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative flex aspect-video items-center justify-center bg-slate-100">
              {primaryImage ? (
                <AuthenticatedMediaImage
                  src={primaryImage.contentUrl}
                  alt="Midia da ocorrencia"
                  sizes="(min-width: 1280px) 60vw, 100vw"
                  className="object-contain"
                />
              ) : (
                <ImageIcon className="h-20 w-20 text-slate-400" />
              )}
            </div>
          </div>

          {occurrence && (
            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <CategoryIcon type={categoryType(category)} />
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">
                      Classificacao atual/sugerida
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900">
                      {category?.name ?? "Sem classificacao"}
                    </h2>
                  </div>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {occurrence.description}
              </p>
            </article>
          )}

          <article className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <Brain className="h-5 w-5 text-blue-700" />
              Pre-analise da IA
            </div>

            {occurrence?.aiClassification ? (
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  {occurrence.aiClassification.explanationSimple ??
                    "Resultado de IA registrado."}
                </p>

                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">Confianca</p>

                  <p className="text-2xl font-semibold text-blue-800">
                    {occurrence.aiClassification.confidence === null
                      ? "N/A"
                      : `${Math.round(
                          occurrence.aiClassification.confidence * 100
                        )}%`}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Modelo{" "}
                    {occurrence.aiClassification.modelVersion?.name ??
                      "registrado"}{" "}
                    {occurrence.aiClassification.modelVersion?.version ?? ""}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                Pre-analise indisponivel. A ocorrencia permanece valida para
                analise humana.
              </p>
            )}
          </article>

          {occurrence &&
            occurrence.informationRequests &&
            occurrence.informationRequests.length > 0 && (
              <article className="rounded-lg border border-orange-200 bg-orange-50 p-5">
                <h2 className="mb-4 font-semibold text-slate-900">
                  Solicitações e complementos
                </h2>

                <div className="space-y-4">
                  {occurrence.informationRequests.map((request) => {
                    const complementMedia =
                      request.complement === null
                        ? []
                        : media.filter(
                            (item) =>
                              item.complementId === request.complement?.id
                          )

                    return (
                      <div
                        key={request.id}
                        className="rounded-lg border border-orange-100 bg-white p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
                              Pedido do gestor
                            </p>

                            <p className="mt-1 text-sm text-slate-800">
                              {request.message}
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {request.status === "OPEN"
                              ? "Aguardando resposta"
                              : request.status === "ANSWERED"
                                ? "Respondido"
                                : "Cancelado"}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500">
                          Solicitado em{" "}
                          {new Date(request.createdAt).toLocaleString("pt-BR")}
                        </p>

                        {request.complement ? (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                              Resposta do cidadão
                            </p>

                            {request.complement.text ? (
                              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                                {request.complement.text}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">
                                Resposta enviada sem texto.
                              </p>
                            )}

                            <p className="mt-2 text-xs text-slate-500">
                              Respondido em{" "}
                              {new Date(
                                request.complement.createdAt
                              ).toLocaleString("pt-BR")}
                            </p>

                            {complementMedia.length > 0 && (
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {complementMedia
                                  .filter((item) => item.type === "IMAGE")
                                  .map((item) => (
                                    <div
                                      key={item.id}
                                      className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                                    >
                                      <AuthenticatedMediaImage
                                        src={item.contentUrl}
                                        alt="Imagem complementar enviada pelo cidadão"
                                        sizes="400px"
                                        className="object-contain"
                                      />
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
                            O cidadão ainda não respondeu a esta solicitação.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            )}
        </section>

        {occurrence && (
          <aside className="space-y-6">
            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-slate-900">Metadados</h2>

              <dl className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />

                  <div>
                    <dt className="text-slate-500">Coordenadas</dt>

                    <dd className="font-medium text-slate-800">
                      {occurrenceLatitude(occurrence)},{" "}
                      {occurrenceLongitude(occurrence)}
                    </dd>
                  </div>
                </div>

                <div className="flex gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 text-slate-500" />

                  <div>
                    <dt className="text-slate-500">Origem</dt>

                    <dd className="font-medium text-slate-800">
                      {occurrence.reporterLabel ?? "Cidadao autenticado"}
                    </dd>
                  </div>
                </div>

                <div>
                  <dt className="text-slate-500">Urgencia</dt>

                  <dd className="font-medium text-slate-800">
                    {urgencyLabels[occurrence.urgency]}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Vitimas/risco humano</dt>

                  <dd className="font-medium text-slate-800">
                    {occurrence.humanRisk ? "Sim" : "Nao"}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-slate-900">
                Decisao do gestor
              </h2>

              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Categoria final
                </span>

                <select
                  value={selectedCategoryId}
                  onChange={(event) =>
                    setSelectedCategoryId(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">Selecione uma categoria</option>

                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <button
                  disabled={submitting || occurrence.status !== "UNDER_REVIEW"}
                  onClick={() => void submitDecision("CONFIRM")}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Confirmar ocorrencia
                </button>

                <button
                  disabled={submitting || occurrence.status !== "UNDER_REVIEW"}
                  onClick={() => void submitDecision("CORRECT")}
                  className="w-full rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                >
                  Corrigir classificacao
                </button>

                <button
                  disabled={submitting || occurrence.status !== "UNDER_REVIEW"}
                  onClick={() => void submitDecision("REQUEST_MORE_INFO")}
                  className="w-full rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700 disabled:text-slate-400"
                >
                  Solicitar complemento
                </button>

                <button
                  disabled={submitting || occurrence.status !== "UNDER_REVIEW"}
                  onClick={() => void submitDecision("REJECT")}
                  className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:text-slate-400"
                >
                  Rejeitar
                </button>
              </div>
            </article>
          </aside>
        )}
      </main>
    </DashboardShell>
  )
}
