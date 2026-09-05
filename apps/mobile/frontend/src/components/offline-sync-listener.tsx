"use client"

import { useEffect } from "react"

import { api } from "@/lib/api"

import { syncAllOfflineOccurrences } from "@/lib/offline-sync"

export function OfflineSyncListener() {
  useEffect(() => {
    let disposed = false
    let running = false

    async function syncIfPossible() {
      if (disposed || running || !navigator.onLine) {
        return
      }

      running = true

      try {
        const session = await api.me()

        if (disposed || session.data.role !== "CITIZEN") {
          return
        }

        await syncAllOfflineOccurrences()
      } catch {
      } finally {
        running = false
      }
    }

    function handleOnline() {
      void syncIfPossible()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncIfPossible()
      }
    }

    function handleFocus() {
      void syncIfPossible()
    }

    window.addEventListener("online", handleOnline)

    window.addEventListener("focus", handleFocus)

    document.addEventListener("visibilitychange", handleVisibilityChange)

    void syncIfPossible()

    return () => {
      disposed = true

      window.removeEventListener("online", handleOnline)

      window.removeEventListener("focus", handleFocus)

      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
