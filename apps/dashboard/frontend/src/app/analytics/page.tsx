import { Activity, Download, Timer, TrendingUp } from 'lucide-react';
import { AnalyticsCharts } from '@/components/analytics-charts';
import { DashboardShell } from '@/components/dashboard-shell';
import { occurrences, statusLabels } from '@/lib/mock-data';

export default function AnalyticsPage() {
  const confirmed = occurrences.filter((item) => item.status === 'CONFIRMED').length;
  const confirmationRate = Math.round((confirmed / occurrences.length) * 100);
  const statusKeys = ['UNDER_REVIEW', 'CONFIRMED', 'NEEDS_MORE_INFO', 'PENDING_SYNC'] as const;
  const statusData = statusKeys.map((status) => ({
    name: statusLabels[status],
    value: occurrences.filter((item) => item.status === status).length,
  }));
  const categoryData = [
    { name: 'Incendio/Queimada', value: occurrences.filter((item) => item.confirmedCategory?.type === 'INCENDIO_QUEIMADA').length },
    { name: 'Inundacao/Alagamento', value: occurrences.filter((item) => item.confirmedCategory?.type === 'INUNDACAO_ALAGAMENTO').length },
  ];
  const trendData = [
    { day: '23/08', ocorrencias: 1, confirmadas: 0 },
    { day: '24/08', ocorrencias: 2, confirmadas: 1 },
    { day: '25/08', ocorrencias: 3, confirmadas: 1 },
    { day: '26/08', ocorrencias: occurrences.length, confirmadas: confirmed },
  ];
  const cards = [
    { label: 'Total de ocorrencias', value: occurrences.length, icon: Activity },
    { label: 'Taxa de confirmacao', value: confirmationRate + '%', icon: TrendingUp },
    { label: 'Tempo medio de pre-analise', value: '2 min', icon: Timer },
    { label: 'Exportacoes solicitadas', value: '0', icon: Download },
  ];

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Painel analitico</h1>
        <p className="text-sm text-slate-500">Indicadores, filtros, previsao e exportacao anonimizavel.</p>
      </header>
      <main className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="mb-3 h-6 w-6 text-emerald-700" />
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">{card.value}</p>
              </article>
            );
          })}
        </section>

        <AnalyticsCharts statusData={statusData} categoryData={categoryData} trendData={trendData} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Exportacao</h2>
              <p className="text-sm text-slate-600">Jobs registram filtros, formato, solicitante, status e arquivo final.</p>
            </div>
            <div className="flex gap-3">
              <button className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Exportar CSV</button>
              <button className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">Exportar JSON</button>
            </div>
          </div>
          <p className="text-xs text-slate-500">Dados pessoais e informacoes sensiveis devem ser removidos quando a exportacao for para pesquisa/analise externa.</p>
        </section>
      </main>
    </DashboardShell>
  );
}
