import type { DisasterCategory, OccurrenceSummary, RiskPredictionSummary } from '@kamara/shared-types';

export const categories: Record<string, DisasterCategory> = {
  fire: {
    id: 'cat-fire',
    cobradeCode: '1.4.1.3.1',
    name: 'Incendio/Queimada',
    type: 'INCENDIO_QUEIMADA',
    active: true,
  },
  flood: {
    id: 'cat-flood',
    cobradeCode: '1.2.1.0.0',
    name: 'Inundacao/Alagamento',
    type: 'INUNDACAO_ALAGAMENTO',
    active: true,
  },
};

export const occurrences: OccurrenceSummary[] = [
  {
    id: 'occ-001',
    description: 'Foco de queimada com fumaca escura proximo a area de vegetacao urbana.',
    reportedAt: '2026-08-26T09:30:00-04:00',
    latitude: -3.1038,
    longitude: -60.0251,
    urgency: 'HIGH',
    humanRisk: false,
    status: 'UNDER_REVIEW',
    reporterLabel: 'Cidadao autenticado',
    confirmedCategory: null,
    distanceKm: 2.4,
    aiClassification: {
      predictedCategory: categories.fire,
      confidence: 0.86,
      explanationSimple:
        'A pre-analise encontrou sinais visuais compativeis com fumaca e fogo. A decisao ainda depende de validacao humana.',
      resultStatus: 'AVAILABLE',
      modelVersion: 'visual-fire-flood@0.1.0',
    },
  },
  {
    id: 'occ-002',
    description: 'Rua alagada apos chuva intensa, com passagem de veiculos comprometida.',
    reportedAt: '2026-08-26T08:10:00-04:00',
    latitude: -3.0921,
    longitude: -60.0345,
    urgency: 'CRITICAL',
    humanRisk: true,
    status: 'CONFIRMED',
    reporterLabel: 'Cidadao autenticado',
    confirmedCategory: categories.flood,
    distanceKm: 4.1,
    aiClassification: {
      predictedCategory: categories.flood,
      confidence: 0.91,
      explanationSimple:
        'Imagem e descricao indicam acumulacao de agua em via urbana. Registro confirmado por gestor.',
      resultStatus: 'AVAILABLE',
      modelVersion: 'multimodal-flood@0.1.0',
    },
  },
  {
    id: 'occ-003',
    description: 'Registro salvo em campo sem conectividade aguardando sincronizacao.',
    reportedAt: '2026-08-26T07:45:00-04:00',
    latitude: -3.1182,
    longitude: -60.0128,
    urgency: 'MEDIUM',
    humanRisk: false,
    status: 'PENDING_SYNC',
    reporterLabel: 'Voce',
    confirmedCategory: null,
    distanceKm: 1.2,
    aiClassification: null,
  },
  {
    id: 'occ-004',
    description: 'Imagem sem nitidez suficiente; gestor solicitou complemento com nova foto.',
    reportedAt: '2026-08-25T17:25:00-04:00',
    latitude: -3.0842,
    longitude: -60.0189,
    urgency: 'MEDIUM',
    humanRisk: false,
    status: 'NEEDS_MORE_INFO',
    reporterLabel: 'Voce',
    confirmedCategory: null,
    distanceKm: 6.8,
    aiClassification: {
      predictedCategory: categories.fire,
      confidence: 0.52,
      explanationSimple:
        'O modelo encontrou sinais ambiguos. O gestor pediu informacoes adicionais antes da decisao.',
      resultStatus: 'AVAILABLE',
      modelVersion: 'visual-fire-flood@0.1.0',
    },
  },
];

export const publicOccurrences = occurrences.filter((item) => item.status === 'CONFIRMED');

export const predictions: RiskPredictionSummary[] = [
  {
    id: 'pred-001',
    regionName: 'Manaus - AM / Zona Centro-Sul',
    category: categories.flood,
    horizonHours: 48,
    riskLevel: 'HIGH',
    probability: 0.78,
    trend: 'INCREASING',
    explanationSimple:
      'Risco elevado por acumulado de chuva recente, historico de alagamentos e previsao de novas precipitacoes.',
    synthetic: true,
    validFrom: '2026-08-26T10:00:00-04:00',
    sources: ['chuva sintetica', 'historico simulado', 'ocorrencias confirmadas'],
    modelVersion: 'risk-rf@0.1.0',
  },
  {
    id: 'pred-002',
    regionName: 'Manaus - AM / Zona Norte',
    category: categories.fire,
    horizonHours: 48,
    riskLevel: 'MEDIUM',
    probability: 0.57,
    trend: 'STABLE',
    explanationSimple:
      'Risco moderado associado a baixa umidade simulada e registros recentes sob analise.',
    synthetic: true,
    validFrom: '2026-08-26T10:00:00-04:00',
    sources: ['clima sintetico', 'historico simulado'],
    modelVersion: 'risk-rf@0.1.0',
  },
];

export const statusLabels: Record<OccurrenceSummary['status'], string> = {
  DRAFT: 'Rascunho',
  PENDING_SYNC: 'Aguardando sincronizacao',
  SYNCED: 'Sincronizada',
  UNDER_REVIEW: 'Em analise',
  NEEDS_MORE_INFO: 'Complemento solicitado',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rejeitada',
};

export const urgencyLabels: Record<OccurrenceSummary['urgency'], string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};
