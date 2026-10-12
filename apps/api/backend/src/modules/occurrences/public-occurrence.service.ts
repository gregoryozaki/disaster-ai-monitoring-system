import type {
  DisasterCategory,
  Occurrence
} from "../../generated/prisma/client.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { toPublicCoordinate } from "./public-location.js"

import { approximateReportedAt } from "./public-occurrence.dto.js"

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

/*
 * A ordem pública usa só o que é público: distância, hora cheia e id.
 * Ordenar pelo horário exato mostraria quem relatou primeiro dentro da
 * mesma hora.
 */
function comparePublicItems(
  left: PublicOccurrenceListItem,
  right: PublicOccurrenceListItem
) {
  if (
    left.distanceKm !== null &&
    right.distanceKm !== null &&
    left.distanceKm !== right.distanceKm
  ) {
    return left.distanceKm - right.distanceKm
  }

  const hourDifference =
    approximateReportedAt(right.occurrence.reportedAt).getTime() -
    approximateReportedAt(left.occurrence.reportedAt).getTime()

  if (hourDifference !== 0) {
    return hourDifference
  }

  return left.occurrence.id.localeCompare(right.occurrence.id)
}

export async function listPublicOccurrences(
  query: PublicOccurrenceListQuery
): Promise<PublicOccurrenceListResult> {
  const occurrences = await prisma.occurrence.findMany({
    where: {
      status: "CONFIRMED",

      deletedAt: null
    },

    include: publicOccurrenceInclude
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

      // Distância até a posição pública, para não revelar o ponto exato.
      const distanceKm = calculateDistanceKm(
        query.lat!,
        query.lon!,
        toPublicCoordinate(Number(occurrence.latitude)),
        toPublicCoordinate(Number(occurrence.longitude))
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
    .sort(comparePublicItems)
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
