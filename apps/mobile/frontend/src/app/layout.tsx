import type { Metadata, Viewport } from "next"

import "leaflet/dist/leaflet.css"

import "./globals.css"

import { CitizenSessionProvider } from "@/components/citizen-session-provider"

import { OfflineSyncListener } from "@/components/offline-sync-listener"

import { PwaServiceWorker } from "@/components/pwa-service-worker"

import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Kamara Cidadão",

  description: "Aplicativo para acompanhar e informar ocorrências ambientais.",

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

const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("kamara-theme");
    var theme = stored === "dark" ? "dark" : "light";

    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );

    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
  }
})();
`

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrapScript
          }}
        />
      </head>

      <body>
        <ThemeProvider>
          <CitizenSessionProvider>
            <PwaServiceWorker />

            <OfflineSyncListener />

            {children}
          </CitizenSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
