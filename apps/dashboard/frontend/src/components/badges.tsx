import type { OccurrenceStatus, RiskLevel } from '@kamara/shared-types';
import { statusLabels } from '@/lib/mock-data';

const statusStyles: Record<OccurrenceStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  PENDING_SYNC: 'border-amber-200 bg-amber-50 text-amber-700',
  SYNCED: 'border-blue-200 bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  NEEDS_MORE_INFO: 'border-orange-200 bg-orange-50 text-orange-800',
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
};

const riskStyles: Record<RiskLevel, string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-800',
  HIGH: 'border-red-200 bg-red-50 text-red-700',
};

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const label = level === 'LOW' ? 'Baixo' : level === 'MEDIUM' ? 'Medio' : 'Alto';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${riskStyles[level]}`}>
      Risco {label}
    </span>
  );
}
