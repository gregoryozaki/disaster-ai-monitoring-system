import { AlertTriangle, DatabaseZap } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CategoryIcon } from '@/components/category-icon';
import { RiskBadge } from '@/components/badges';
import { predictions } from '@/lib/mock-data';

export default function PredictionsPage() {
  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Previsao de risco</h1>
        <p className="text-sm text-slate-500">Estimativa experimental para apoio a decisao.</p>
      </header>
      <main className="space-y-6 p-6">
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          Previsao nao e alerta oficial. Exibir sempre como componente experimental.
        </div>
        <section className="grid gap-4 lg:grid-cols-2">
          {predictions.map((prediction) => (
            <article key={prediction.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                    <CategoryIcon type={prediction.category.type} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{prediction.regionName}</h2>
                    <p className="text-sm text-slate-500">{prediction.category.name} - {prediction.horizonHours}h</p>
                  </div>
                </div>
                <RiskBadge level={prediction.riskLevel} />
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-700">{prediction.explanationSimple}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Probabilidade</dt><dd className="font-semibold">{Math.round(prediction.probability * 100)}%</dd></div>
                <div><dt className="text-slate-500">Tendencia</dt><dd className="font-semibold">{prediction.trend}</dd></div>
              </dl>
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <div className="mb-1 flex items-center gap-2 font-medium text-slate-800"><DatabaseZap className="h-4 w-4" />Proveniencia</div>
                Fontes: {prediction.sources.join(', ')}. Modelo: {prediction.modelVersion}.
              </div>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
