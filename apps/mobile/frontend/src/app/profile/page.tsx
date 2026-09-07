"use client"

import { useEffect } from "react"

import { useRouter } from "next/navigation"

import { LogOut, Mail, UserRound, WifiOff } from "lucide-react"

import { ShellHeader } from "@/components/shell-header"

import { useCitizenSession } from "@/components/citizen-session-provider"

export default function ProfilePage() {
  const router = useRouter()

  const { user, loading, offline, logout } = useCitizenSession()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=%2Fprofile")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-slate-50">
        <ShellHeader title="Perfil" subtitle="Sua conta Kamara" />

        <div className="p-6 text-center text-sm text-slate-500">
          Carregando...
        </div>
      </main>
    )
  }

  async function handleLogout() {
    await logout()

    router.replace("/")
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <ShellHeader title="Perfil" subtitle="Sua conta Kamara" />

      <section className="space-y-4 p-5">
        {offline && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />

            <p>
              Você está sem internet. Algumas opções podem ficar temporariamente
              indisponíveis.
            </p>
          </div>
        )}

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <UserRound className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate font-semibold text-slate-900">
                {user.name ?? "Cidadão"}
              </h1>

              <p className="text-sm text-slate-500">Conta de cidadão</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <Mail className="h-5 w-5 text-slate-500" />

            <span className="min-w-0 truncate text-sm text-slate-700">
              {user.email}
            </span>
          </div>
        </article>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-700"
        >
          <LogOut className="h-5 w-5" />
          Sair da conta
        </button>
      </section>
    </main>
  )
}
