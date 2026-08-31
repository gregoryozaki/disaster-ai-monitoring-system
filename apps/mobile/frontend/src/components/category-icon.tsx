import type { DisasterType } from '@kamara/shared-types';
import { Droplets, Flame } from 'lucide-react';

export function CategoryIcon({ type, className = 'h-5 w-5' }: { type: DisasterType; className?: string }) {
  const Icon = type === 'INCENDIO_QUEIMADA' ? Flame : Droplets;
  return <Icon className={className} />;
}

export function categoryColor(type: DisasterType) {
  return type === 'INCENDIO_QUEIMADA' ? '#dc2626' : '#2563eb';
}
