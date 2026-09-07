"use client"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"

import { useRouter } from "next/navigation"

import { ArrowLeft, UserPlus } from "lucide-react"

import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

import { PasswordField } from "@/components/password-field"

import { PasswordRequirements } from "@/components/password-requirements"

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

export default function RegisterPage() {
  const router = useRouter()

  const { refresh } = useCitizenSession()

  const [name, setName] = useState("")

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [confirmation, setConfirmation] = useState("")

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

    if (!isStrongPassword(password)) {
      setMessage("A senha ainda não atende a todos os requisitos.")

      return
    }

    if (password !== confirmation) {
      setMessage("As senhas não coincidem.")

      return
    }

    setSubmitting(true)

    try {
      await api.registerCitizen({
        name,
        email,
        password
      })

      const loginResponse = await api.login({
        email,
        password
      })

      saveCitizenSession(loginResponse.data)

      await refresh()

      setPassword("")

      setConfirmation("")

      router.replace(nextPath)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar sua conta."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <ShellHeader
        title="Criar conta"
        subtitle="Cadastre-se para informar ocorrências"
      />

      <section className="p-5">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Nome
            </span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              placeholder="Seu nome"
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-600"
            />
          </label>

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
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="Crie uma senha forte"
          />

          <PasswordRequirements password={password} />

          <PasswordField
            label="Confirmar senha"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="Digite novamente a senha"
          />

          {confirmation && password !== confirmation && (
            <p className="text-sm text-red-600">
              As senhas ainda não coincidem.
            </p>
          )}

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
            <UserPlus className="h-4 w-4" />

            {submitting ? "Criando conta..." : "Criar conta"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Já possui conta?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-emerald-700"
            >
              Entrar
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
