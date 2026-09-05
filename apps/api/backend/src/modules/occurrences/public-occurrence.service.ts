import type {
  DisasterCategory,
  Occurrence
} from "../../generated/prisma/client.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import {
  DEFAULT_PUBLIC_RADIUS_KM,
  type PublicOccurrenceListQuery
} from "./public-occurrence.schema.js"

const EARTH_RADIUS_KM = 6371.0088

const publicOccurrenceInclude = {
  confirmedCategory: true
} as const

export type PublicOccurrenceRecord = Occurrence & {
  confirmedCategory: DisasterCategory | null
}

export interface PublicOccurrenceListItem {
  occurrence: PublicOccurrenceRecord

  distanceKm: number | null
}

export interface PublicOccurrenceListResult {
  items: PublicOccurrenceListItem[]

  meta: {
    center: {
      latitude: number
      longitude: number
    } | null

    radiusKm: number | null

    count: number
  }
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

export function calculateDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const latitudeDelta = toRadians(latitudeB - latitudeA)

  const longitudeDelta = toRadians(longitudeB - longitudeA)

  const firstLatitude = toRadians(latitudeA)

  const secondLatitude = toRadians(latitudeB)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))

  return EARTH_RADIUS_KM * angularDistance
}

export async function listPublicOccurrences(
  query: PublicOccurrenceListQuery
): Promise<PublicOccurrenceListResult> {
  const occurrences = await prisma.occurrence.findMany({
    where: {
      status: "CONFIRMED",

      deletedAt: null
    },

    include: publicOccurrenceInclude,

    orderBy: {
      reportedAt: "desc"
    }
  })

  const hasCenter = query.lat !== undefined && query.lon !== undefined

  const radiusKm = hasCenter
    ? (query.radiusKm ?? DEFAULT_PUBLIC_RADIUS_KM)
    : null

  const items = occurrences
    .map((occurrence): PublicOccurrenceListItem => {
      if (!hasCenter) {
        return {
          occurrence,

          distanceKm: null
        }
      }

      const distanceKm = calculateDistanceKm(
        query.lat!,
        query.lon!,
        Number(occurrence.latitude),
        Number(occurrence.longitude)
      )

      return {
        occurrence,

        distanceKm
      }
    })
    .filter(
      (item) =>
        radiusKm === null ||
        (item.distanceKm !== null && item.distanceKm <= radiusKm)
    )
    .sort((left, right) => {
      if (hasCenter && left.distanceKm !== null && right.distanceKm !== null) {
        return left.distanceKm - right.distanceKm
      }
      return 0
    })
    .slice(0, query.limit)

  return {
    items,

    meta: {
      center: hasCenter
        ? {
            latitude: query.lat!,

            longitude: query.lon!
          }
        : null,

      radiusKm,

      count: items.length
    }
  }
}

export async function getPublicOccurrence(id: string) {
  const occurrence = await prisma.occurrence.findFirst({
    where: {
      id,

      status: "CONFIRMED",

      deletedAt: null
    },

    include: publicOccurrenceInclude
  })

  if (!occurrence) {
    throw new HttpError(
      404,
      "Ocorrência não encontrada.",
      "OCCURRENCE_NOT_FOUND"
    )
  }

  return occurrence
}
