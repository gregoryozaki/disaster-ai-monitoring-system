import Link from 'next/link';
import { ArrowLeft, Brain, CheckCircle2, Clock } from 'lucide-react';
import { CategoryIcon } from '@/components/category-icon';
import { StatusBadge } from '@/components/badges';
import { occurrences } from '@/lib/mock-data';

export default function AnalysisPage() {
  const occurrence = occurrences[0];
  const ai = occurrence.aiClassification!;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white">
      <header className="border-b border-slate-200 bg-emerald-700 px-4 py-3 text-white">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
      </header>
      <section className="p-4">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 animate-scale-in">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Registro recebido</h1>
          <p className="text-sm text-slate-600">A classificacao abaixo e preliminar e sera revisada por um gestor.</p>
        </div>

        <article className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white">
              <CategoryIcon type={ai.predictedCategory!.type} />
            </div>
            <div>
              <p className="text-sm text-red-900">Categoria prevista</p>
              <h2 className="font-semibold text-slate-900">{ai.predictedCategory!.name}</h2>
            </div>
          </div>
          <div className="mb-3 rounded-lg bg-white p-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Confianca da IA</span>
              <strong>{Math.round((ai.confidence ?? 0) * 100)}%</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.round((ai.confidence ?? 0) * 100)}%` }} />
            </div>
          </div>
          <StatusBadge status="UNDER_REVIEW" />
        </article>

        <article className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Brain className="h-5 w-5 text-blue-700" />
            Explicacao simples
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{ai.explanationSimple}</p>
          <p className="mt-3 text-xs text-slate-500">Modelo: {ai.modelVersion}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Clock className="h-4 w-4" />
            Proximos passos
          </div>
          O registro entrou em analise humana. Se o gestor pedir complemento, voce vera a solicitacao no historico.
        </article>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/report" className="rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white">Novo registro</Link>
          <Link href="/history" className="rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold text-slate-700">Historico</Link>
        </div>
      </section>
    </main>
  );
}
