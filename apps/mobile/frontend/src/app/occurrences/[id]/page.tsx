"use client"

import Link from "next/link"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react"

import { useParams } from "next/navigation"

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ImagePlus,
  Info,
  Send,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react"

import { AuthenticatedMediaImage } from "@/components/authenticated-media-image"

import { StatusBadge } from "@/components/badges"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ProtectedCitizen } from "@/components/protected-citizen"

import {
  api,
  isApiNetworkError,
  type ApiInformationRequest,
  type ApiMedia,
  type ApiOccurrence
} from "@/lib/api"

import { urgencyLabels } from "@/lib/labels"

import { useEffect } from "react"

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",

    timeStyle: "short"
  }).format(new Date(value))
}

function statusExplanation(status: ApiOccurrence["status"]) {
  switch (status) {
    case "DRAFT":
      return "Este registro ainda está sendo preparado."

    case "PENDING_SYNC":
      return "Este registro aguarda envio."

    case "SYNCED":
      return "Seu registro foi recebido."

    case "UNDER_REVIEW":
      return "Seu registro está sendo analisado pela equipe responsável."

    case "NEEDS_MORE_INFO":
      return "A equipe responsável precisa de mais informações para continuar a análise."

    case "CONFIRMED":
      return "A ocorrência foi confirmada após análise."

    case "REJECTED":
      return "A ocorrência não foi confirmada após análise."
  }
}

export default function CitizenOccurrenceDetailPage() {
  const params = useParams<{
    id: string
  }>()

  const occurrenceId = params.id

  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const [occurrence, setOccurrence] = useState<ApiOccurrence | null>(null)

  const [media, setMedia] = useState<ApiMedia[]>([])

  const [requests, setRequests] = useState<ApiInformationRequest[]>([])

  const [loading, setLoading] = useState(true)

  const [message, setMessage] = useState<string | null>(null)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [complementText, setComplementText] = useState("")

  const [complementPhoto, setComplementPhoto] = useState<File | null>(null)

  const [submittingComplement, setSubmittingComplement] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    setMessage(null)

    try {
      const [occurrenceResponse, mediaResponse, requestsResponse] =
        await Promise.all([
          api.getOccurrence(occurrenceId),

          api.listOccurrenceMedia(occurrenceId),

          api.listInformationRequests(occurrenceId)
        ])

      setOccurrence(occurrenceResponse.data)

      setMedia(mediaResponse.data)

      setRequests(requestsResponse.data)
    } catch (error) {
      setMessage(
        isApiNetworkError(error)
          ? "Não foi possível atualizar esta ocorrência sem conexão com o servidor."
          : error instanceof Error
            ? error.message
            : "Não foi possível carregar esta ocorrência."
      )
    } finally {
      setLoading(false)
    }
  }, [occurrenceId])

  useEffect(() => {
    void load()
  }, [load])

  const openRequest = useMemo(
    () => requests.find((request) => request.status === "OPEN") ?? null,
    [requests]
  )

  const orderedMedia = useMemo(
    () =>
      [...media].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
      ),
    [media]
  )

  function clearComplementPhoto() {
    setComplementPhoto(null)

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ""
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = ""
    }
  }

  function selectComplementPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setMessage(null)

    setSuccessMessage(null)

    if (!file) {
      return
    }

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      clearComplementPhoto()

      setMessage("Esse formato de imagem não é aceito. Use JPEG, PNG ou WebP.")

      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      clearComplementPhoto()

      setMessage("A imagem é muito grande. Escolha uma foto de até 10 MB.")

      return
    }

    setComplementPhoto(file)
  }

  async function submitComplement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    setSuccessMessage(null)

    if (!openRequest) {
      setMessage("Não há pedido de informação aguardando resposta.")

      return
    }

    const text = complementText.trim()

    if (!text && !complementPhoto) {
      setMessage("Escreva uma resposta ou adicione uma foto.")

      return
    }

    setSubmittingComplement(true)

    try {
      await api.answerInformationRequest(occurrenceId, openRequest.id, {
        ...(text
          ? {
              text
            }
          : {}),

        ...(complementPhoto
          ? {
              file: complementPhoto
            }
          : {})
      })

      setComplementText("")

      clearComplementPhoto()

      setSuccessMessage(
        "As informações foram enviadas. Sua ocorrência voltou para análise."
      )

      await load()
    } catch (error) {
      setMessage(
        isApiNetworkError(error)
          ? "Você precisa estar conectado para enviar as novas informações."
          : error instanceof Error
            ? error.message
            : "Não foi possível enviar as informações."
      )
    } finally {
      setSubmittingComplement(false)
    }
  }

  return (
    <ProtectedCitizen nextPath={`/occurrences/${occurrenceId}`}>
      <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24">
        <header className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
              aria-label="Voltar para o histórico"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900">Sua ocorrência</h1>

              <p className="text-xs text-slate-500">
                Acompanhe o andamento do registro
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-4 p-4">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Carregando ocorrência...
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </div>
          )}

          {successMessage && (
            <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

              <span>{successMessage}</span>
            </div>
          )}

          {occurrence && (
            <>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Situação atual
                    </p>

                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {statusExplanation(occurrence.status)}
                    </p>
                  </div>

                  <StatusBadge status={occurrence.status} />
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {occurrence.description || "Nenhuma descrição informada."}
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <dt className="text-slate-500">Urgência informada</dt>

                    <dd className="mt-1 font-medium text-slate-800">
                      {urgencyLabels[occurrence.urgency]}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">Pessoas em risco</dt>

                    <dd className="mt-1 font-medium text-slate-800">
                      {occurrence.humanRisk ? "Sim" : "Não"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  Registrada em {formatDateTime(occurrence.reportedAt)}
                </div>
              </article>

              {openRequest && (
                <article className="rounded-xl border border-orange-300 bg-orange-50 p-4 shadow-sm">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="font-semibold text-orange-950">
                        Precisamos de mais informações
                      </h2>

                      <p className="mt-2 text-sm leading-relaxed text-orange-900">
                        {openRequest.message}
                      </p>

                      <p className="mt-2 text-xs text-orange-700">
                        Pedido recebido em{" "}
                        {formatDateTime(openRequest.createdAt)}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={submitComplement}
                    className="mt-4 border-t border-orange-200 pt-4"
                  >
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-800">
                        Sua resposta
                      </span>

                      <textarea
                        value={complementText}
                        onChange={(event) =>
                          setComplementText(event.target.value)
                        }
                        maxLength={2000}
                        placeholder="Explique as informações solicitadas..."
                        className="h-28 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />

                      <span className="mt-1 block text-right text-xs text-slate-500">
                        {complementText.length}
                        /2000
                      </span>
                    </label>

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={selectComplementPhoto}
                      className="hidden"
                    />

                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectComplementPhoto}
                      className="hidden"
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-3 py-2.5 text-xs font-semibold text-orange-800"
                      >
                        <Camera className="h-4 w-4" />
                        Tirar foto
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-3 py-2.5 text-xs font-semibold text-orange-800"
                      >
                        <ImagePlus className="h-4 w-4" />
                        Galeria
                      </button>
                    </div>

                    {complementPhoto && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-700">
                            Foto adicionada
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {complementPhoto.name}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={clearComplementPhoto}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          aria-label="Remover foto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        submittingComplement ||
                        (!complementText.trim() && !complementPhoto)
                      }
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                    >
                      <Send className="h-4 w-4" />

                      {submittingComplement
                        ? "Enviando..."
                        : "Enviar informações"}
                    </button>
                  </form>
                </article>
              )}

              {orderedMedia.length > 0 && (
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="font-semibold text-slate-900">
                    Fotos enviadas
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Imagens que fazem parte deste registro.
                  </p>

                  <div className="mt-4 space-y-4">
                    {orderedMedia.map((item, index) => (
                      <div key={item.id}>
                        <AuthenticatedMediaImage
                          src={item.contentUrl}
                          alt={
                            item.origin === "INITIAL"
                              ? "Foto enviada no registro da ocorrência"
                              : "Foto enviada como informação complementar"
                          }
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          {item.origin === "INITIAL"
                            ? "Foto do registro inicial"
                            : "Foto enviada posteriormente"}

                          {" • "}

                          {formatDateTime(item.createdAt)}
                        </p>

                        {index < orderedMedia.length - 1 && (
                          <div className="mt-4 border-t border-slate-100" />
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {requests.length > 0 && (
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-slate-600" />

                    <h2 className="font-semibold text-slate-900">
                      Pedidos de informação
                    </h2>
                  </div>

                  <div className="mt-4 space-y-3">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <p className="text-sm text-slate-700">
                          {request.message}
                        </p>

                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          {request.status === "OPEN" ? (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                              Aguardando sua resposta
                            </>
                          ) : request.status === "ANSWERED" ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Informações enviadas
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Pedido encerrado
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0" />

                  <p className="text-xs leading-relaxed">
                    A análise final é realizada pela equipe responsável. As
                    informações automáticas do sistema servem apenas como apoio.
                  </p>
                </div>
              </article>
            </>
          )}
        </section>

        <MobileBottomNav />
      </main>
    </ProtectedCitizen>
  )
}
