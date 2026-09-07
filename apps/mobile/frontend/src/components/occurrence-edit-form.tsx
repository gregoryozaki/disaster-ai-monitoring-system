"use client"

import dynamic from "next/dynamic"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"

import {
  Camera,
  CheckCircle2,
  ImagePlus,
  LocateFixed,
  MapPin,
  Save,
  Trash2
} from "lucide-react"

import type {
  ApiOccurrence,
  LocationSource,
  UpdateOccurrencePayload,
  UrgencyLevel
} from "@/lib/api"

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

interface OccurrenceEditFormProps {
  initialDescription: string

  initialUrgency: UrgencyLevel

  initialHumanRisk: boolean

  initialLocation: ApiOccurrence["location"]

  hasCurrentPhoto: boolean

  currentPhotoName?: string | null

  submitting: boolean

  onSubmit: (
    payload: UpdateOccurrencePayload,
    photo: File | null
  ) => Promise<void>

  onCancel: () => void
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function OccurrenceEditForm({
  initialDescription,
  initialUrgency,
  initialHumanRisk,
  initialLocation,
  hasCurrentPhoto,
  currentPhotoName,
  submitting,
  onSubmit,
  onCancel
}: OccurrenceEditFormProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const initialLocationSource = initialLocation.source ?? "MANUAL"

  const initialAccuracy = initialLocation.accuracyM ?? null

  const [description, setDescription] = useState(initialDescription)

  const [urgency, setUrgency] = useState<UrgencyLevel>(initialUrgency)

  const [humanRisk, setHumanRisk] = useState(initialHumanRisk)

  const [latitude, setLatitude] = useState(initialLocation.latitude)

  const [longitude, setLongitude] = useState(initialLocation.longitude)

  const [locationSource, setLocationSource] = useState<LocationSource>(
    initialLocationSource
  )

  const [locationAccuracyM, setLocationAccuracyM] = useState<number | null>(
    initialAccuracy
  )

  const [locating, setLocating] = useState(false)

  const [locationMessage, setLocationMessage] = useState<string | null>(null)

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)

  const [photoMessage, setPhotoMessage] = useState<string | null>(null)

  const descriptionValid = description.trim().length >= 12

  const coordinatesValid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180

  const fieldsChanged =
    description.trim() !== initialDescription.trim() ||
    urgency !== initialUrgency ||
    humanRisk !== initialHumanRisk ||
    latitude !== initialLocation.latitude ||
    longitude !== initialLocation.longitude ||
    locationSource !== initialLocationSource ||
    locationAccuracyM !== initialAccuracy

  const hasChanges = fieldsChanged || selectedPhoto !== null

  const valid = descriptionValid && coordinatesValid && hasChanges

  function captureLocation() {
    setLocationMessage(null)

    if (!navigator.geolocation) {
      setLocationMessage(
        "Este aparelho não conseguiu acessar sua localização. Você pode escolher o ponto no mapa."
      )

      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)))

        setLongitude(Number(position.coords.longitude.toFixed(6)))

        setLocationAccuracyM(Math.round(position.coords.accuracy))

        setLocationSource("AUTO")

        setLocating(false)

        setLocationMessage(null)
      },

      () => {
        setLocating(false)

        setLocationMessage(
          "Não foi possível obter sua localização. Tente novamente ou escolha o ponto no mapa."
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
    setLatitude(nextLatitude)

    setLongitude(nextLongitude)

    setLocationSource("MANUAL")

    setLocationAccuracyM(null)

    setLocationMessage(null)
  }

  function clearSelectedPhoto() {
    setSelectedPhoto(null)

    setPhotoMessage(null)

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ""
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = ""
    }
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setPhotoMessage(null)

    if (!file) {
      return
    }

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      clearSelectedPhoto()

      setPhotoMessage("Use uma imagem JPEG, PNG ou WebP.")

      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      clearSelectedPhoto()

      setPhotoMessage("A foto deve ter no máximo 10 MB.")

      return
    }

    setSelectedPhoto(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!valid) {
      return
    }

    await onSubmit(
      {
        description: description.trim(),

        urgency,

        humanRisk,

        latitude,

        longitude,

        locationSource,

        locationAccuracyM: locationSource === "AUTO" ? locationAccuracyM : null
      },

      selectedPhoto
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          O que está acontecendo?
        </span>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          className="h-32 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        <div className="mt-1 flex justify-between gap-2 text-xs">
          <span
            className={descriptionValid ? "text-slate-500" : "text-amber-700"}
          >
            Use pelo menos 12 caracteres.
          </span>

          <span className="text-slate-500">{description.length}/500</span>
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Urgência
          </span>

          <select
            value={urgency}
            onChange={(event) => setUrgency(event.target.value as UrgencyLevel)}
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
            type="checkbox"
            checked={humanRisk}
            onChange={(event) => setHumanRisk(event.target.checked)}
            className="h-4 w-4"
          />
          Há pessoas em risco?
        </label>
      </div>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium text-emerald-950">
          <MapPin className="h-5 w-5" />
          Local da ocorrência
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
              locationSource === "AUTO"
                ? "bg-emerald-700 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <LocateFixed className="h-4 w-4" />

              {locating ? "Buscando..." : "Minha localização"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLocationSource("MANUAL")

              setLocationAccuracyM(null)
            }}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
              locationSource === "MANUAL"
                ? "bg-emerald-700 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            Escolher no mapa
          </button>
        </div>

        {locationSource === "AUTO" && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-xs font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Localização do aparelho selecionada.
          </div>
        )}

        {locationSource === "MANUAL" && (
          <div className="mt-3">
            <p className="mb-2 text-xs leading-relaxed text-emerald-900">
              Toque no mapa para escolher o ponto da ocorrência.
            </p>

            <ReportLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={selectManualLocation}
            />
          </div>
        )}

        {locationMessage && (
          <p className="mt-3 rounded-xl bg-white p-3 text-xs text-amber-800">
            {locationMessage}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Foto da ocorrência
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {hasCurrentPhoto
            ? "Uma foto já foi enviada. Se escolher outra, ela substituirá a foto atual."
            : "Você ainda não enviou uma foto. Pode adicionar uma agora."}
        </p>

        {currentPhotoName && (
          <p className="mt-2 truncate text-xs font-medium text-slate-600">
            Foto atual: {currentPhotoName}
          </p>
        )}

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

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-2 py-3 text-xs font-semibold text-emerald-700"
          >
            <Camera className="h-4 w-4" />

            {hasCurrentPhoto ? "Tirar nova foto" : "Tirar foto"}
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-2 py-3 text-xs font-semibold text-emerald-700"
          >
            <ImagePlus className="h-4 w-4" />
            Galeria
          </button>
        </div>

        {selectedPhoto && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-800">
                {hasCurrentPhoto ? "Nova foto selecionada" : "Foto selecionada"}
              </p>

              <p className="mt-1 truncate text-xs text-slate-500">
                {selectedPhoto.name}
              </p>
            </div>

            <button
              type="button"
              onClick={clearSelectedPhoto}
              aria-label="Remover nova foto"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {photoMessage && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {photoMessage}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          JPEG, PNG ou WebP. Até 10 MB.
        </p>
      </section>

      {!hasChanges && (
        <p className="text-center text-xs text-slate-500">
          Faça alguma alteração antes de salvar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Voltar
        </button>

        <button
          type="submit"
          disabled={!valid || submitting}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />

          {submitting ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  )
}
