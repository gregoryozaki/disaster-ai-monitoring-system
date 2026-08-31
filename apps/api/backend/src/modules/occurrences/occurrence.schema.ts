import { z } from "zod"

export const createOccurrenceSchema = z
  .object({
    clientLocalId: z.string().trim().min(1).max(255).optional(),

    idempotencyKey: z.string().uuid().optional(),

    description: z.string().trim().min(1).max(5000).optional(),

    urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),

    humanRisk: z.boolean().default(false),

    latitude: z.number().min(-90).max(90),

    longitude: z.number().min(-180).max(180),

    locationSource: z.enum(["AUTO", "MANUAL"]),

    locationAccuracyM: z.number().nonnegative().optional()
  })
  .strict()
export const occurrenceIdSchema = z.string().uuid()
export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>
