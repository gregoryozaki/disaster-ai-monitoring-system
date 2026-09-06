"use client"

import Link from "next/link"

import { FormEvent, useState } from "react"

import {
  ArrowLeft,
  KeyRound
} from "lucide-react"

import { api } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")

  const [message, setMessage] = useState<string | null>(null)

  const [developmentToken, setDevelopmentToken] =
    useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitting(true)
    setMessage(null)
    setDevelopmentToken(null)

    try {
      const response = await api.requestPasswordReset({
        email
      })

      setMessage(response.data.message)

      setDevelopmentToken(
        response.data.developmentResetToken ?? null
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a recuperação de senha."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>

        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <KeyRound className="h-5 w-5" />
          </div>

          <h1 className="text-xl font-semibold text-slate-900">
            Recuperar senha
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Informe o e-mail associado à sua conta Kamara.
          </p>
        </div>

        {message && (
          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {message}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              E-mail
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="voce@exemplo.com"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processando..."
              : "Solicitar redefinição"}
          </button>
        </form>

        {developmentToken && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-900">
              Ambiente de desenvolvimento
            </p>

            <p className="mt-1 text-xs text-amber-800">
              O envio de e-mail ainda não está configurado. Use o token de
              desenvolvimento para continuar o fluxo.
            </p>

            <Link
              href={`/reset-password?token=${encodeURIComponent(
                developmentToken
              )}`}
              className="mt-3 block rounded-lg bg-amber-700 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              Continuar para redefinição
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
