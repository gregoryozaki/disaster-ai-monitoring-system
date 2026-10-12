"use client"

import dynamic from "next/dynamic"

import { useCallback, useEffect, useState } from "react"

import { LocateFixed, MapPin, RefreshCw, ShieldCheck } from "lucide-react"

import { CategoryIcon, categoryColor } from "@/components/category-icon"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ShellHeader } from "@/components/shell-header"

import {
  api,
  isApiNetworkError,
  type ApiPublicOccurrence,
  type ApiPublicOccurrenceMeta
} from "@/lib/api"

import { categoryType } from "@/lib/category"

import { approximateHourLabel, urgencyLabels } from "@/lib/labels"

import { useCitizenLocation } from "@/lib/citizen-location"

const PublicMap = dynamic(() => import("@/components/public-map"), {
  ssr: false,

  loading: () => (
    <div className="flex h-[360px] items-center justify-center bg-slate-100 text-sm text-slate-500">
      Carregando mapa...
    </div>
  )
})

const RADIUS_OPTIONS = [5, 10, 25, 50] as const

export default function CitizenHomePage() {
  const { position, state: locationState, locate } = useCitizenLocation()

  const [publicOccurrences, setPublicOccurrences] = useState<
    ApiPublicOccurrence[]
  >([])

  const [publicMeta, setPublicMeta] = useState<ApiPublicOccurrenceMeta | null>(
    null
  )

  const [radiusKm, setRadiusKm] = useState<number>(10)

  const [publicLoading, setPublicLoading] = useState(true)

  const [publicMessage, setPublicMessage] = useState<string | null>(null)

  const loadPublicOccurrences = useCallback(async () => {
    setPublicLoading(true)

    try {
      const response = await api.listPublicOccurrences(
        position
          ? {
              latitude: position.latitude,

              longitude: position.longitude,

              radiusKm,

              limit: 100
            }
          : undefined
      )

      setPublicOccurrences(response.data)

      setPublicMeta(response.meta)

      setPublicMessage(null)
    } catch (error) {
      if (isApiNetworkError(error)) {
        setPublicMessage("Não conseguimos atualizar as ocorrências agora.")

        return
      }

      setPublicMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as ocorrências."
      )
    } finally {
      setPublicLoading(false)
    }
  }, [position, radiusKm])

  useEffect(() => {
    void loadPublicOccurrences()
  }, [loadPublicOccurrences])

  function locationTitle() {
    switch (locationState) {
      case "LOCATING":
        return "Buscando sua localização"

      case "AVAILABLE":
        return "Usando sua localização"

      case "DENIED":
        return "Localização não autorizada"

      case "UNSUPPORTED":
        return "Localização não disponível"

      case "ERROR":
        return "Não conseguimos obter sua localização"
    }
  }

  function locationDescription() {
    switch (locationState) {
      case "LOCATING":
        return "Isso ajuda a mostrar ocorrências próximas a você."

      case "AVAILABLE":
        return "As ocorrências abaixo são filtradas pela região ao seu redor."

      case "DENIED":
        return "Permita o acesso à localização para encontrar ocorrências próximas."

      case "UNSUPPORTED":
        return "Mostrando as ocorrências confirmadas mais recentes."

      case "ERROR":
        return "Você pode tentar novamente ou consultar as ocorrências sem filtro de distância."
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24">
      <ShellHeader
        title="Kamara"
        subtitle="Ocorrências confirmadas perto de você"
      />

      <section className="border-b border-slate-200 bg-white p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",

                  locationState === "AVAILABLE"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                ].join(" ")}
              >
                {locationState === "AVAILABLE" ? (
                  <LocateFixed className="h-5 w-5" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {locationTitle()}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {locationDescription()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={locate}
              disabled={locationState === "LOCATING"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
              aria-label="Atualizar localização"
              title="Atualizar localização"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",

                  locationState === "LOCATING" ? "animate-spin" : ""
                ].join(" ")}
              />
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              {position && publicMeta?.radiusKm ? (
                <p className="text-xs text-slate-600">
                  <strong>{publicMeta.count}</strong> ocorrência(s)
                  confirmada(s) em até {publicMeta.radiusKm} km.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Consulte ocorrências confirmadas no mapa.
                </p>
              )}
            </div>

            <label className="shrink-0">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Distância
              </span>

              <select
                value={radiusKm}
                disabled={!position}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                {RADIUS_OPTIONS.map((radius) => (
                  <option key={radius} value={radius}>
                    {radius} km
                  </option>
                ))}
              </select>
            </label>
          </div>

          {publicMessage && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {publicMessage}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white px-4 pb-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <div className="relative h-[360px]">
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

            {publicLoading && (
              <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow">
                Atualizando...
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3 px-4 pb-6 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {position ? "Ocorrências próximas" : "Ocorrências confirmadas"}
            </h1>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Somente ocorrências verificadas são mostradas publicamente. A
              posição no mapa é aproximada para preservar a privacidade.
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {!publicLoading && publicOccurrences.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-800">
              Nenhuma ocorrência encontrada
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {position
                ? `Não há ocorrências confirmadas no raio de ${radiusKm} km.`
                : "Não há ocorrências confirmadas para mostrar agora."}
            </p>
          </div>
        )}

        {publicOccurrences.map((occurrence) => {
          const type = categoryType(occurrence.category)

          return (
            <article
              key={occurrence.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${categoryColor(type)}14`,

                    color: categoryColor(type)
                  }}
                >
                  <CategoryIcon type={type} className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-1 text-sm font-semibold text-slate-900">
                      {occurrence.category?.name ?? "Ocorrência confirmada"}
                    </h2>

                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      Confirmada
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Urgência {urgencyLabels[occurrence.urgency].toLowerCase()}
                    {occurrence.humanRisk ? ", com risco a pessoas" : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>{approximateHourLabel(occurrence.reportedAt)}</span>

                    {occurrence.distanceKm !== null && (
                      <span>{occurrence.distanceKm} km de você</span>
                    )}

                    <span>Local aproximado</span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <MobileBottomNav />
    </main>
  )
}
