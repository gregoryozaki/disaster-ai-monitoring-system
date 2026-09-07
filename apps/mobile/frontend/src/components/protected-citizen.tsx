"use client"

import { useEffect, type ReactNode } from "react"

import { useRouter } from "next/navigation"

import { useCitizenSession } from "@/components/citizen-session-provider"

interface ProtectedCitizenProps {
  children: ReactNode

  nextPath: string
}

export function ProtectedCitizen({
  children,
  nextPath
}: ProtectedCitizenProps) {
  const router = useRouter()

  const { user, agreementRequired, loading } = useCitizenSession()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`)

      return
    }

    if (agreementRequired) {
      router.replace(`/agreements?next=${encodeURIComponent(nextPath)}`)
    }
  }, [agreementRequired, loading, nextPath, router, user])

  if (loading || !user || agreementRequired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Carregando...
        </p>
      </main>
    )
  }

  return <>{children}</>
}
