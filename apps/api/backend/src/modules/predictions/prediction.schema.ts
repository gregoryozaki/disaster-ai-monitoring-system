import { z } from "zod"

export const createRiskPredictionSchema = z
  .object({
    categoryId: z.string().uuid(),

    regionName: z.string().trim().min(3).max(160),

    horizonHours: z.number().int().min(1).max(168).default(48)
  })
  .strict()

export const listRiskPredictionsQuerySchema = z
  .object({
    region: z.string().trim().min(1).max(160).optional(),

    categoryId: z.string().uuid().optional()
  })
  .strict()

export type CreateRiskPredictionInput = z.infer<
  typeof createRiskPredictionSchema
>

export type ListRiskPredictionsQuery = z.infer<
  typeof listRiskPredictionsQuerySchema
>
