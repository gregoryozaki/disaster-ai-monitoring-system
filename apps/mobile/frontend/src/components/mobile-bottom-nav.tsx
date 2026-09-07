"use client"

import Link from "next/link"

import { usePathname } from "next/navigation"

import { Camera, History, Home, LogIn, UserRound } from "lucide-react"

import { useCitizenSession } from "@/components/citizen-session-provider"

interface NavigationItem {
  href: string

  label: string

  icon: typeof Home

  active: boolean

  protected?: boolean
}

export function MobileBottomNav() {
  const pathname = usePathname()

  const { user, agreementRequired, loading } = useCitizenSession()

  const authenticated = Boolean(user)

  function protectedHref(destination: string) {
    if (!authenticated) {
      return `/login?next=${encodeURIComponent(destination)}`
    }

    if (agreementRequired) {
      return `/agreements?next=${encodeURIComponent(destination)}`
    }

    return destination
  }

  const items: NavigationItem[] = [
    {
      href: "/",

      label: "Início",

      icon: Home,

      active: pathname === "/"
    },

    {
      href: protectedHref("/report"),

      label: "Registrar",

      icon: Camera,

      active: pathname.startsWith("/report"),

      protected: true
    },

    {
      href: protectedHref("/history"),

      label: "Histórico",

      icon: History,

      active:
        pathname.startsWith("/history") ||
        pathname.startsWith("/occurrences") ||
        pathname.startsWith("/offline-occurrences"),

      protected: true
    },

    {
      href: authenticated ? protectedHref("/profile") : "/login",

      label: authenticated ? "Perfil" : "Entrar",

      icon: authenticated ? UserRound : LogIn,

      active:
        pathname.startsWith("/profile") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/agreements") ||
        pathname.startsWith("/terms") ||
        pathname.startsWith("/manual"),

      protected: authenticated
    }
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 z-[1000] grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      {items.map((item) => {
        const Icon = item.icon

        const temporarilyDisabled = loading && item.protected

        return (
          <Link
            key={item.label}
            href={temporarilyDisabled ? "/" : item.href}
            aria-disabled={temporarilyDisabled}
            className={[
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition",

              item.active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",

              temporarilyDisabled ? "pointer-events-none opacity-50" : ""
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />

            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
