import { ClipboardList, SlidersHorizontal, UsersRound } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';

export default function AdminPage() {
  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Administracao</h1>
        <p className="text-sm text-slate-500">Gestores, categorias, limiares versionados e auditoria.</p>
      </header>
      <main className="grid gap-6 p-6 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <UsersRound className="mb-3 h-6 w-6 text-emerald-700" />
          <h2 className="mb-2 font-semibold text-slate-900">Gestores</h2>
          <p className="mb-4 text-sm text-slate-600">Criar convite, editar papel/permissoes e desativar contas.</p>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Criar convite</button>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <SlidersHorizontal className="mb-3 h-6 w-6 text-blue-700" />
          <h2 className="mb-2 font-semibold text-slate-900">Limires de confianca</h2>
          <p className="mb-4 text-sm text-slate-600">Configurar faixas por tipo de desastre e salvar nova versao.</p>
          <button className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700">Versionar limiar</button>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <ClipboardList className="mb-3 h-6 w-6 text-slate-700" />
          <h2 className="mb-2 font-semibold text-slate-900">Auditoria</h2>
          <p className="mb-4 text-sm text-slate-600">Consultar mudancas de status, decisoes e configuracoes.</p>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Ver logs</button>
        </article>
      </main>
    </DashboardShell>
  );
}
