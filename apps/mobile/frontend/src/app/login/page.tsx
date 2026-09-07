"use client"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"

import { useRouter } from "next/navigation"

import { ArrowLeft, LogIn } from "lucide-react"

import { PasswordField } from "@/components/password-field"

import { ShellHeader } from "@/components/shell-header"

import { useCitizenSession } from "@/components/citizen-session-provider"

import { api } from "@/lib/api"

import { saveCitizenSession } from "@/lib/local-session"

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }

  return value
}

export default function LoginPage() {
  const router = useRouter()

  const { refresh } = useCitizenSession()

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [nextPath, setNextPath] = useState("/")

  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    setNextPath(safeNextPath(query.get("next")))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    setSubmitting(true)

    try {
      const response = await api.login({
        email,
        password
      })

      if (response.data.role !== "CITIZEN") {
        setMessage("Esta área é exclusiva para cidadãos.")

        return
      }

      saveCitizenSession(response.data)

      await refresh()

      setPassword("")

      router.replace(nextPath)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar na sua conta."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <ShellHeader title="Entrar" subtitle="Acesse sua conta Kamara" />

      <section className="p-5">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Bem-vindo de volta
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Entre para registrar e acompanhar suas ocorrências.
            </p>
          </div>

          <form onSubmit={(event) => void submit(event)} className="space-y-4">
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
                placeholder="voce@exemplo.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-600"
              />
            </label>

            <PasswordField
              label="Senha"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="Digite sua senha"
            />

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-emerald-700"
              >
                Esqueci minha senha
              </Link>
            </div>

            {message && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />

              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-500">
              Ainda não possui uma conta?
            </p>

            <Link
              href={`/register?next=${encodeURIComponent(nextPath)}`}
              className="mt-2 inline-block font-semibold text-emerald-700"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
