"use client"

import { useEffect, type MouseEvent, type ReactNode } from "react"

import { AlertTriangle, X } from "lucide-react"

type DialogTone = "default" | "warning" | "danger" | "success"

interface DecisionDialogProps {
  open: boolean

  title: string

  description?: string

  confirmLabel: string

  cancelLabel?: string

  submitting?: boolean

  tone?: DialogTone

  children?: ReactNode

  onConfirm: () => void

  onClose: () => void
}

const toneClasses: Record<
  DialogTone,
  {
    icon: string
    confirm: string
  }
> = {
  default: {
    icon: "bg-blue-100 text-blue-700",

    confirm: "bg-blue-700 text-white hover:bg-blue-800"
  },

  warning: {
    icon: "bg-orange-100 text-orange-700",

    confirm: "bg-orange-600 text-white hover:bg-orange-700"
  },

  danger: {
    icon: "bg-red-100 text-red-700",

    confirm: "bg-red-700 text-white hover:bg-red-800"
  },

  success: {
    icon: "bg-emerald-100 text-emerald-700",

    confirm: "bg-emerald-700 text-white hover:bg-emerald-800"
  }
}

export function DecisionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  submitting = false,
  tone = "default",
  children,
  onConfirm,
  onClose
}: DecisionDialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)

      document.body.style.overflow = previousOverflow
    }
  }, [open, submitting, onClose])

  if (!open) {
    return null
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose()
    }
  }

  const classes = toneClasses[tone]

  return (
    <div
      role="presentation"
      onMouseDown={handleBackdropClick}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classes.icon}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="decision-dialog-title"
                className="text-lg font-semibold text-slate-900"
              >
                {title}
              </h2>

              {description && (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {children && <div className="p-5">{children}</div>}

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${classes.confirm}`}
          >
            {submitting ? "Registrando..." : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
