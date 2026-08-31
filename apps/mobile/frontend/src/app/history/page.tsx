import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { CategoryIcon, categoryColor } from '@/components/category-icon';
import { StatusBadge } from '@/components/badges';
import { occurrences, urgencyLabels } from '@/lib/mock-data';

export default function HistoryPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Meu acompanhamento</h1>
      </header>
      <section className="space-y-3 p-4">
        {occurrences.filter((item) => ['PENDING_SYNC', 'UNDER_REVIEW', 'NEEDS_MORE_INFO', 'CONFIRMED'].includes(item.status)).map((occurrence) => {
          const category = occurrence.confirmedCategory ?? occurrence.aiClassification?.predictedCategory;
          return (
            <article key={occurrence.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: category ? `${categoryColor(category.type)}18` : '#f1f5f9', color: category ? categoryColor(category.type) : '#475569' }}
                >
                  {category ? <CategoryIcon type={category.type} /> : <RefreshCw className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{category?.name ?? 'Aguardando envio'}</h2>
                    <StatusBadge status={occurrence.status} />
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-600">{occurrence.description}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <dt className="font-medium text-slate-500">Urgencia</dt>
                  <dd>{urgencyLabels[occurrence.urgency]}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Risco humano</dt>
                  <dd>{occurrence.humanRisk ? 'Sim' : 'Nao'}</dd>
                </div>
              </dl>
              {occurrence.status === 'NEEDS_MORE_INFO' && (
                <Link href="/report" className="mt-3 inline-flex rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white">
                  Enviar complemento
                </Link>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
