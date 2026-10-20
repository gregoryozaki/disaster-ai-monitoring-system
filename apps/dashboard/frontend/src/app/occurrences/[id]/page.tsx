"use client"

import Link from "next/link"

import { useParams } from "next/navigation"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ArrowLeft,
  Brain,
  Image as ImageIcon,
  MapPin,
  UserRound
} from "lucide-react"

import { AuthenticatedMediaImage } from "@/components/authenticated-media-image"

import { StatusBadge } from "@/components/badges"

import { CategoryIcon } from "@/components/category-icon"

import { DashboardShell } from "@/components/dashboard-shell"

import { DecisionDialog } from "@/components/decision-dialog"

import {
  api,
  type ApiCategory,
  type ApiMedia,
  type ApiOccurrence
} from "@/lib/api"

import {
  categoryType,
  occurrenceLatitude,
  occurrenceLongitude
} from "@/lib/category"

import { urgencyLabels } from "@/lib/labels"

type ManagerDecision = "CONFIRM" | "CORRECT" | "REJECT" | "REQUEST_MORE_INFO"

export default function OccurrenceDetailPage() {
  const params = useParams<{
    id: string
  }>()

  const [occurrence, setOccurrence] = useState<ApiOccurrence | null>(null)

  const [media, setMedia] = useState<ApiMedia[]>([])

  const [categories, setCategories] = useState<ApiCategory[]>([])

  const [selectedCategoryId, setSelectedCategoryId] = useState("")

  const [message, setMessage] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  const [pendingDecision, setPendingDecision] =
    useState<ManagerDecision | null>(null)

  const [rejectionReason, setRejectionReason] = useState("")

  const [informationRequestMessage, setInformationRequestMessage] = useState("")

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
          : "Não foi possível carregar a ocorrência."
      )
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  const category =
    occurrence?.confirmedCategory ??
    occurrence?.aiClassification?.predictedCategory ??
    null

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  )

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

  function closeDecisionDialog() {
    if (submitting) {
      return
    }

    setPendingDecision(null)

    setRejectionReason("")

    setInformationRequestMessage("")
  }

  function openDecision(decision: ManagerDecision) {
    setMessage(null)

    if (!occurrence || occurrence.status !== "UNDER_REVIEW") {
      setMessage("Esta ocorrência não está disponível para uma nova decisão.")

      return
    }

    if (
      (decision === "CONFIRM" || decision === "CORRECT") &&
      !selectedCategoryId
    ) {
      setMessage("Selecione uma categoria final antes de continuar.")

      return
    }

    setRejectionReason("")

    setInformationRequestMessage("")

    setPendingDecision(decision)
  }

  async function submitDecision() {
    if (!occurrence || !pendingDecision) {
      return
    }

    if (occurrence.status !== "UNDER_REVIEW") {
      setMessage("Esta ocorrência não está mais disponível para decisão.")

      setPendingDecision(null)

      return
    }

    if (pendingDecision === "CONFIRM" || pendingDecision === "CORRECT") {
      if (!selectedCategoryId) {
        setMessage("Selecione uma categoria final.")

        return
      }
    }

    if (pendingDecision === "REJECT") {
      if (!rejectionReason.trim()) {
        setMessage("Informe o motivo da rejeição.")

        return
      }
    }

    if (pendingDecision === "REQUEST_MORE_INFO") {
      if (!informationRequestMessage.trim()) {
        setMessage("Escreva a mensagem que será enviada ao cidadão.")

        return
      }
    }

    setSubmitting(true)

    setMessage(null)

    try {
      switch (pendingDecision) {
        case "CONFIRM":
          await api.validateOccurrence(occurrence.id, {
            decision: "CONFIRM",

            finalCategoryId: selectedCategoryId,

            note: "Ocorrência confirmada pelo gestor no dashboard."
          })

          break

        case "CORRECT":
          await api.validateOccurrence(occurrence.id, {
            decision: "CORRECT",

            finalCategoryId: selectedCategoryId,

            note: "Classificação corrigida pelo gestor no dashboard."
          })

          break

        case "REJECT":
          await api.validateOccurrence(occurrence.id, {
            decision: "REJECT",

            rejectionReason: rejectionReason.trim()
          })

          break

        case "REQUEST_MORE_INFO":
          await api.validateOccurrence(occurrence.id, {
            decision: "REQUEST_MORE_INFO",

            informationRequestMessage: informationRequestMessage.trim()
          })

          break
      }

      setPendingDecision(null)

      setRejectionReason("")

      setInformationRequestMessage("")

      await load()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a decisão."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canDecide = occurrence?.status === "UNDER_REVIEW"

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
              Detalhes da ocorrência
            </h1>

            <p className="text-sm text-slate-500">ID {params.id}</p>
          </div>

          {occurrence && <StatusBadge status={occurrence.status} />}
        </div>
      </header>

      <main className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {message && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {loading && (
            <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Carregando ocorrência...
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative flex aspect-video items-center justify-center bg-slate-100">
              {primaryImage ? (
                <AuthenticatedMediaImage
                  src={primaryImage.contentUrl}
                  alt="Mídia da ocorrência"
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
                      Classificação atual/sugerida
                    </p>

                    <h2 className="text-xl font-semibold text-slate-900">
                      {category?.name ?? "Sem classificação"}
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
              Pré-análise da IA
            </div>

            {occurrence?.aiClassification ? (
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  {occurrence.aiClassification.explanationSimple ??
                    "Resultado de IA registrado."}
                </p>

                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">Confiança</p>

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
                Pré-análise indisponível. A ocorrência permanece válida para
                análise humana.
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
                      {occurrence.reporterLabel ?? "Cidadão autenticado"}
                    </dd>
                  </div>
                </div>

                <div>
                  <dt className="text-slate-500">Urgência</dt>

                  <dd className="font-medium text-slate-800">
                    {urgencyLabels[occurrence.urgency]}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Vítimas/risco humano</dt>

                  <dd className="font-medium text-slate-800">
                    {occurrence.humanRisk ? "Sim" : "Não"}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-slate-900">
                Decisão do gestor
              </h2>

              {!canDecide && (
                <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  Esta análise já possui uma decisão ou está aguardando
                  informações do cidadão. As ações abaixo ficam indisponíveis
                  neste momento.
                </p>
              )}

              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Categoria final
                </span>

                <select
                  value={selectedCategoryId}
                  onChange={(event) =>
                    setSelectedCategoryId(event.target.value)
                  }
                  disabled={submitting || !canDecide}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
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
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => openDecision("CONFIRM")}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Confirmar ocorrência
                </button>

                <button
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => openDecision("CORRECT")}
                  className="w-full rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:border-slate-200 disabled:text-slate-400"
                >
                  Corrigir classificação
                </button>

                <button
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => openDecision("REQUEST_MORE_INFO")}
                  className="w-full rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700 disabled:border-slate-200 disabled:text-slate-400"
                >
                  Solicitar complemento
                </button>

                <button
                  type="button"
                  disabled={submitting || !canDecide}
                  onClick={() => openDecision("REJECT")}
                  className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:border-slate-200 disabled:text-slate-400"
                >
                  Rejeitar
                </button>
              </div>
            </article>
          </aside>
        )}
      </main>

      <DecisionDialog
        open={pendingDecision === "CONFIRM"}
        title="Confirmar ocorrência?"
        description="Confira a categoria antes de continuar. Após a confirmação, a ocorrência poderá aparecer no mapa público."
        confirmLabel="Confirmar ocorrência"
        submitting={submitting}
        tone="success"
        onClose={closeDecisionDialog}
        onConfirm={() => void submitDecision()}
      >
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Categoria final
          </p>

          <p className="mt-1 font-semibold text-emerald-950">
            {selectedCategory?.name ?? "Nenhuma categoria selecionada"}
          </p>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Essa ação encerra a análise atual como confirmada. Verifique as
          informações da ocorrência antes de prosseguir.
        </p>
      </DecisionDialog>

      <DecisionDialog
        open={pendingDecision === "CORRECT"}
        title="Corrigir classificação?"
        description="A categoria selecionada será registrada como classificação final pelo gestor."
        confirmLabel="Salvar correção"
        submitting={submitting}
        tone="default"
        onClose={closeDecisionDialog}
        onConfirm={() => void submitDecision()}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Classificação sugerida anteriormente
            </p>

            <p className="mt-1 font-medium text-slate-900">
              {occurrence?.aiClassification?.predictedCategory?.name ??
                "Sem classificação sugerida"}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Nova categoria final
            </p>

            <p className="mt-1 font-semibold text-blue-950">
              {selectedCategory?.name ?? "Nenhuma categoria selecionada"}
            </p>
          </div>
        </div>
      </DecisionDialog>

      <DecisionDialog
        open={pendingDecision === "REQUEST_MORE_INFO"}
        title="Solicitar mais informações"
        description="Escreva de forma clara o que o cidadão precisa complementar."
        confirmLabel="Enviar solicitação"
        submitting={submitting}
        tone="warning"
        onClose={closeDecisionDialog}
        onConfirm={() => void submitDecision()}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Mensagem para o cidadão
          </span>

          <textarea
            value={informationRequestMessage}
            onChange={(event) =>
              setInformationRequestMessage(event.target.value)
            }
            disabled={submitting}
            rows={5}
            autoFocus
            placeholder="Ex.: Envie uma foto mais ampla do local e informe se a água continua subindo."
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
          />

          {!informationRequestMessage.trim() && (
            <p className="mt-2 text-xs text-slate-500">
              A mensagem é obrigatória.
            </p>
          )}
        </label>

        <p className="mt-4 rounded-xl bg-orange-50 p-3 text-xs leading-relaxed text-orange-900">
          A ocorrência ficará aguardando a resposta do cidadão e voltará para
          análise depois que ele enviar o complemento.
        </p>
      </DecisionDialog>

      <DecisionDialog
        open={pendingDecision === "REJECT"}
        title="Rejeitar ocorrência?"
        description="Informe o motivo da rejeição antes de concluir. Essa informação ficará associada à decisão."
        confirmLabel="Rejeitar ocorrência"
        submitting={submitting}
        tone="danger"
        onClose={closeDecisionDialog}
        onConfirm={() => void submitDecision()}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Motivo da rejeição
          </span>

          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            disabled={submitting}
            rows={5}
            autoFocus
            placeholder="Explique por que esta ocorrência não deve ser confirmada."
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
          />

          {!rejectionReason.trim() && (
            <p className="mt-2 text-xs text-slate-500">
              O motivo é obrigatório.
            </p>
          )}
        </label>

        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
          Esta ação encerrará a análise atual como rejeitada. Confirme somente
          depois de revisar os dados enviados.
        </p>
      </DecisionDialog>
    </DashboardShell>
  )
}
