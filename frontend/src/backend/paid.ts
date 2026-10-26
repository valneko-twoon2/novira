// Whether a Civitai version still asks for payment, from the answer's `paid` and `paidUntil`.
import type { CivitaiVersion } from './types';

/** Paid at `now` (epoch ms): paid for good, or in early access that has not ended. */
export function isPaid(version: Pick<CivitaiVersion, 'paid' | 'paidUntil'> | undefined, now: number): boolean {
  return !!version?.paid && (version.paidUntil == null || version.paidUntil > now);
}
