"use client"

import Link from "next/link"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react"

import { useRouter } from "next/navigation"

import {
  ArrowLeft,
  Camera,
  CloudUpload,
  LocateFixed,
  MapPin,
  Send,
  Wifi,
  WifiOff
} from "lucide-react"

import { ShellHeader } from "@/components/shell-header"

import {
  ApiError,
  api,
  isApiNetworkError,
  type LocationSource,
  type UrgencyLevel
} from "@/lib/api"

import {
  clearCitizenSession,
  readCitizenSession,
  saveCitizenSession
} from "@/lib/local-session"

import { saveOfflineOccurrence } from "@/lib/offline-db"

import { syncOfflineOccurrence } from "@/lib/offline-sync"

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

  const [description, setDescription] = useState("")

  const [urgency, setUrgency] = useState<UrgencyLevel>("MEDIUM")

  const [humanRisk, setHumanRisk] = useState(false)

  const [locationMode, setLocationMode] = useState<LocationSource>("AUTO")

  const [latitude, setLatitude] = useState<number | null>(null)

  const [longitude, setLongitude] = useState<number | null>(null)

  const [accuracy, setAccuracy] = useState<number | undefined>()

  const [photo, setPhoto] = useState<File | null>(null)

  const [online, setOnline] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  const submissionIdentityRef = useRef<SubmissionIdentity | null>(null)

  const descriptionValid = description.trim().length >= 12

  const locationValid = validLatitude(latitude) && validLongitude(longitude)

  const valid = descriptionValid && locationValid

  useEffect(() => {
    const localSession = readCitizenSession()

    void api
      .me()
      .then((response) => {
        if (response.data.role !== "CITIZEN") {
          clearCitizenSession()

          router.push("/")

          return
        }

        saveCitizenSession(response.data)

        setOnline(true)
      })
      .catch((error) => {
        if (isApiNetworkError(error) && localSession) {
          setOnline(false)

          return
        }

        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          clearCitizenSession()
        }

        router.push("/")
      })
  }, [router])

  useEffect(() => {
    function handleOffline() {
      setOnline(false)
    }

    function handleOnline() {
      /*
       * A interface marca que existe
       * conectividade de navegador.
       * A chamada real à API continua
       * sendo a validação definitiva.
       */
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
    if (mode === locationMode) {
      return
    }

    setAccuracy(undefined)

    if (mode === "AUTO") {
      setLatitude(null)

      setLongitude(null)
    }

    setLocationMode(mode)
  }

  function captureLocation() {
    setMessage(null)

    if (!navigator.geolocation) {
      setMessage(
        "Geolocalizacao nao disponivel neste navegador. Utilize a localizacao manual."
      )

      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)))

        setLongitude(Number(position.coords.longitude.toFixed(6)))

        setAccuracy(Math.round(position.coords.accuracy))

        setLocationMode("AUTO")

        setMessage(null)
      },

      () => {
        setMessage(
          "Nao foi possivel obter a localizacao automaticamente. Utilize a opcao manual."
        )
      },

      {
        enableHighAccuracy: true,

        timeout: 8000
      }
    )
  }

  function changeLatitude(value: string) {
    if (value === "") {
      setLatitude(null)

      return
    }

    setLatitude(Number(value))
  }

  function changeLongitude(value: string) {
    if (value === "") {
      setLongitude(null)

      return
    }

    setLongitude(Number(value))
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setMessage(null)

    if (!file) {
      setPhoto(null)

      return
    }

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPhoto(null)

      event.target.value = ""

      setMessage("Formato de imagem nao suportado. Utilize JPEG, PNG ou WebP.")

      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setPhoto(null)

      event.target.value = ""

      setMessage("A imagem excede o limite de 10 MB.")

      return
    }

    setPhoto(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (!descriptionValid) {
      setMessage("A descricao deve possuir pelo menos 12 caracteres.")

      return
    }

    if (!locationValid) {
      setMessage(
        "Informe uma localizacao valida. Use o GPS ou selecione o modo manual."
      )

      return
    }

    if (latitude === null || longitude === null) {
      return
    }

    if (photo && !ALLOWED_PHOTO_TYPES.has(photo.type)) {
      setMessage("Formato de imagem nao suportado.")

      return
    }

    if (photo && photo.size > MAX_PHOTO_BYTES) {
      setMessage("A imagem excede o limite de 10 MB.")

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

        router.push(`/analysis?occurrenceId=${result.occurrenceId}`)

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
          : "Nao foi possivel salvar a ocorrencia no dispositivo."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white">
      <ShellHeader
        title="Registrar ocorrencia"
        subtitle="Evidencias, localizacao e urgencia"
      />

      <form onSubmit={submit} className="p-4">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div
          className={`mb-4 flex items-center gap-3 rounded-lg border p-3 text-sm ${
            online
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {online ? (
            <Wifi className="h-5 w-5 shrink-0" />
          ) : (
            <WifiOff className="h-5 w-5 shrink-0" />
          )}

          <div>
            <p className="font-medium">
              {online ? "Conexao disponivel" : "Sem conexao"}
            </p>

            <p className="text-xs">
              {online
                ? "O registro sera salvo no dispositivo e sincronizado em seguida."
                : "O registro sera salvo no dispositivo e enviado automaticamente quando a conexao voltar."}
            </p>
          </div>
        </div>

        <section className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Camera className="h-6 w-6" />
            </div>

            <div>
              <h1 className="font-semibold text-slate-900">Evidencia visual</h1>

              <p className="text-xs text-slate-500">
                JPEG, PNG ou WebP. Limite de 10 MB.
              </p>
            </div>
          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectPhoto}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />

          {photo && (
            <div className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-600">
              <p className="font-medium">{photo.name}</p>

              <p>{(photo.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </section>

        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Descricao
          </span>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="Ex: rua alagada com risco para pedestres, proximo a escola..."
            className="h-32 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />

          <span className="mt-1 block text-right text-xs text-slate-500">
            {description.length}/500
          </span>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Urgencia
            </span>

            <select
              value={urgency}
              onChange={(event) =>
                setUrgency(event.target.value as UrgencyLevel)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Baixa</option>

              <option value="MEDIUM">Media</option>

              <option value="HIGH">Alta</option>

              <option value="CRITICAL">Critica</option>
            </select>
          </label>

          <label className="flex items-end gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              checked={humanRisk}
              onChange={(event) => setHumanRisk(event.target.checked)}
              type="checkbox"
              className="h-4 w-4"
            />
            Ha vitimas/risco humano
          </label>
        </div>

        <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium text-emerald-900">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Localizacao
            </span>

            <button
              type="button"
              onClick={captureLocation}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-emerald-800"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              GPS
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectLocationMode("AUTO")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                locationMode === "AUTO"
                  ? "bg-emerald-700 text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              Automatica
            </button>

            <button
              type="button"
              onClick={() => selectLocationMode("MANUAL")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                locationMode === "MANUAL"
                  ? "bg-emerald-700 text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              Manual
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              placeholder="Latitude"
              value={latitude ?? ""}
              readOnly={locationMode === "AUTO"}
              onChange={(event) => changeLatitude(event.target.value)}
              className={`rounded-lg border border-emerald-200 px-3 py-2 text-sm ${
                locationMode === "AUTO"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-white"
              }`}
            />

            <input
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              placeholder="Longitude"
              value={longitude ?? ""}
              readOnly={locationMode === "AUTO"}
              onChange={(event) => changeLongitude(event.target.value)}
              className={`rounded-lg border border-emerald-200 px-3 py-2 text-sm ${
                locationMode === "AUTO"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-white"
              }`}
            />
          </div>

          {locationMode === "AUTO" && !locationValid && (
            <p className="mt-2 text-xs text-emerald-900">
              Clique em GPS para obter sua localizacao.
            </p>
          )}

          {locationMode === "MANUAL" && !locationValid && (
            <p className="mt-2 text-xs text-emerald-900">
              Informe latitude e longitude validas.
            </p>
          )}

          {locationValid && (
            <p className="mt-2 text-xs text-emerald-900">
              Coordenadas: {latitude}, {longitude}
              {accuracy !== undefined
                ? ` · precisao aproximada ${accuracy} m`
                : ""}
            </p>
          )}
        </section>

        <section className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex gap-2">
            <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" />

            <div>
              <p className="font-medium">
                Armazenamento local protegido contra falha de rede
              </p>

              <p className="mt-1 text-xs">
                O relato e a foto sao gravados no IndexedDB antes da tentativa
                de envio.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {message}
          </p>
        )}

        <button
          disabled={!valid || submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold ${
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
              ? "Salvando e enviando..."
              : "Salvando no dispositivo..."
            : online
              ? "Registrar ocorrencia"
              : "Salvar para sincronizar"}
        </button>
      </form>
    </main>
  )
}
