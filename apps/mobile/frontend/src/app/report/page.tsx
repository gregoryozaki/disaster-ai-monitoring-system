"use client"

import dynamic from "next/dynamic"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react"

import { useRouter } from "next/navigation"

import {
  Camera,
  CheckCircle2,
  CloudUpload,
  ImagePlus,
  LocateFixed,
  MapPin,
  Send,
  Trash2,
  Wifi,
  WifiOff
} from "lucide-react"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ProtectedCitizen } from "@/components/protected-citizen"

import { ShellHeader } from "@/components/shell-header"

import { type LocationSource, type UrgencyLevel } from "@/lib/api"

import { saveOfflineOccurrence } from "@/lib/offline-db"

import { syncOfflineOccurrence } from "@/lib/offline-sync"

const ReportLocationPicker = dynamic(
  () => import("@/components/report-location-picker"),
  {
    ssr: false,

    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
        Carregando mapa...
      </div>
    )
  }
)

interface SubmissionIdentity {
  clientLocalId: string

  idempotencyKey: string

  reportedAt: string
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function validLatitude(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= -90 && value <= 90
}

function validLongitude(value: number | null) {
  return (
    value !== null && Number.isFinite(value) && value >= -180 && value <= 180
  )
}

export default function ReportPage() {
  const router = useRouter()

  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const [description, setDescription] = useState("")

  const [urgency, setUrgency] = useState<UrgencyLevel>("MEDIUM")

  const [humanRisk, setHumanRisk] = useState(false)

  const [locationMode, setLocationMode] = useState<LocationSource>("AUTO")

  const [latitude, setLatitude] = useState<number | null>(null)

  const [longitude, setLongitude] = useState<number | null>(null)

  const [accuracy, setAccuracy] = useState<number | undefined>()

  const [photo, setPhoto] = useState<File | null>(null)

  const [online, setOnline] = useState(true)

  const [locating, setLocating] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  const submissionIdentityRef = useRef<SubmissionIdentity | null>(null)

  const descriptionValid = description.trim().length >= 12

  const locationValid = validLatitude(latitude) && validLongitude(longitude)

  const valid = descriptionValid && locationValid

  useEffect(() => {
    setOnline(navigator.onLine)

    function handleOffline() {
      setOnline(false)
    }

    function handleOnline() {
      setOnline(true)
    }

    window.addEventListener("online", handleOnline)

    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)

      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  function getSubmissionIdentity(): SubmissionIdentity {
    if (!submissionIdentityRef.current) {
      submissionIdentityRef.current = {
        clientLocalId: crypto.randomUUID(),

        idempotencyKey: crypto.randomUUID(),

        reportedAt: new Date().toISOString()
      }
    }

    return submissionIdentityRef.current
  }

  function selectLocationMode(mode: LocationSource) {
    setMessage(null)

    if (mode === locationMode) {
      return
    }

    setLocationMode(mode)

    setAccuracy(undefined)

    /*
     * Não reutilizamos silenciosamente
     * uma coordenada manual como se
     * tivesse vindo do aparelho.
     */
    if (mode === "AUTO") {
      setLatitude(null)

      setLongitude(null)
    }
  }

  function captureLocation() {
    setMessage(null)

    if (!navigator.geolocation) {
      setMessage(
        "Este aparelho não conseguiu acessar sua localização. Você pode escolher o local no mapa."
      )

      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)))

        setLongitude(Number(position.coords.longitude.toFixed(6)))

        setAccuracy(Math.round(position.coords.accuracy))

        setLocationMode("AUTO")

        setMessage(null)

        setLocating(false)
      },

      () => {
        setLocating(false)

        setMessage(
          "Não foi possível obter sua localização. Tente novamente ou escolha o local no mapa."
        )
      },

      {
        enableHighAccuracy: true,

        maximumAge: 0,

        timeout: 15000
      }
    )
  }

  function selectManualLocation(nextLatitude: number, nextLongitude: number) {
    setLocationMode("MANUAL")

    setLatitude(nextLatitude)

    setLongitude(nextLongitude)

    setAccuracy(undefined)

    setMessage(null)
  }

  function clearPhoto() {
    setPhoto(null)

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ""
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = ""
    }
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setMessage(null)

    if (!file) {
      return
    }

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      clearPhoto()

      setMessage("Esse formato de imagem não é aceito. Use JPEG, PNG ou WebP.")

      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      clearPhoto()

      setMessage("A imagem é muito grande. Escolha uma foto de até 10 MB.")

      return
    }

    setPhoto(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (!descriptionValid) {
      setMessage(
        "Conte um pouco mais sobre o que está acontecendo. Use pelo menos 12 caracteres."
      )

      return
    }

    if (!locationValid) {
      setMessage("Precisamos saber onde a ocorrência está acontecendo.")

      return
    }

    if (latitude === null || longitude === null) {
      return
    }

    if (photo && !ALLOWED_PHOTO_TYPES.has(photo.type)) {
      setMessage("Esse formato de imagem não é aceito.")

      return
    }

    if (photo && photo.size > MAX_PHOTO_BYTES) {
      setMessage("A imagem é muito grande. Escolha uma foto de até 10 MB.")

      return
    }

    setSubmitting(true)

    const identity = getSubmissionIdentity()

    let savedLocally = false

    try {
      await saveOfflineOccurrence({
        clientLocalId: identity.clientLocalId,

        idempotencyKey: identity.idempotencyKey,

        description: description.trim(),

        urgency,

        humanRisk,

        latitude,

        longitude,

        locationSource: locationMode,

        ...(accuracy !== undefined
          ? {
              locationAccuracyM: accuracy
            }
          : {}),

        reportedAt: identity.reportedAt,

        photo:
          photo === null
            ? null
            : {
                blob: photo,

                name: photo.name,

                type: photo.type,

                lastModified: photo.lastModified
              }
      })

      savedLocally = true

      if (!online || !navigator.onLine) {
        submissionIdentityRef.current = null

        router.push("/history")

        return
      }

      const result = await syncOfflineOccurrence(identity.clientLocalId, {
        force: true
      })

      if (result.status === "SYNCED" && result.occurrenceId) {
        submissionIdentityRef.current = null

        router.push(`/occurrences/${result.occurrenceId}`)

        return
      }

      submissionIdentityRef.current = null

      router.push("/history")
    } catch (error) {
      if (savedLocally) {
        submissionIdentityRef.current = null

        router.push("/history")

        return
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar sua ocorrência."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedCitizen nextPath="/report">
      <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24">
        <ShellHeader
          title="Registrar ocorrência"
          subtitle="Conte o que está acontecendo"
        />

        <form onSubmit={submit} className="p-4">
          {online ? (
            <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="flex gap-2">
                <Wifi className="mt-0.5 h-4 w-4 shrink-0" />

                <div>
                  <p className="font-medium">Você está online</p>

                  <p className="mt-1 text-xs">
                    Sua ocorrência será enviada normalmente.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex gap-2">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />

                <div>
                  <p className="font-medium">Sem internet no momento</p>

                  <p className="mt-1 text-xs">
                    Seu registro ficará salvo neste aparelho e será enviado
                    quando a conexão voltar.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Camera className="h-6 w-6" />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Foto da ocorrência
                </h2>

                <p className="text-xs text-slate-500">
                  A foto é opcional, mas pode ajudar na análise.
                </p>
              </div>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={selectPhoto}
              className="hidden"
            />

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={selectPhoto}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-semibold text-white"
              >
                <Camera className="h-4 w-4" />
                Tirar foto
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
              >
                <ImagePlus className="h-4 w-4" />
                Galeria
              </button>
            </div>

            {photo && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Foto selecionada
                  </div>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {photo.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearPhoto}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              JPEG, PNG ou WebP. Até 10 MB.
            </p>
          </section>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              O que está acontecendo?
            </span>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Ex.: A rua está alagada e a água está subindo perto das casas..."
              className="h-32 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />

            <span className="mt-1 block text-right text-xs text-slate-500">
              {description.length}
              /500
            </span>
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Urgência
              </span>

              <select
                value={urgency}
                onChange={(event) =>
                  setUrgency(event.target.value as UrgencyLevel)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              >
                <option value="LOW">Baixa</option>

                <option value="MEDIUM">Média</option>

                <option value="HIGH">Alta</option>

                <option value="CRITICAL">Crítica</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700">
              <input
                checked={humanRisk}
                onChange={(event) => setHumanRisk(event.target.checked)}
                type="checkbox"
                className="h-4 w-4"
              />

              <span>Há pessoas em risco?</span>
            </label>
          </div>

          <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-3 flex items-center gap-2 font-medium text-emerald-950">
              <MapPin className="h-5 w-5" />
              Local da ocorrência
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  selectLocationMode("AUTO")

                  captureLocation()
                }}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  locationMode === "AUTO"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                Minha localização
              </button>

              <button
                type="button"
                onClick={() => selectLocationMode("MANUAL")}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  locationMode === "MANUAL"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                Escolher no mapa
              </button>
            </div>

            {locationMode === "AUTO" && (
              <div>
                <button
                  type="button"
                  onClick={captureLocation}
                  disabled={locating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-emerald-800 shadow-sm disabled:opacity-60"
                >
                  <LocateFixed
                    className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`}
                  />

                  {locating
                    ? "Buscando localização..."
                    : locationValid
                      ? "Atualizar minha localização"
                      : "Usar localização do aparelho"}
                </button>

                {locationValid && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-xs font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Localização recebida. Confira se o local corresponde ao
                    ponto da ocorrência.
                  </div>
                )}

                {!locationValid && !locating && (
                  <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                    Permita o acesso à localização ou escolha o local
                    manualmente no mapa.
                  </p>
                )}
              </div>
            )}

            {locationMode === "MANUAL" && (
              <div>
                <p className="mb-3 text-xs leading-relaxed text-emerald-900">
                  Navegue pelo mapa e toque exatamente no ponto onde a
                  ocorrência está acontecendo.
                </p>

                <ReportLocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={selectManualLocation}
                />

                {locationValid && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-xs font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Local escolhido no mapa.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex gap-2">
              <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" />

              <div>
                <p className="font-medium">Seu registro fica protegido</p>

                <p className="mt-1 text-xs">
                  Se a internet cair durante o envio, você não precisará
                  preencher tudo novamente.
                </p>
              </div>
            </div>
          </section>

          {message && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={!valid || submitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold ${
              valid && !submitting
                ? "bg-emerald-700 text-white"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {online ? (
              <Send className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}

            {submitting
              ? online
                ? "Enviando ocorrência..."
                : "Salvando ocorrência..."
              : online
                ? "Registrar ocorrência"
                : "Salvar ocorrência"}
          </button>
        </form>

        <MobileBottomNav />
      </main>
    </ProtectedCitizen>
  )
}
