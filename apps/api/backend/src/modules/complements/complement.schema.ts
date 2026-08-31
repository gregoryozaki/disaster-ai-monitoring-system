import { z } from "zod"

const optionalComplementText = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined
    }

    return value
  },

  z.string().trim().min(3).max(5000).optional()
)

export const createComplementSchema = z
  .object({
    text: optionalComplementText
  })
  .strict()

export type CreateComplementInput = z.infer<typeof createComplementSchema>
