import { z } from "zod"

import { createOccurrenceSchema } from "./occurrence.schema.js"

export const syncOccurrenceSchema = createOccurrenceSchema.extend({
  clientLocalId: z.string().trim().min(1).max(255),

  idempotencyKey: z.string().uuid(),

  reportedAt: z.string().datetime({
    offset: true
  })
})

export type SyncOccurrenceInput = z.infer<typeof syncOccurrenceSchema>
