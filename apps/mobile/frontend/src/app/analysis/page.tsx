'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/badges';
import { api, ApiOccurrence } from '@/lib/api';

export default function AnalysisPage() {
  const [occurrenceId, setOccurrenceId] = useState<string | null>(null);
  const [occurrence, setOccurrence] = useState<ApiOccurrence | null>(null);
  const [loading, setLoading] = useState(Boolean(occurrenceId));

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('occurrenceId');
    setOccurrenceId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    void api
      .listCitizenOccurrences()
      .then((response) => setOccurrence(response.data.find((item) => item.id === id) ?? null))
      .finally(() => setLoading(false));
  }, []);

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
          <p className="text-sm text-slate-600">A classificacao da IA e registrada pelo backend quando houver foto/texto e o servico estiver disponivel.</p>
        </div>

        <article className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Ocorrencia</h2>
            <StatusBadge status={occurrence?.status ?? 'UNDER_REVIEW'} />
          </div>
          {loading ? (
            <p className="text-sm text-slate-600">Consultando API...</p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700">{occurrence?.description ?? 'A ocorrencia foi enviada para analise humana.'}</p>
          )}
        </article>

        <article className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Brain className="h-5 w-5 text-blue-700" />
            Pre-analise
          </div>
          <p className="text-sm leading-relaxed text-slate-700">A decisao final permanece com o gestor. Quando a foto principal e enviada, o backend aciona a pre-analise em segundo plano.</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Clock className="h-4 w-4" />
            Proximos passos
          </div>
          Acompanhe o status no historico. Se o gestor pedir complemento, a solicitacao aparecera por la.
        </article>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/report" className="rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white">Novo registro</Link>
          <Link href="/history" className="rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold text-slate-700">Historico</Link>
        </div>
      </section>
    </main>
  );
}
