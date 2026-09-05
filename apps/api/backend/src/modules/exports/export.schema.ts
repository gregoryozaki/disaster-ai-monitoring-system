import { z } from "zod"

export const createExportSchema = z
  .object({
    format: z.enum(["CSV", "JSON"])
  })
  .strict()

export const exportIdParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export type CreateExportInput = z.infer<typeof createExportSchema>
