"use client"

import { useEffect, useState } from "react"
import { Activity, Download, Timer, TrendingUp } from "lucide-react"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { DashboardShell } from "@/components/dashboard-shell"
import { api, AnalyticsSummary } from "@/lib/api"
import { statusLabels } from "@/lib/labels"

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  useEffect(() => {
    void api
      .getAnalyticsSummary()
      .then((response) => setSummary(response.data))
      .catch((error) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar analytics."
        )
      )
  }, [])

  async function requestExport(format: "CSV" | "JSON") {
    setExportMessage(null)

    try {
      const response = await api.requestExport(format)

      if (response.data.status !== "READY") {
        setExportMessage(
          `Exportação criada com status ${response.data.status}.`
        )

        return
      }

      const download = await api.downloadExport(response.data.id)

      const url = URL.createObjectURL(download.blob)

      const anchor = document.createElement("a")

      anchor.href = url

      anchor.download = download.filename

      document.body.appendChild(anchor)

      anchor.click()

      anchor.remove()

      URL.revokeObjectURL(url)

      setExportMessage(`Exportação ${format} concluída e baixada.`)
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a exportação."
      )
    }
  }

  const byStatus = summary?.byStatus ?? {}
  const statusKeys = [
    "UNDER_REVIEW",
    "CONFIRMED",
    "NEEDS_MORE_INFO",
    "PENDING_SYNC"
  ] as const
  const statusData = statusKeys.map((status) => ({
    name: statusLabels[status],
    value: byStatus[status] ?? 0
  }))
  const categoryData =
    summary?.byCategory.map((item) => ({
      name: item.category.name,
      value: item.count
    })) ?? []
  const trendData = [
    {
      day: "Atual",
      ocorrencias: summary?.total ?? 0,
      confirmadas: summary?.confirmed ?? 0
    }
  ]
  const cards = [
    {
      label: "Total de ocorrencias",
      value: String(summary?.total ?? 0),
      icon: Activity
    },
    {
      label: "Taxa de confirmacao",
      value: `${Math.round((summary?.confirmationRate ?? 0) * 100)}%`,
      icon: TrendingUp
    },
    { label: "Tempo medio de pre-analise", value: "API", icon: Timer },
    {
      label: "Exportacoes solicitadas",
      value: exportMessage ? "1" : "0",
      icon: Download
    }
  ]

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Painel analitico
        </h1>
        <p className="text-sm text-slate-500">
          Indicadores retornados pelo endpoint atual de analytics.
        </p>
      </header>
      <main className="space-y-6 p-6">
        {message && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {message}
          </p>
        )}
        <section className="grid gap-4 md:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <article
                key={card.label}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <Icon className="mb-3 h-6 w-6 text-emerald-700" />
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </article>
            )
          })}
        </section>

        <AnalyticsCharts
          statusData={statusData}
          categoryData={categoryData}
          trendData={trendData}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Exportacao</h2>
              <p className="text-sm text-slate-600">
                Solicitacao enviada para o endpoint de exportacao da API.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => void requestExport("CSV")}
                className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
              >
                Exportar CSV
              </button>
              <button
                onClick={() => void requestExport("JSON")}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Exportar JSON
              </button>
            </div>
          </div>
          {exportMessage && (
            <p className="text-xs text-slate-500">{exportMessage}</p>
          )}
        </section>
      </main>
    </DashboardShell>
  )
}
