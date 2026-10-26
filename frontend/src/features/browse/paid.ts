// What the Browse tab says of a version that asks for payment: a short badge and the reason it cannot be installed.
import type { CivitaiVersion } from '@/backend';
import { isPaid } from '@/backend/paid';
import { getLocale, t } from '@/i18n';

type Paid = Pick<CivitaiVersion, 'paid' | 'paidUntil'>;

export const versionIsPaid = (version: Paid | undefined, now = Date.now()): boolean => isPaid(version, now);

const dateOf = (until: number): string => new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(until);

/** "Paid" or "Paid until <date>"; null for a version that is free (also an early access that has ended). */
export function paidBadge(version: Paid | undefined, now = Date.now()): string | null {
  if (!isPaid(version, now)) return null;
  return version?.paidUntil != null ? t('browse.paid.badgeUntil', { date: dateOf(version.paidUntil) }) : t('browse.paid.badge');
}

/** Why a paid version cannot be installed from here, with the end of early access when it has one. */
export function paidReason(version: Paid | undefined, now = Date.now()): string | null {
  if (!isPaid(version, now)) return null;
  return version?.paidUntil != null ? t('browse.paid.early', { date: dateOf(version.paidUntil) }) : t('browse.paid.permanent');
}
