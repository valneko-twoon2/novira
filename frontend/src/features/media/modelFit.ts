// Whether a model fits the machine, from the graphics card's memory and a rough need per model.
import type { PackKind } from '@/backend';

export type Fit = 'comfortable' | 'tight' | 'short' | 'unknown';

/** Graphics memory in GB: `minGb` is the least that runs it (slowly, spilling to main memory); `goodGb` runs it comfortably. */
export interface Need {
  minGb: number;
  goodGb: number;
}

const GIB = 1024 ** 3;

/** Rough needs of each pack's models (a guide, not a measurement). */
export const PACK_NEEDS: Record<PackKind, Need> = {
  video: { minGb: 8, goodGb: 12 },
  turbo: { minGb: 8, goodGb: 12 },
  music: { minGb: 6, goodGb: 8 },
  voice: { minGb: 4, goodGb: 8 },
  inpaint: { minGb: 2, goodGb: 4 },
  logo: { minGb: 8, goodGb: 12 },
};

/** Memory is rounded to whole GB first: a "12 GB" card reports a little under 12 GiB. */
export function fitOf(vramBytes: number | null, need: Need): Fit {
  if (vramBytes === null) return 'unknown';
  const gb = Math.round(vramBytes / GIB);
  if (gb >= need.goodGb) return 'comfortable';
  return gb >= need.minGb ? 'tight' : 'short';
}

/** The index of the candidate to recommend: the first that is comfortable, else the first that is tight, else none. */
export function recommendedIndex(fits: Fit[]): number {
  const comfortable = fits.indexOf('comfortable');
  return comfortable >= 0 ? comfortable : fits.indexOf('tight');
}

/** Graphics memory as `12 GB`. */
export function formatVram(bytes: number): string {
  return `${Math.round(bytes / GIB)} GB`;
}
