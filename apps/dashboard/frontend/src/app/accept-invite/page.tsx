"use client"

import { type FormEvent, useEffect, useState } from "react"

import Image from "next/image"

import Link from "next/link"

import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

import { CheckCircle2, KeyRound } from "lucide-react"

import { PasswordField } from "@/components/password-field"

import { PasswordRequirements } from "@/components/password-requirements"

import { api, type ApiAdministrativeUser } from "@/lib/api"

export default function AcceptInvitePage() {
  const [token, setToken] = useState("")

  const [password, setPassword] = useState("")

  const [passwordConfirmation, setPasswordConfirmation] = useState("")

  const [submitting, setSubmitting] = useState(false)

  const [acceptedUser, setAcceptedUser] =
    useState<ApiAdministrativeUser | null>(null)

  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    const tokenFromUrl = query.get("token")

    if (tokenFromUrl) {
      setToken(tokenFromUrl)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (!isStrongPassword(password)) {
      setMessage("A senha ainda não atende a todos os requisitos.")

      return
    }

    if (password !== passwordConfirmation) {
      setMessage("As senhas não coincidem.")

      return
    }

    setSubmitting(true)

    try {
      const response = await api.acceptManagerInvite({
        token,
        password
      })

      setAcceptedUser(response.data)

      setPassword("")

      setPasswordConfirmation("")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível aceitar o convite."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/kamara-logo.png"
            alt="Kamara"
            width={46}
            height={46}
            className="rounded"
          />

          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Ativar conta de gestor
            </h1>

            <p className="text-sm text-slate-500">Kamara</p>
          </div>
        </div>

        {acceptedUser ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-700" />

              <p className="font-semibold text-emerald-900">Conta ativada</p>

              <p className="mt-1 text-sm text-emerald-800">
                {acceptedUser.email} agora está ativo como gestor.
              </p>
            </div>

            <Link
              href="/"
              className="block w-full rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4"
          >
            {message && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {message}
              </p>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Token do convite
              </span>

              <input
                required
                minLength={32}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="Cole o token do convite"
                autoComplete="off"
              />
            </label>

            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              placeholder="Crie uma senha forte"
            />

            <PasswordRequirements password={password} />

            <PasswordField
              label="Confirmar senha"
              value={passwordConfirmation}
              onChange={setPasswordConfirmation}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              placeholder="Digite novamente a senha"
            />

            {passwordConfirmation && password !== passwordConfirmation && (
              <p className="text-xs text-red-600">
                As senhas ainda não coincidem.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />

              {submitting ? "Ativando..." : "Ativar conta"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
