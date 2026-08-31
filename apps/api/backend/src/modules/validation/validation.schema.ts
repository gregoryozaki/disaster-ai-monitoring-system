import { z } from "zod"

const noteSchema = z.string().trim().min(1).max(2000).optional()

export const validationSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("CONFIRM"),
      finalCategoryId: z.string().uuid(),
      note: noteSchema
    })
    .strict(),

  z
    .object({
      decision: z.literal("CORRECT"),
      finalCategoryId: z.string().uuid(),
      note: noteSchema
    })
    .strict(),

  z
    .object({
      decision: z.literal("REJECT"),
      rejectionReason: z.string().trim().min(3).max(500),
      note: noteSchema
    })
    .strict(),

  z
    .object({
      decision: z.literal("REQUEST_MORE_INFO"),
      informationRequestMessage: z.string().trim().min(5).max(500),
      note: noteSchema
    })
    .strict()
])

export type ValidationInput = z.infer<typeof validationSchema>
