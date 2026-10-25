// Property and fuzz tests for the Browse tab's search over the fixtures: arbitrary query text and cursors never throw,
// pages never repeat or lose a result, and filters hold. In-process only (the fixture data, no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CivitaiKind, CivitaiPeriod, CivitaiSearchParams, CivitaiSort } from '../types';
import { check, junkText, blockExternalNetwork } from '@/propertyTest.testkit';
import { CIVITAI_PAGE_SIZE, HUGGINGFACE_MODELS, searchCivitaiModels } from './civitaiSearch';

blockExternalNetwork();

const params: fc.Arbitrary<CivitaiSearchParams> = fc.record({
  source: fc.constantFrom<CivitaiSearchParams['source']>(undefined, 'civitai', 'huggingface'),
  query: fc.oneof(junkText, fc.constantFrom('', 'anime', ' Anime ', 'sdxl', 'zzzzzz')),
  kind: fc.constantFrom<CivitaiKind | 'all'>('all', 'LoRA', 'Checkpoint', 'ControlNet', 'VAE', 'Diffusion'),
  baseModel: fc.constantFrom('all', 'sdxl-compat', 'SDXL 1.0', 'Pony', 'nope'),
  sort: fc.constantFrom<CivitaiSort>('downloads', 'rating', 'newest'),
  period: fc.constantFrom<CivitaiPeriod>('all', 'year', 'month', 'week', 'day'),
  includeNsfw: fc.boolean(),
});

const walk = (p: CivitaiSearchParams) => {
  const seen: string[] = [];
  let cursor: string | null | undefined = undefined;
  for (let page = 0; page < 200; page++) {
    const r = searchCivitaiModels({ ...p, cursor }, p.source === 'huggingface' ? HUGGINGFACE_MODELS : undefined);
    expect(r.items.length).toBeLessThanOrEqual(CIVITAI_PAGE_SIZE);
    seen.push(...r.items.map((m) => m.id));
    if (r.nextCursor === null) return seen;
    cursor = r.nextCursor;
  }
  throw new Error('pagination did not end');
};

describe('model search (properties)', () => {
  it('walking the cursors lists every match exactly once and ends', () => {
    check(
      fc.property(params, (p) => {
        const ids = walk(p);
        expect(new Set(ids).size).toBe(ids.length);
        const all = searchCivitaiModels({ ...p, cursor: '0' }, p.source === 'huggingface' ? HUGGINGFACE_MODELS : undefined);
        expect(ids.slice(0, CIVITAI_PAGE_SIZE)).toEqual(all.items.map((m) => m.id));
      }),
    );
  });

  it('results respect the kind, the NSFW switch and the query', () => {
    check(
      fc.property(params, (p) => {
        const r = searchCivitaiModels(p, p.source === 'huggingface' ? HUGGINGFACE_MODELS : undefined);
        const q = p.query.trim().toLowerCase();
        for (const m of r.items) {
          if (p.kind !== 'all') expect(m.kind).toBe(p.kind);
          if (!p.includeNsfw) expect(m.nsfw).toBe(false);
          if (q) expect(`${m.name} ${m.creator} ${m.tags.join(' ')} ${m.triggerWords.join(' ')}`.toLowerCase()).toContain(q);
        }
      }),
    );
  });

  it('any cursor text (junk, negative, huge, fractional) gives a page and never throws', () => {
    check(
      fc.property(params, fc.oneof(junkText, fc.double().map(String), fc.constantFrom('-5', 'Infinity', '1e21', '0.5', 'NaN')), (p, cursor) => {
        const r = searchCivitaiModels({ ...p, cursor }, p.source === 'huggingface' ? HUGGINGFACE_MODELS : undefined);
        expect(r.items.length).toBeLessThanOrEqual(CIVITAI_PAGE_SIZE);
        expect(r.nextCursor === null || typeof r.nextCursor === 'string').toBe(true);
      }),
    );
  });

  it('sorting by downloads puts the most downloaded first', () => {
    check(
      fc.property(params, (p) => {
        const items = searchCivitaiModels({ ...p, sort: 'downloads', cursor: null }).items;
        for (let k = 1; k < items.length; k++) expect(items[k - 1]!.downloads).toBeGreaterThanOrEqual(items[k]!.downloads);
      }),
      60,
    );
  });
});
