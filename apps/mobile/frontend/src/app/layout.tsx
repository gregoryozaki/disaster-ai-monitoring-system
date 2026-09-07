import type { Metadata, Viewport } from "next"

import "leaflet/dist/leaflet.css"

import "./globals.css"

import { OfflineSyncListener } from "@/components/offline-sync-listener"

import { PwaServiceWorker } from "@/components/pwa-service-worker"

export const metadata: Metadata = {
  title: "Kamara Cidadão",

  description: "PWA para registro e acompanhamento de ocorrências ambientais.",

  applicationName: "Kamara",

  other: {
    "mobile-web-app-capable": "yes"
  },

  manifest: "/manifest.webmanifest",

  icons: {
    icon: "/kamara-logo.png",

    apple: "/kamara-logo.png"
  },

  appleWebApp: {
    capable: true,

    title: "Kamara",

    statusBarStyle: "default"
  }
}

export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  themeColor: "#047857"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaServiceWorker />

        <OfflineSyncListener />

        {children}
      </body>
    </html>
  )
}
