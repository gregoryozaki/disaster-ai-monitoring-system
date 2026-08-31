'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const statusColors: Record<string, string> = {
  'Em analise': '#2563eb',
  Confirmada: '#059669',
  'Complemento solicitado': '#d97706',
  'Aguardando sincronizacao': '#64748b',
};

interface AnalyticsChartsProps {
  statusData: Array<{ name: string; value: number }>;
  categoryData: Array<{ name: string; value: number }>;
  trendData: Array<{ day: string; ocorrencias: number; confirmadas: number }>;
}

export function AnalyticsCharts({ statusData, categoryData, trendData }: AnalyticsChartsProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Evolucao operacional</h2>
          <span className="text-xs font-medium text-slate-500">Ultimos 4 periodos</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip />
              <Line type="monotone" dataKey="ocorrencias" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="confirmadas" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Distribuicao por status</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={statusColors[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          {statusData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[item.name] ?? '#94a3b8' }} />
              {item.name}: {item.value}
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <h2 className="mb-4 font-semibold text-slate-900">Confirmadas por categoria COBRADE</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
