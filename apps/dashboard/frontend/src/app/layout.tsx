import type { Metadata } from "next"

import "leaflet/dist/leaflet.css"

import "./globals.css"

export const metadata: Metadata = {
  title: "Kamara Dashboard",

  description: "Dashboard operacional, analítico e administrativo do Kamara."
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
