"use client"

import { useState } from "react"

import { Eye, EyeOff } from "lucide-react"

interface PasswordFieldProps {
  label: string

  value: string

  onChange: (value: string) => void

  placeholder?: string

  autoComplete?: string

  required?: boolean

  minLength?: number

  maxLength?: number
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  minLength,
  maxLength = 128
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none focus:border-emerald-600"
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          title={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  )
}
