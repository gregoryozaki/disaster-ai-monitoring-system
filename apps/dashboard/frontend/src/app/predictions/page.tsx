"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"

import { AlertTriangle, DatabaseZap, Loader2, Sparkles } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"

import { CategoryIcon } from "@/components/category-icon"

import { RiskBadge } from "@/components/badges"

import { api, ApiCategory, ApiPrediction } from "@/lib/api"

import { categoryType } from "@/lib/category"

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<ApiPrediction[]>([])

  const [categories, setCategories] = useState<ApiCategory[]>([])

  const [categoryId, setCategoryId] = useState("")

  const [regionName, setRegionName] = useState("Manaus - AM")

  const [horizonHours, setHorizonHours] = useState(48)

  const [warning, setWarning] = useState(
    "Previsão não é alerta oficial. Este componente é experimental."
  )

  const [message, setMessage] = useState<string | null>(null)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  const [generating, setGenerating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    try {
      const [predictionsResponse, categoriesResponse] = await Promise.all([
        api.listPredictions(),
        api.listCategories()
      ])

      setPredictions(predictionsResponse.data)

      setCategories(categoriesResponse.data)

      if (predictionsResponse.warning) {
        setWarning(predictionsResponse.warning)
      }

      setCategoryId(
        (current) => current || categoriesResponse.data[0]?.id || ""
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as previsões."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)
    setSuccessMessage(null)

    if (!categoryId) {
      setMessage("Selecione uma categoria.")

      return
    }

    if (regionName.trim().length < 3) {
      setMessage("Informe uma região válida.")

      return
    }

    setGenerating(true)

    try {
      const response = await api.generatePrediction({
        categoryId,

        regionName: regionName.trim(),

        horizonHours
      })

      if (response.warning) {
        setWarning(response.warning)
      }

      setSuccessMessage(
        "Previsão experimental gerada e persistida com sucesso."
      )

      await loadData()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a previsão."
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Previsão de risco
        </h1>

        <p className="text-sm text-slate-500">
          Estimativas experimentais para demonstração da arquitetura de apoio à
          decisão.
        </p>
      </header>

      <main className="space-y-6 p-6">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-medium">Componente experimental</p>

            <p className="mt-1">{warning}</p>

            <p className="mt-1">
              O baseline atual utiliza regras fixas e dados sintéticos. Não
              utiliza dados meteorológicos, hidrológicos ou ambientais reais.
            </p>
          </div>
        </div>

        {message && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {message}
          </p>
        )}

        {successMessage && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />

              <h2 className="font-semibold text-slate-900">
                Gerar previsão experimental
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-600">
              A previsão será processada pelo serviço de IA e persistida no
              PostgreSQL.
            </p>
          </div>

          <form onSubmit={handleGenerate} className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Categoria COBRADE
              </span>

              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={generating || categories.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600"
                required
              >
                {categories.length === 0 && (
                  <option value="">Nenhuma categoria disponível</option>
                )}

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.cobradeCode} - {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Região</span>

              <input
                type="text"
                value={regionName}
                onChange={(event) => setRegionName(event.target.value)}
                minLength={3}
                maxLength={160}
                disabled={generating}
                placeholder="Ex.: Manaus - AM / Zona Norte"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Horizonte
              </span>

              <select
                value={horizonHours}
                onChange={(event) =>
                  setHorizonHours(Number(event.target.value))
                }
                disabled={generating}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600"
              >
                <option value={24}>24 horas</option>

                <option value={48}>48 horas</option>

                <option value={72}>72 horas</option>

                <option value={120}>120 horas</option>

                <option value={168}>168 horas</option>
              </select>
            </label>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={generating || !categoryId}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar previsão experimental
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Histórico de previsões
            </h2>

            <p className="text-sm text-slate-500">
              Registros persistidos no banco de dados.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando previsões...
            </div>
          ) : predictions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium text-slate-800">
                Nenhuma previsão registrada
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Gere uma previsão experimental usando o formulário acima.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {predictions.map((prediction) => (
                <article
                  key={prediction.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                        <CategoryIcon
                          type={categoryType(prediction.category)}
                        />
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {prediction.regionName}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {prediction.category.cobradeCode} -{" "}
                          {prediction.category.name}
                        </p>

                        <p className="text-xs text-slate-400">
                          Horizonte: {prediction.horizonHours}h
                        </p>
                      </div>
                    </div>

                    <RiskBadge level={prediction.riskLevel} />
                  </div>

                  <p className="mb-4 text-sm leading-relaxed text-slate-700">
                    {prediction.explanationSimple}
                  </p>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Probabilidade</dt>

                      <dd className="font-semibold text-slate-900">
                        {Math.round(prediction.probability * 100)}%
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Tendência</dt>

                      <dd className="font-semibold text-slate-900">
                        {prediction.trend}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Tipo</dt>

                      <dd className="font-semibold text-slate-900">
                        {prediction.synthetic ? "Sintética" : "Não sintética"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Gerada em</dt>

                      <dd className="font-semibold text-slate-900">
                        {new Date(prediction.validFrom).toLocaleString("pt-BR")}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                      <DatabaseZap className="h-4 w-4" />
                      Proveniência
                    </div>

                    <p>
                      Fontes:{" "}
                      {prediction.sources.length > 0
                        ? prediction.sources.join(", ")
                        : "nenhuma fonte externa real associada"}
                      .
                    </p>

                    <p className="mt-1">Modelo: {prediction.modelVersion}.</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  )
}
