"use client"

import Link from "next/link"

import {
  FormEvent,
  useEffect,
  useState
} from "react"

import {
  CheckCircle2,
  KeyRound
} from "lucide-react"

import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

import { PasswordField } from "@/components/password-field"

import { PasswordRequirements } from "@/components/password-requirements"

import { api } from "@/lib/api"

export default function ResetPasswordPage() {
  const [token, setToken] = useState("")

  const [password, setPassword] = useState("")

  const [confirmation, setConfirmation] = useState("")

  const [message, setMessage] = useState<string | null>(null)

  const [success, setSuccess] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    const tokenFromUrl = query.get("token")

    if (tokenFromUrl) {
      setToken(tokenFromUrl)
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (!isStrongPassword(password)) {
      setMessage("A nova senha ainda não atende a todos os requisitos.")

      return
    }

    if (password !== confirmation) {
      setMessage("As senhas não coincidem.")

      return
    }

    setSubmitting(true)

    try {
      const response = await api.resetPassword({
        token,
        password
      })

      setMessage(response.data.message)

      setSuccess(true)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível redefinir a senha."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <KeyRound className="h-5 w-5" />
          </div>

          <h1 className="text-xl font-semibold text-slate-900">
            Definir nova senha
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Crie uma nova senha para sua conta Kamara.
          </p>
        </div>

        {message && (
          <p
            className={
              success
                ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                : "mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            }
          >
            {message}
          </p>
        )}

        {success ? (
          <div className="space-y-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-700" />

            <Link
              href="/"
              className="block w-full rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Entrar novamente
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Token de redefinição
              </span>

              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="Token recebido"
              />
            </label>

            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
            />

            <PasswordRequirements password={password} />

            <PasswordField
              label="Confirmar nova senha"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
            />

            {confirmation && password !== confirmation && (
              <p className="text-xs text-red-600">
                As senhas ainda não coincidem.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Redefinindo..."
                : "Redefinir senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
