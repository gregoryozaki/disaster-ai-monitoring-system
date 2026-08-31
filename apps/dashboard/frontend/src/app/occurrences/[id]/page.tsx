import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Brain, Image as ImageIcon, MapPin, UserRound } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CategoryIcon } from '@/components/category-icon';
import { StatusBadge } from '@/components/badges';
import { occurrences, urgencyLabels } from '@/lib/mock-data';

export default function OccurrenceDetailPage({ params }: { params: { id: string } }) {
  const occurrence = occurrences.find((item) => item.id === params.id);
  if (!occurrence) notFound();
  const category = occurrence.confirmedCategory ?? occurrence.aiClassification?.predictedCategory;

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao mapa
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Detalhes da ocorrencia</h1>
            <p className="text-sm text-slate-500">ID {occurrence.id}</p>
          </div>
          <StatusBadge status={occurrence.status} />
        </div>
      </header>

      <main className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex aspect-video items-center justify-center bg-slate-100">
              <ImageIcon className="h-20 w-20 text-slate-400" />
            </div>
          </div>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {category && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <CategoryIcon type={category.type} />
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500">Classificacao atual/sugerida</p>
                  <h2 className="text-xl font-semibold text-slate-900">{category?.name ?? 'Sem classificacao'}</h2>
                </div>
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{occurrence.description}</p>
          </article>

          <article className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <Brain className="h-5 w-5 text-blue-700" />
              Pre-analise da IA
            </div>
            {occurrence.aiClassification ? (
              <div className="space-y-3 text-sm text-slate-700">
                <p>{occurrence.aiClassification.explanationSimple}</p>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">Confianca</p>
                  <p className="text-2xl font-semibold text-blue-800">{Math.round((occurrence.aiClassification.confidence ?? 0) * 100)}%</p>
                  <p className="mt-1 text-xs text-slate-500">Modelo {occurrence.aiClassification.modelVersion}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700">Pre-analise indisponivel. A ocorrencia permanece valida para analise humana.</p>
            )}
          </article>
        </section>

        <aside className="space-y-6">
          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Metadados</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <dt className="text-slate-500">Coordenadas</dt>
                  <dd className="font-medium text-slate-800">{occurrence.latitude}, {occurrence.longitude}</dd>
                </div>
              </div>
              <div className="flex gap-2">
                <UserRound className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <dt className="text-slate-500">Origem</dt>
                  <dd className="font-medium text-slate-800">{occurrence.reporterLabel}</dd>
                </div>
              </div>
              <div>
                <dt className="text-slate-500">Urgencia</dt>
                <dd className="font-medium text-slate-800">{urgencyLabels[occurrence.urgency]}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Vitimas/risco humano</dt>
                <dd className="font-medium text-slate-800">{occurrence.humanRisk ? 'Sim' : 'Nao'}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Decisao do gestor</h2>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Confirmar ocorrencia</button>
              <button className="w-full rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700">Corrigir classificacao</button>
              <button className="w-full rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700">Solicitar complemento</button>
              <button className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700">Rejeitar</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Toda decisao deve gerar Validation e StatusHistory no backend.</p>
          </article>
        </aside>
      </main>
    </DashboardShell>
  );
}
