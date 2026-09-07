"use client"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"

import { useRouter } from "next/navigation"

import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  KeyRound,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  WifiOff,
  X
} from "lucide-react"

import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH
} from "@kamara/shared-types"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { PasswordField } from "@/components/password-field"

import { PasswordRequirements } from "@/components/password-requirements"

import { ShellHeader } from "@/components/shell-header"

import { useCitizenSession } from "@/components/citizen-session-provider"

import { useTheme } from "@/components/theme-provider"

import { ApiError, api, isApiNetworkError } from "@/lib/api"

export default function ProfilePage() {
  const router = useRouter()

  const { user, loading, offline, logout } = useCitizenSession()

  const { theme, setTheme } = useTheme()

  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")

  const [newPassword, setNewPassword] = useState("")

  const [confirmation, setConfirmation] = useState("")

  const [changingPassword, setChangingPassword] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=%2Fprofile")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-slate-50 dark:bg-slate-950">
        <ShellHeader title="Perfil" subtitle="Sua conta Kamara" />

        <div className="p-6 text-center text-sm text-slate-500">
          Carregando...
        </div>
      </main>
    )
  }

  function resetPasswordForm() {
    setCurrentPassword("")

    setNewPassword("")

    setConfirmation("")

    setMessage(null)
  }

  function closePasswordForm() {
    if (changingPassword) {
      return
    }

    resetPasswordForm()

    setPasswordFormOpen(false)
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)

    setSuccessMessage(null)

    if (offline) {
      setMessage("Você precisa estar conectado para alterar a senha.")

      return
    }

    if (!currentPassword) {
      setMessage("Digite sua senha atual.")

      return
    }

    if (!isStrongPassword(newPassword)) {
      setMessage("A nova senha ainda não atende a todos os requisitos.")

      return
    }

    if (currentPassword === newPassword) {
      setMessage("A nova senha deve ser diferente da senha atual.")

      return
    }

    if (newPassword !== confirmation) {
      setMessage("A confirmação da nova senha não coincide.")

      return
    }

    setChangingPassword(true)

    try {
      const response = await api.changePassword({
        currentPassword,

        newPassword
      })

      resetPasswordForm()

      setPasswordFormOpen(false)

      setSuccessMessage(response.data.message)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "INVALID_CURRENT_PASSWORD"
      ) {
        setMessage("A senha atual está incorreta.")

        return
      }

      if (error instanceof ApiError && error.code === "PASSWORD_UNCHANGED") {
        setMessage("A nova senha deve ser diferente da senha atual.")

        return
      }

      setMessage(
        isApiNetworkError(error)
          ? "Não foi possível alterar a senha sem conexão com o servidor."
          : error instanceof Error
            ? error.message
            : "Não foi possível alterar a senha."
      )
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    await logout()

    router.replace("/")
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24 dark:bg-slate-950">
      <ShellHeader title="Perfil" subtitle="Sua conta Kamara" />

      <section className="space-y-4 p-5">
        {offline && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />

            <p>
              Você está sem internet. Algumas opções de conta ficam
              temporariamente indisponíveis.
            </p>
          </div>
        )}

        {successMessage && (
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

            <p>{successMessage}</p>
          </div>
        )}

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <UserRound className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {user.name ?? "Cidadão"}
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Conta de cidadão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400" />

            <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">
              {user.email}
            </span>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Segurança
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Gerencie a senha usada para acessar sua conta.
            </p>
          </div>

          {!passwordFormOpen ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null)

                setSuccessMessage(null)

                setPasswordFormOpen(true)
              }}
              disabled={offline}
              className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <KeyRound className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Alterar senha
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  As outras sessões da conta serão encerradas.
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          ) : (
            <form
              onSubmit={(event) => void changePassword(event)}
              className="space-y-4 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Alterar senha
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sua sessão atual continuará ativa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePasswordForm}
                  disabled={changingPassword}
                  aria-label="Fechar alteração de senha"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <PasswordField
                label="Senha atual"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                maxLength={PASSWORD_MAX_LENGTH}
                placeholder="Digite sua senha atual"
              />

              <PasswordField
                label="Nova senha"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                placeholder="Crie uma nova senha forte"
              />

              <PasswordRequirements password={newPassword} />

              <PasswordField
                label="Confirmar nova senha"
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                placeholder="Digite novamente a nova senha"
              />

              {confirmation && newPassword !== confirmation && (
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
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !isStrongPassword(newPassword) ||
                  newPassword !== confirmation
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                <KeyRound className="h-4 w-4" />

                {changingPassword ? "Alterando..." : "Alterar senha"}
              </button>
            </form>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Aparência
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Escolha como o Kamara aparece neste aparelho.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${
                theme === "light"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Sun className="h-4 w-4" />
              Claro
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${
                theme === "dark"
                  ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <Moon className="h-4 w-4" />
              Escuro
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Informação e ajuda
            </h2>
          </div>

          <Link
            href="/terms"
            className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <FileText className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Termos e privacidade
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Uso responsável e tratamento das informações.
              </p>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>

          <Link href="/manual" className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Manual do usuário
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Veja como registrar e acompanhar ocorrências.
              </p>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
        </article>

        <article className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />

          <p className="text-xs leading-relaxed">
            O Kamara é um sistema acadêmico de apoio ao registro e à análise de
            ocorrências. A análise final permanece sob responsabilidade humana.
          </p>
        </article>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-700 dark:border-red-900 dark:bg-slate-900 dark:text-red-300"
        >
          <LogOut className="h-5 w-5" />
          Sair da conta
        </button>
      </section>

      <MobileBottomNav />
    </main>
  )
}
