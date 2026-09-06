import { z } from "zod"

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export interface PasswordRequirements {
  minimumLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  specialCharacter: boolean
}

export function evaluatePassword(
  password: string
): PasswordRequirements {
  return {
    minimumLength: password.length >= PASSWORD_MIN_LENGTH,

    uppercase: /\p{Lu}/u.test(password),

    lowercase: /\p{Ll}/u.test(password),

    number: /\p{N}/u.test(password),

    specialCharacter: /[^\p{L}\p{N}\s]/u.test(password)
  }
}

export function isStrongPassword(password: string): boolean {
  const requirements = evaluatePassword(password)

  return Object.values(requirements).every(Boolean)
}

export const newPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `A senha deve possuir pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `A senha deve possuir no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  )
  .superRefine((password, ctx) => {
    const requirements = evaluatePassword(password)

    if (!requirements.uppercase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A senha deve possuir pelo menos uma letra maiúscula."
      })
    }

    if (!requirements.lowercase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A senha deve possuir pelo menos uma letra minúscula."
      })
    }

    if (!requirements.number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A senha deve possuir pelo menos um número."
      })
    }

    if (!requirements.specialCharacter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A senha deve possuir pelo menos um caractere especial."
      })
    }
  })
