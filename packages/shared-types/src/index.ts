export type UserRole = 'CITIZEN' | 'MANAGER' | 'ADMIN' | 'RESEARCHER';

export type OccurrenceStatus =
  | 'DRAFT'
  | 'PENDING_SYNC'
  | 'SYNCED'
  | 'UNDER_REVIEW'
  | 'NEEDS_MORE_INFO'
  | 'CONFIRMED'
  | 'REJECTED';

export type DisasterType = 'INCENDIO_QUEIMADA' | 'INUNDACAO_ALAGAMENTO';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DisasterCategory {
  id: string;
  cobradeCode: string;
  name: string;
  type: DisasterType;
  active: boolean;
}

export interface AIClassificationSummary {
  predictedCategory: DisasterCategory | null;
  confidence: number | null;
  explanationSimple: string;
  resultStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';
  modelVersion: string;
}

export interface OccurrenceSummary {
  id: string;
  description: string;
  reportedAt: string;
  latitude: number;
  longitude: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  humanRisk: boolean;
  status: OccurrenceStatus;
  reporterLabel: string;
  confirmedCategory: DisasterCategory | null;
  aiClassification: AIClassificationSummary | null;
  distanceKm?: number;
}

export interface RiskPredictionSummary {
  id: string;
  regionName: string;
  category: DisasterCategory;
  horizonHours: number;
  riskLevel: RiskLevel;
  probability: number;
  trend: 'DECREASING' | 'STABLE' | 'INCREASING' | 'UNKNOWN';
  explanationSimple: string;
  synthetic: boolean;
  validFrom: string;
  sources: string[];
  modelVersion: string;
}

export * from './password-policy';

export * from './legal-agreements';
