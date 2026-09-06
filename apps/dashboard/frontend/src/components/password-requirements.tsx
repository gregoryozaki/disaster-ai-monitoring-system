"use client"

import {
  CheckCircle2,
  Circle
} from "lucide-react"

import {
  evaluatePassword,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

export function PasswordRequirements({
  password
}: {
  password: string
}) {
  const requirements = evaluatePassword(password)

  const items = [
    {
      valid: requirements.minimumLength,
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`
    },
    {
      valid: requirements.uppercase,
      label: "Uma letra maiúscula"
    },
    {
      valid: requirements.lowercase,
      label: "Uma letra minúscula"
    },
    {
      valid: requirements.number,
      label: "Um número"
    },
    {
      valid: requirements.specialCharacter,
      label: "Um caractere especial"
    }
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-700">
        A senha deve conter:
      </p>

      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.label}
            className={
              item.valid
                ? "flex items-center gap-2 text-xs text-emerald-700"
                : "flex items-center gap-2 text-xs text-slate-500"
            }
          >
            {item.valid ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" />
            )}

            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
