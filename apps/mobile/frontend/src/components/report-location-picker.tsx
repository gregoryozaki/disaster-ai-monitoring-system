"use client"

import { useEffect, useMemo } from "react"

import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet"

interface ReportLocationPickerProps {
  latitude: number | null

  longitude: number | null

  onChange: (latitude: number, longitude: number) => void
}

const MANAUS_FALLBACK: [number, number] = [-3.119, -60.022]

function validCoordinates(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function MapViewport({ center }: { center: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, 16, {
      animate: true
    })
  }, [center, map])

  return null
}

function MapClickHandler({
  onChange
}: {
  onChange: (latitude: number, longitude: number) => void
}) {
  useMapEvents({
    click(event) {
      onChange(
        Number(event.latlng.lat.toFixed(6)),

        Number(event.latlng.lng.toFixed(6))
      )
    }
  })

  return null
}

export default function ReportLocationPicker({
  latitude,
  longitude,
  onChange
}: ReportLocationPickerProps) {
  const hasCoordinates = validCoordinates(latitude, longitude)

  const center = useMemo<[number, number]>(
    () =>
      hasCoordinates
        ? [latitude as number, longitude as number]
        : MANAUS_FALLBACK,
    [hasCoordinates, latitude, longitude]
  )

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom
        className="h-72 w-full"
      >
        <MapViewport center={center} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onChange={onChange} />

        {hasCoordinates && (
          <CircleMarker
            center={[latitude as number, longitude as number]}
            radius={9}
          />
        )}
      </MapContainer>
    </div>
  )
}
