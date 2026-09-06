export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export interface PasswordRequirements {
  minimumLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  specialCharacter: boolean
}

export function evaluatePassword(password: string): PasswordRequirements {
  return {
    minimumLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /\p{Lu}/u.test(password),
    lowercase: /\p{Ll}/u.test(password),
    number: /\p{N}/u.test(password),
    specialCharacter: /[^\p{L}\p{N}\s]/u.test(password)
  }
}

export function isStrongPassword(password: string): boolean {
  if (password.length > PASSWORD_MAX_LENGTH) {
    return false
  }

  const requirements = evaluatePassword(password)

  return Object.values(requirements).every(Boolean)
}
