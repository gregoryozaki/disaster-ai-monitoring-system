import { z } from "zod"

const urgencySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
])

const locationSourceSchema = z.enum([
  "AUTO",
  "MANUAL"
])

export const createOccurrenceSchema = z
  .object({
    clientLocalId: z.string().trim().min(1).max(255).optional(),

    idempotencyKey: z.string().uuid().optional(),

    description: z.string().trim().min(1).max(5000).optional(),

    urgency: urgencySchema.default("MEDIUM"),

    humanRisk: z.boolean().default(false),

    latitude: z.number().min(-90).max(90),

    longitude: z.number().min(-180).max(180),

    locationSource: locationSourceSchema,

    locationAccuracyM: z.number().nonnegative().optional()
  })
  .strict()

export const updateOccurrenceSchema = z
  .object({
    description: z.string().trim().min(1).max(5000).optional(),

    urgency: urgencySchema.optional(),

    humanRisk: z.boolean().optional(),

    latitude: z.number().min(-90).max(90).optional(),

    longitude: z.number().min(-180).max(180).optional(),

    locationSource: locationSourceSchema.optional(),

    locationAccuracyM: z
      .number()
      .nonnegative()
      .nullable()
      .optional()
  })
  .strict()
  .superRefine((input, ctx) => {
    if (Object.keys(input).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe ao menos um campo para atualização."
      })
    }

    const hasLatitude = input.latitude !== undefined
    const hasLongitude = input.longitude !== undefined

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: "custom",
        message:
          "Latitude e longitude devem ser atualizadas juntas."
      })
    }
  })

export const occurrenceIdSchema = z.string().uuid()

export type CreateOccurrenceInput = z.infer<
  typeof createOccurrenceSchema
>

export type UpdateOccurrenceInput = z.infer<
  typeof updateOccurrenceSchema
>
