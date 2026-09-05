import type { DisasterType } from '@kamara/shared-types';

import type { ApiCategory } from './api';

export function categoryType(category: ApiCategory | null | undefined): DisasterType {
  const text = `${category?.cobradeCode ?? ''} ${category?.groupName ?? ''} ${category?.name ?? ''}`.toLowerCase();

  if (text.includes('incend') || text.startsWith('1.4.1.3') || text.startsWith('2.3.1')) {
    return 'INCENDIO_QUEIMADA';
  }

  return 'INUNDACAO_ALAGAMENTO';
}

export function occurrenceLatitude(occurrence: { location?: { latitude: number }; latitude?: number }) {
  return occurrence.location?.latitude ?? occurrence.latitude ?? 0;
}

export function occurrenceLongitude(occurrence: { location?: { longitude: number }; longitude?: number }) {
  return occurrence.location?.longitude ?? occurrence.longitude ?? 0;
}
