"use client"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"

import { useRouter } from "next/navigation"

import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react"

import {
  CURRENT_CITIZEN_REGISTRATION_AGREEMENT,
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

  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  const [acceptedResponsibleUse, setAcceptedResponsibleUse] = useState(false)

  const [nextPath, setNextPath] = useState("/")

  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    setNextPath(safeNextPath(query.get("next")))
  }, [])

  const agreementsAccepted =
    acceptedTerms && acceptedPrivacy && acceptedResponsibleUse

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

    if (!acceptedTerms || !acceptedPrivacy || !acceptedResponsibleUse) {
      setMessage(
        "Confirme os termos, a privacidade e o compromisso de uso responsável para criar a conta."
      )

      return
    }

    setSubmitting(true)

    try {
      await api.registerCitizen({
        name,
        email,
        password,

        agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
      })

      const loginResponse = await api.login({
        email,
        password
      })

      saveCitizenSession(loginResponse.data, loginResponse.agreement)

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
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 dark:bg-slate-950">
      <ShellHeader
        title="Criar conta"
        subtitle="Cadastre-se para informar ocorrências"
      />

      <section className="p-5">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nome
            </span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              placeholder="Seu nome"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              E-mail
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="voce@exemplo.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            <p className="text-sm text-red-600 dark:text-red-300">
              As senhas ainda não coincidem.
            </p>
          )}

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />

              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Antes de criar sua conta
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Confirme os itens abaixo para utilizar o Kamara.
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span>
                Li e concordo com os{" "}
                <Link
                  href="/terms"
                  className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 dark:text-emerald-300"
                  onClick={(event) => event.stopPropagation()}
                >
                  Termos de Uso
                </Link>
                .
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span>
                Li as informações sobre privacidade e tratamento dos dados
                apresentados pelo Kamara.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={acceptedResponsibleUse}
                onChange={(event) =>
                  setAcceptedResponsibleUse(event.target.checked)
                }
                className="mt-1 h-4 w-4 shrink-0"
              />

              <span>
                Comprometo-me a utilizar o sistema de boa-fé e a não enviar
                deliberadamente ocorrências falsas ou informações enganosas.
              </span>
            </label>

            {agreementsAccepted && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                Termos, privacidade e compromisso de uso responsável
                confirmados.
              </div>
            )}
          </section>

          {message && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !agreementsAccepted}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <UserPlus className="h-4 w-4" />

            {submitting ? "Criando conta..." : "Criar conta"}
          </button>

          {!agreementsAccepted && (
            <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Os três itens acima precisam ser confirmados antes da criação da
              conta.
            </p>
          )}

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Já possui conta?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-emerald-700 dark:text-emerald-300"
            >
              Entrar
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
