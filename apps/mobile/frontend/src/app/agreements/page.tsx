"use client"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"

import { useRouter } from "next/navigation"

import { ArrowLeft, ShieldCheck } from "lucide-react"

import { CURRENT_CITIZEN_REGISTRATION_AGREEMENT } from "@kamara/shared-types"

import { ShellHeader } from "@/components/shell-header"

import { useCitizenSession } from "@/components/citizen-session-provider"

import { api } from "@/lib/api"

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/agreements")
  ) {
    return "/"
  }

  return value
}

export default function AgreementsPage() {
  const router = useRouter()

  const {
    user,
    agreement,
    agreementRequired,
    loading,
    offline,
    refresh,
    logout
  } = useCitizenSession()

  const [nextPath, setNextPath] = useState("/")

  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  const [acceptedResponsibleUse, setAcceptedResponsibleUse] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    setNextPath(safeNextPath(query.get("next")))
  }, [])

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`)

      return
    }

    if (!agreementRequired) {
      router.replace(nextPath)
    }
  }, [agreementRequired, loading, nextPath, router, user])

  const agreementsAccepted =
    acceptedTerms && acceptedPrivacy && acceptedResponsibleUse

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    if (!agreementsAccepted) {
      setMessage("Confirme os três itens para continuar.")

      return
    }

    if (offline) {
      setMessage("É necessário estar conectado para registrar o aceite.")

      return
    }

    setSubmitting(true)

    try {
      await api.acceptCurrentAgreement(CURRENT_CITIZEN_REGISTRATION_AGREEMENT)

      await refresh()

      router.replace(nextPath)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o aceite."
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function leaveAccount() {
    await logout()

    router.replace("/")
  }

  if (loading || (!agreementRequired && user)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Carregando...
        </p>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 dark:bg-slate-950">
      <ShellHeader
        title="Documentos vigentes"
        subtitle="Confirme o aceite para continuar"
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
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />

            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Atualização de aceite
              </h1>

              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Para continuar utilizando as áreas autenticadas do Kamara,
                confirme os documentos vigentes.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <p>
              Termos:{" "}
              <strong>
                {agreement?.termsVersion ??
                  CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion}
              </strong>
            </p>

            <p className="mt-1">
              Privacidade:{" "}
              <strong>
                {agreement?.privacyVersion ??
                  CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion}
              </strong>
            </p>

            <p className="mt-1">
              Uso responsável:{" "}
              <strong>
                {agreement?.responsibleUseVersion ??
                  CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion}
              </strong>
            </p>
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

          {offline && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              Você está offline. Conecte-se à internet para registrar o aceite.
            </p>
          )}

          {message && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || offline || !agreementsAccepted}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {submitting ? "Registrando..." : "Aceitar e continuar"}
          </button>

          <button
            type="button"
            onClick={() => void leaveAccount()}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Sair da conta
          </button>
        </form>
      </section>
    </main>
  )
}
