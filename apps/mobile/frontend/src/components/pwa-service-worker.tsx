"use client"

import { useEffect } from "react"

export function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister())
          )
        )
        .catch(() => undefined)

      return
    }

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/"
      })
      .catch(() => undefined)

    function handleOfflineLink(event: MouseEvent) {
      if (navigator.onLine || !navigator.serviceWorker.controller) {
        return
      }

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      if (!(event.target instanceof Element)) {
        return
      }

      const anchor = event.target.closest("a")

      if (!anchor) {
        return
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return
      }

      const url = new URL(anchor.href, window.location.href)

      if (url.origin !== window.location.origin) {
        return
      }

      event.preventDefault()

      event.stopPropagation()

      window.location.assign(url.href)
    }

    document.addEventListener("click", handleOfflineLink, true)

    return () => {
      document.removeEventListener("click", handleOfflineLink, true)
    }
  }, [])

  return null
}
