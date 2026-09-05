import { z } from "zod"

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase())

const passwordSchema = z.string().min(8).max(128)

export const createManagerInviteSchema = z
  .object({
    name: z.string().trim().min(2).max(100),

    email: emailSchema
  })
  .strict()

export const acceptManagerInviteSchema = z
  .object({
    token: z.string().trim().min(32).max(256),

    password: passwordSchema
  })
  .strict()

export const updateManagerStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"])
  })
  .strict()

export type CreateManagerInviteInput = z.infer<typeof createManagerInviteSchema>

export type AcceptManagerInviteInput = z.infer<typeof acceptManagerInviteSchema>

export type UpdateManagerStatusInput = z.infer<typeof updateManagerStatusSchema>
