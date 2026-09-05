import { z } from "zod"

export const adminEntityIdParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const createAdminCategorySchema = z
  .object({
    cobradeCode: z.string().trim().min(3).max(32),

    name: z.string().trim().min(3).max(255),

    groupName: z.string().trim().min(2).max(255).nullable().optional(),

    active: z.boolean().optional()
  })
  .strict()

export const updateAdminCategorySchema = z
  .object({
    name: z.string().trim().min(3).max(255).optional(),

    groupName: z.string().trim().min(2).max(255).nullable().optional(),

    active: z.boolean().optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Informe ao menos um campo para atualização."
  })

export const createConfidenceThresholdSchema = z
  .object({
    categoryId: z.string().uuid(),

    modelType: z.enum(["VISUAL", "TEXTUAL", "MULTIMODAL", "RISK_PREDICTION"]),

    lowUpperBound: z.number().min(0).max(1),

    mediumUpperBound: z.number().min(0).max(1)
  })
  .strict()

export type CreateAdminCategoryInput = z.infer<typeof createAdminCategorySchema>

export type UpdateAdminCategoryInput = z.infer<typeof updateAdminCategorySchema>

export type CreateConfidenceThresholdInput = z.infer<
  typeof createConfidenceThresholdSchema
>
