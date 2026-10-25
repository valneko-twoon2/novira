import { describe, expect, it } from 'vitest';
import type { CivitaiSearchParams } from '../types';
import { CIVITAI_PAGE_SIZE, searchCivitaiModels } from './civitaiSearch';

const base: CivitaiSearchParams = { query: '', kind: 'all', baseModel: 'all', sort: 'downloads', period: 'all', includeNsfw: true };

describe('searchCivitaiModels', () => {
  it('paginates by cursor without overlap', () => {
    const a = searchCivitaiModels(base);
    expect(a.items).toHaveLength(CIVITAI_PAGE_SIZE);
    const b = searchCivitaiModels({ ...base, cursor: a.nextCursor });
    expect(b.items.some((m) => a.items.some((x) => x.id === m.id))).toBe(false);
  });

  it('filters by kind and sorts by downloads', () => {
    const r = searchCivitaiModels({ ...base, kind: 'LoRA' });
    expect(r.items.every((m) => m.kind === 'LoRA')).toBe(true);
    const d = r.items.map((m) => m.downloads);
    expect(d).toEqual([...d].sort((x, y) => y - x));
  });

  it('filters by sdxl-compatible base, query and period', () => {
    const r = searchCivitaiModels({ ...base, baseModel: 'sdxl-compat' });
    expect(r.items.every((m) => m.baseModel !== 'SD 1.5' && m.baseModel !== 'FLUX.1')).toBe(true);
    expect(searchCivitaiModels({ ...base, query: 'watercolor' }).items.map((m) => m.name)).toContain('Soft Watercolor Style');
    expect(searchCivitaiModels({ ...base, period: 'day' }).items.length).toBeLessThanOrEqual(searchCivitaiModels(base).items.length);
  });

  it('hides mature models unless included', () => {
    expect(searchCivitaiModels({ ...base, includeNsfw: false }).items.every((m) => !m.nsfw)).toBe(true);
  });
});
