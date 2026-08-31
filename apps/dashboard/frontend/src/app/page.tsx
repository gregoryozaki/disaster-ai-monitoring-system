import Link from 'next/link';
import { Calendar, Filter, MapPin, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CategoryIcon, categoryColor } from '@/components/category-icon';
import { StatusBadge } from '@/components/badges';
import { occurrences } from '@/lib/mock-data';

export default function DashboardHomePage() {
  const underReview = occurrences.filter((item) => item.status === 'UNDER_REVIEW');
  const confirmed = occurrences.filter((item) => item.status === 'CONFIRMED');

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Mapa operacional</h1>
        <p className="text-sm text-slate-500">Monitoramento, filtros e triagem de ocorrencias.</p>
      </header>
      <main className="grid h-[calc(100vh-73px)] grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr_380px]">
        <aside className="overflow-auto border-r border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <Filter className="h-5 w-5" />
            Filtros operacionais
          </div>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tipo</span>
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option>Todos</option>
                <option>Incendio/Queimada</option>
                <option>Inundacao/Alagamento</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option>Em analise</option>
                <option>Confirmada</option>
                <option>Complemento solicitado</option>
                <option>Rejeitada</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Confianca minima</span>
              <input type="range" min="0" max="100" defaultValue="50" className="w-full" />
            </label>
          </div>
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>{underReview.length}</strong> ocorrencia(s) aguardam validacao humana.
          </div>
        </aside>

        <section className="relative min-h-[420px] bg-gradient-to-br from-sky-50 to-emerald-50">
          <div className="absolute inset-0 flex items-center justify-center text-center text-slate-500">
            <div>
              <MapPin className="mx-auto mb-3 h-14 w-14 text-emerald-700" />
              <p className="font-medium">Mapa geoespacial operacional</p>
              <p className="text-sm">Substituir por biblioteca de mapas na integracao real.</p>
            </div>
          </div>
          {occurrences.map((occurrence, index) => {
            const category = occurrence.confirmedCategory ?? occurrence.aiClassification?.predictedCategory;
            if (!category) return null;
            const positions = [
              { top: '31%', left: '42%' },
              { top: '55%', left: '62%' },
              { top: '68%', left: '36%' },
            ];
            return (
              <Link
                key={occurrence.id}
                href={'/occurrences/' + occurrence.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={positions[index % positions.length]}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white/70 transition hover:scale-110"
                  style={{ backgroundColor: categoryColor(category.type) }}
                >
                  <CategoryIcon type={category.type} />
                </div>
              </Link>
            );
          })}
        </section>

        <aside className="overflow-auto border-l border-slate-200 bg-white p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Em analise</p>
              <p className="text-2xl font-semibold text-yellow-700">{underReview.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Confirmadas</p>
              <p className="text-2xl font-semibold text-emerald-700">{confirmed.length}</p>
            </div>
          </div>
          <h2 className="mb-3 font-semibold text-slate-900">Ocorrencias recentes</h2>
          <div className="space-y-3">
            {occurrences.map((occurrence) => {
              const category = occurrence.confirmedCategory ?? occurrence.aiClassification?.predictedCategory;
              return (
                <Link key={occurrence.id} href={'/occurrences/' + occurrence.id} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {category && <CategoryIcon type={category.type} className="h-4 w-4" />}
                      {category?.name ?? 'Sem classificacao'}
                    </div>
                    <StatusBadge status={occurrence.status} />
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-600">{occurrence.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(occurrence.reportedAt).toLocaleString('pt-BR')}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            O mapa publico usa apenas registros confirmados e dados minimizados.
          </div>
        </aside>
      </main>
    </DashboardShell>
  );
}
