import type { OccurrenceStatus, RiskLevel } from '@kamara/shared-types';

import type { UrgencyLevel } from './api';

export const statusLabels: Record<OccurrenceStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_SYNC: 'Aguardando sincronizacao',
  SYNCED: 'Sincronizada',
  UNDER_REVIEW: 'Em analise',
  NEEDS_MORE_INFO: 'Complemento solicitado',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rejeitada',
};

export const urgencyLabels: Record<UrgencyLevel, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export const riskLabels: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
};
