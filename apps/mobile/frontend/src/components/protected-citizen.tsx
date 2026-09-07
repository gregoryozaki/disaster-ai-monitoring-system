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

  const { user, loading } = useCitizenSession()

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
    }
  }, [loading, nextPath, router, user])

  if (loading || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-slate-50 px-6">
        <p className="text-sm text-slate-500">Carregando...</p>
      </main>
    )
  }

  return <>{children}</>
}
