"use client"

import { useEffect } from "react"

import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap
} from "react-leaflet"

import type { ApiPublicOccurrence } from "@/lib/api"

import { categoryColor } from "@/components/category-icon"

import { categoryType } from "@/lib/category"

export interface PublicMapPosition {
  latitude: number

  longitude: number
}

interface PublicMapProps {
  occurrences: ApiPublicOccurrence[]

  userPosition: PublicMapPosition | null

  radiusKm: number
}

const MANAUS_FALLBACK: [number, number] = [-3.119, -60.022]

function zoomForRadius(radiusKm: number) {
  if (radiusKm <= 5) {
    return 13
  }

  if (radiusKm <= 10) {
    return 12
  }

  if (radiusKm <= 25) {
    return 11
  }

  if (radiusKm <= 50) {
    return 10
  }

  return 9
}

function MapViewport({
  center,
  radiusKm
}: {
  center: [number, number]

  radiusKm: number
}) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoomForRadius(radiusKm), {
      animate: true
    })
  }, [center, map, radiusKm])

  return null
}

export default function PublicMap({
  occurrences,
  userPosition,
  radiusKm
}: PublicMapProps) {
  const firstOccurrence = occurrences[0]

  const center: [number, number] = userPosition
    ? [userPosition.latitude, userPosition.longitude]
    : firstOccurrence
      ? [firstOccurrence.location.latitude, firstOccurrence.location.longitude]
      : MANAUS_FALLBACK

  return (
    <div className="h-full min-h-[280px] w-full overflow-hidden">
      <MapContainer
        center={center}
        zoom={zoomForRadius(radiusKm)}
        scrollWheelZoom
        className="h-full min-h-[280px] w-full"
      >
        <MapViewport center={center} radiusKm={radiusKm} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userPosition && (
          <>
            <Circle
              center={[userPosition.latitude, userPosition.longitude]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: "#047857",

                weight: 1,

                opacity: 0.65,

                fillColor: "#047857",

                fillOpacity: 0.035,

                dashArray: "6 6"
              }}
            />

            <CircleMarker
              center={[userPosition.latitude, userPosition.longitude]}
              radius={8}
              pathOptions={{
                color: "#ffffff",

                weight: 3,

                fillColor: "#047857",

                fillOpacity: 1
              }}
            >
              <Popup>
                <strong>Sua localização</strong>
                <br />
                Utilizada somente para consultar ocorrências próximas.
              </Popup>
            </CircleMarker>
          </>
        )}

        {occurrences.map((occurrence) => {
          const type = categoryType(occurrence.category)

          const color = categoryColor(type)

          return (
            <CircleMarker
              key={occurrence.id}
              center={[
                occurrence.location.latitude,

                occurrence.location.longitude
              ]}
              radius={10}
              pathOptions={{
                color: "#ffffff",

                weight: 3,

                fillColor: color,

                fillOpacity: 0.9
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <strong>
                    {occurrence.category?.name ?? "Ocorrência confirmada"}
                  </strong>

                  {occurrence.description && <p>{occurrence.description}</p>}

                  {occurrence.distanceKm !== null && (
                    <p>
                      Aproximadamente{" "}
                      <strong>{occurrence.distanceKm} km</strong> de você.
                    </p>
                  )}

                  <small>Posição pública aproximada.</small>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
