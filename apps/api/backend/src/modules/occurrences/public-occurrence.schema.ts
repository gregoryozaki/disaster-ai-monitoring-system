import { z } from "zod"

export const DEFAULT_PUBLIC_RADIUS_KM = 10

export const publicOccurrenceListQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),

    lon: z.coerce.number().min(-180).max(180).optional(),

    radiusKm: z.coerce.number().positive().max(100).optional(),

    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .superRefine((value, context) => {
    const hasLatitude = value.lat !== undefined

    const hasLongitude = value.lon !== undefined

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,

        path: [hasLatitude ? "lon" : "lat"],

        message: "Latitude e longitude devem ser informadas em conjunto."
      })
    }

    if (value.radiusKm !== undefined && !(hasLatitude && hasLongitude)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,

        path: ["radiusKm"],

        message: "O raio exige latitude e longitude."
      })
    }
  })

export type PublicOccurrenceListQuery = z.infer<
  typeof publicOccurrenceListQuerySchema
>
