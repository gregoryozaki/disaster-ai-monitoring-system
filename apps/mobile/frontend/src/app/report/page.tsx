'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Camera, MapPin, Send, WifiOff } from 'lucide-react';
import { ShellHeader } from '@/components/shell-header';

export default function ReportPage() {
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('MEDIUM');
  const [humanRisk, setHumanRisk] = useState(false);
  const [locationMode, setLocationMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [offline, setOffline] = useState(false);
  const valid = description.trim().length >= 12;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white">
      <ShellHeader title="Registrar ocorrencia" subtitle="Evidencias, localizacao e urgencia" />
      <div className="p-4">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <section className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Evidencia visual</h1>
              <p className="text-xs text-slate-500">Foto prioritaria; video opcional no prototipo.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Anexar foto</button>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Anexar video</button>
          </div>
        </section>

        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Descricao</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="Ex: rua alagada com risco para pedestres, proximo a escola..."
            className="h-32 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
          <span className="mt-1 block text-right text-xs text-slate-500">{description.length}/500</span>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Urgencia</span>
            <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Critica</option>
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input checked={humanRisk} onChange={(event) => setHumanRisk(event.target.checked)} type="checkbox" className="h-4 w-4" />
            Ha vitimas/risco humano
          </label>
        </div>

        <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-900">
            <MapPin className="h-4 w-4" />
            Localizacao
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setLocationMode('AUTO')} className={`rounded-lg px-3 py-2 text-sm font-medium ${locationMode === 'AUTO' ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700'}`}>Automatica</button>
            <button onClick={() => setLocationMode('MANUAL')} className={`rounded-lg px-3 py-2 text-sm font-medium ${locationMode === 'MANUAL' ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700'}`}>Manual</button>
          </div>
          <p className="mt-3 text-xs text-emerald-800">Lat -3.1038, Lon -60.0251. O usuario pode corrigir antes do envio.</p>
        </section>

        <label className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input checked={offline} onChange={(event) => setOffline(event.target.checked)} type="checkbox" />
          Simular falta de conexao e salvar como pending_sync
        </label>

        <Link
          href={offline ? '/history' : '/analysis'}
          aria-disabled={!valid}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold ${valid ? 'bg-emerald-700 text-white' : 'pointer-events-none bg-slate-200 text-slate-500'}`}
        >
          {offline ? <WifiOff className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          {offline ? 'Salvar localmente' : 'Enviar para pre-analise'}
        </Link>
      </div>
    </main>
  );
}
