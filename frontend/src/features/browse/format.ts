// Number and size formatting for model stats.
import { getLocale } from '@/i18n';

export function formatCount(n: number): string {
  return new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatSize(bytes: number): string {
  if (!(bytes > 0)) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
