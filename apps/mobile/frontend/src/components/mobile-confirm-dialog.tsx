"use client"

import { useEffect, type MouseEvent, type ReactNode } from "react"

import { AlertTriangle, X } from "lucide-react"

interface MobileConfirmDialogProps {
  open: boolean

  title: string

  description: string

  confirmLabel: string

  submitting?: boolean

  danger?: boolean

  children?: ReactNode

  onConfirm: () => void

  onClose: () => void
}

export function MobileConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  submitting = false,
  danger = false,
  children,
  onConfirm,
  onClose
}: MobileConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow

      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, submitting, onClose])

  if (!open) {
    return null
  }

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose()
    }
  }

  return (
    <div
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-[3000] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-confirm-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="mobile-confirm-title"
              className="font-semibold text-slate-900"
            >
              {title}
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {children && <div className="p-5">{children}</div>}

        <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded-xl px-3 py-3 text-sm font-semibold text-white disabled:bg-slate-300 ${
              danger ? "bg-red-700" : "bg-emerald-700"
            }`}
          >
            {submitting ? "Aguarde..." : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
