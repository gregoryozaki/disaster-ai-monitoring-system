import Link from 'next/link';
import { Camera, History, MapPin, ShieldCheck } from 'lucide-react';
import { CategoryIcon, categoryColor } from '@/components/category-icon';
import { StatusBadge } from '@/components/badges';
import { ShellHeader } from '@/components/shell-header';
import { predictions, publicOccurrences } from '@/lib/mock-data';

export default function CitizenHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
      <ShellHeader title="MBOI" subtitle="Registro cidadao e mapa publico" />

      <section className="border-b border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <MapPin className="h-4 w-4 text-emerald-700" />
          Manaus - AM, localizacao aproximada
        </div>
        <div className="grid grid-cols-2 gap-3">
          {predictions.map((prediction) => (
            <div key={prediction.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CategoryIcon type={prediction.category.type} className="h-4 w-4" />
                <span className="text-xs font-medium text-slate-700">{prediction.category.name}</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {prediction.riskLevel === 'HIGH'
                  ? 'Alto'
                  : prediction.riskLevel === 'MEDIUM'
                    ? 'Medio'
                    : 'Baixo'}
              </p>
              <p className="text-xs text-slate-500">Estimativa experimental 24-48h</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative h-64 border-b border-slate-200 bg-gradient-to-br from-sky-50 to-emerald-50">
        <div className="absolute inset-0 flex items-center justify-center text-center text-slate-500">
          <div>
            <MapPin className="mx-auto mb-2 h-10 w-10 text-emerald-700" />
            <p className="text-sm font-medium">Mapa publico</p>
            <p className="text-xs">Somente ocorrencias confirmadas</p>
          </div>
        </div>
        {publicOccurrences.map((occurrence, index) => {
          const category = occurrence.confirmedCategory;
          if (!category) return null;
          const positions = [
            { top: '38%', left: '58%' },
            { top: '57%', left: '34%' },
          ];
          return (
            <div
              key={occurrence.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={positions[index % positions.length]}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg"
                style={{ backgroundColor: categoryColor(category.type) }}
                title={category.name}
              >
                <CategoryIcon type={category.type} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex-1 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Ocorrencias publicas proximas</h1>
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
        </div>
        {publicOccurrences.map((occurrence) => {
          const category = occurrence.confirmedCategory!;
          return (
            <article key={occurrence.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${categoryColor(category.type)}18`, color: categoryColor(category.type) }}
                >
                  <CategoryIcon type={category.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{category.name}</h2>
                    <StatusBadge status={occurrence.status} />
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-600">{occurrence.description}</p>
                  <p className="mt-2 text-xs text-slate-500">~{occurrence.distanceKm} km de distancia</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <nav className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-white p-4">
        <Link href="/report" className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white shadow-sm">
          <Camera className="h-5 w-5" />
          Registrar
        </Link>
        <Link href="/history" className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700">
          <History className="h-5 w-5" />
          Historico
        </Link>
      </nav>
    </main>
  );
}
