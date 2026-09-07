"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type CitizenLocationState =
  "LOCATING" | "AVAILABLE" | "DENIED" | "UNSUPPORTED" | "ERROR"

export interface CitizenPosition {
  latitude: number

  longitude: number

  accuracyM: number | null
}

const POSITION_EPSILON = 0.0001

function validLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function validLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

function positionsAreEffectivelyEqual(
  current: CitizenPosition,
  next: CitizenPosition
) {
  return (
    Math.abs(current.latitude - next.latitude) < POSITION_EPSILON &&
    Math.abs(current.longitude - next.longitude) < POSITION_EPSILON
  )
}

export function useCitizenLocation() {
  const [position, setPosition] = useState<CitizenPosition | null>(null)

  const [state, setState] = useState<CitizenLocationState>("LOCATING")

  const watchIdRef = useRef<number | null>(null)

  const stopTimerRef = useRef<number | null>(null)

  const receivedPositionRef = useRef(false)

  const stopWatching = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current)

      watchIdRef.current = null
    }

    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current)

      stopTimerRef.current = null
    }
  }, [])

  const locate = useCallback(() => {
    stopWatching()

    receivedPositionRef.current = false

    if (!navigator.geolocation) {
      setState("UNSUPPORTED")

      return
    }

    setState("LOCATING")

    const watchId = navigator.geolocation.watchPosition(
      (current) => {
        const latitude = current.coords.latitude

        const longitude = current.coords.longitude

        if (!validLatitude(latitude) || !validLongitude(longitude)) {
          return
        }

        receivedPositionRef.current = true

        setState("AVAILABLE")

        const nextPosition: CitizenPosition = {
          latitude,

          longitude,

          accuracyM: Number.isFinite(current.coords.accuracy)
            ? Math.round(current.coords.accuracy)
            : null
        }

        setPosition((previous) => {
          if (
            previous &&
            positionsAreEffectivelyEqual(previous, nextPosition)
          ) {
            return previous
          }

          return nextPosition
        })
      },

      (error) => {
        if (receivedPositionRef.current) {
          return
        }

        if (error.code === error.PERMISSION_DENIED) {
          setState("DENIED")

          return
        }

        setState("ERROR")
      },

      {
        enableHighAccuracy: true,

        maximumAge: 0,

        timeout: 15000
      }
    )

    watchIdRef.current = watchId

    stopTimerRef.current = window.setTimeout(() => {
      stopWatching()
    }, 12000)
  }, [stopWatching])

  useEffect(() => {
    locate()

    return stopWatching
  }, [locate, stopWatching])

  return {
    position,

    state,

    locate
  }
}
