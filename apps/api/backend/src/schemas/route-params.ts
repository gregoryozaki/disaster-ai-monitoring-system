import { z } from "zod"

export const occurrenceIdParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const informationRequestParamsSchema = z
  .object({
    id: z.string().uuid(),
    requestId: z.string().uuid()
  })
  .strict()

export const mediaIdParamsSchema = z
  .object({
    mediaId: z.string().uuid()
  })
  .strict()
