"use client"

import Link from "next/link"

import { useEffect } from "react"

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap
} from "react-leaflet"

import type { OccurrenceStatus } from "@kamara/shared-types"

import { categoryColor } from "@/components/category-icon"

import type { ApiOccurrence } from "@/lib/api"

import {
  categoryType,
  occurrenceLatitude,
  occurrenceLongitude
} from "@/lib/category"

interface ManagerMapProps {
  occurrences: ApiOccurrence[]

  selectedOccurrenceId: string | null

  onSelectOccurrence: (occurrenceId: string) => void
}

const AMAZONAS_FALLBACK: [number, number] = [-3.119, -60.022]

const statusColors: Record<OccurrenceStatus, string> = {
  DRAFT: "#64748b",

  PENDING_SYNC: "#d97706",

  SYNCED: "#2563eb",

  UNDER_REVIEW: "#ca8a04",

  NEEDS_MORE_INFO: "#ea580c",

  CONFIRMED: "#059669",

  REJECTED: "#dc2626"
}

function validCoordinate(latitude: number, longitude: number) {
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

function MapViewport({
  occurrences,
  selectedOccurrenceId
}: {
  occurrences: ApiOccurrence[]

  selectedOccurrenceId: string | null
}) {
  const map = useMap()

  /*
   * Quando o conjunto filtrado muda,
   * enquadramos novamente todos os
   * pontos disponíveis.
   */
  useEffect(() => {
    const points = occurrences
      .map(
        (occurrence) =>
          [occurrenceLatitude(occurrence), occurrenceLongitude(occurrence)] as [
            number,
            number
          ]
      )
      .filter(([latitude, longitude]) => validCoordinate(latitude, longitude))

    if (points.length === 0) {
      map.setView(AMAZONAS_FALLBACK, 7)

      return
    }

    if (points.length === 1) {
      map.setView(points[0], 14)

      return
    }

    map.fitBounds(points, {
      padding: [40, 40],

      maxZoom: 14
    })
  }, [map, occurrences])

  /*
   * Seleção feita pela lista:
   * centraliza o mapa no registro.
   */
  useEffect(() => {
    if (!selectedOccurrenceId) {
      return
    }

    const selected = occurrences.find(
      (occurrence) => occurrence.id === selectedOccurrenceId
    )

    if (!selected) {
      return
    }

    const latitude = occurrenceLatitude(selected)

    const longitude = occurrenceLongitude(selected)

    if (!validCoordinate(latitude, longitude)) {
      return
    }

    const targetZoom = Math.max(map.getZoom(), 14)

    map.flyTo([latitude, longitude], targetZoom, {
      duration: 0.6
    })
  }, [map, occurrences, selectedOccurrenceId])

  return null
}

export default function ManagerMap({
  occurrences,
  selectedOccurrenceId,
  onSelectOccurrence
}: ManagerMapProps) {
  return (
    <MapContainer
      center={AMAZONAS_FALLBACK}
      zoom={7}
      scrollWheelZoom
      className="h-full min-h-[420px] w-full"
    >
      <MapViewport
        occurrences={occurrences}
        selectedOccurrenceId={selectedOccurrenceId}
      />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {occurrences.map((occurrence) => {
        const latitude = occurrenceLatitude(occurrence)

        const longitude = occurrenceLongitude(occurrence)

        if (!validCoordinate(latitude, longitude)) {
          return null
        }

        const category =
          occurrence.confirmedCategory ??
          occurrence.aiClassification?.predictedCategory ??
          null

        const fillColor = category
          ? categoryColor(categoryType(category))
          : "#64748b"

        const selected = occurrence.id === selectedOccurrenceId

        return (
          <CircleMarker
            key={occurrence.id}
            center={[latitude, longitude]}
            radius={selected ? 14 : occurrence.humanRisk ? 11 : 9}
            pathOptions={{
              color: selected ? "#0f172a" : statusColors[occurrence.status],

              weight: selected ? 5 : 4,

              fillColor,

              fillOpacity: selected ? 1 : 0.9
            }}
            eventHandlers={{
              click: () => {
                onSelectOccurrence(occurrence.id)
              }
            }}
          >
            <Popup>
              <div className="min-w-[210px]">
                <p className="font-semibold text-slate-900">
                  {category?.name ?? "Sem classificação"}
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  Status: <strong>{occurrence.status}</strong>
                </p>

                {occurrence.description && (
                  <p className="mt-2 text-sm text-slate-600">
                    {occurrence.description}
                  </p>
                )}

                {occurrence.humanRisk && (
                  <p className="mt-2 text-sm font-medium text-red-700">
                    Risco humano informado
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>

                <Link
                  href={`/occurrences/${occurrence.id}`}
                  className="mt-3 inline-block rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                >
                  Ver detalhes
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
