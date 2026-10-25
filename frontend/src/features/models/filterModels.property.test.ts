// Property tests for the model grid's filtering and sorting: a subset that matches the filter, ordered by the sort key,
// the same for the same input, and it never changes its input. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BaseModel, ModelConfig, ModelType } from '@/backend';
import { check, junkText } from '@/propertyTest.testkit';
import { matchesCategory, type CategoryId } from './modelCategories';
import { filterModels, type ModelFilter } from './filterModels';

const TYPES: ModelType[] = ['main', 'vae', 'lora', 'controlnet', 't2i_adapter', 'ip_adapter', 'clip_vision', 'spandrel_image_to_image', 't5_encoder', 'clip_embed', 'diffusion_model'];
const BASES: BaseModel[] = ['sd-1', 'sd-2', 'sdxl', 'sd-3', 'flux', 'any'];
const CATEGORIES: CategoryId[] = ['all', 'favorites', 'main', 'lora', 'controlnet', 'ipAdapter', 'vae', 'upscale', 'encoders', 'diffusion'];

const name = fc.oneof(fc.stringMatching(/^[A-Za-z0-9 ]{0,10}$/), fc.string({ maxLength: 8 }));
const model = (i: number): fc.Arbitrary<ModelConfig> =>
  fc.record({
    key: fc.constant(`k${i}`),
    name,
    base: fc.constantFrom(...BASES),
    type: fc.constantFrom(...TYPES),
    format: fc.constant('checkpoint' as const),
    description: fc.string({ maxLength: 12 }),
    path: fc.constant(''),
    size: fc.integer({ min: 0, max: 10 ** 10 }),
    source: fc.constant(''),
  });
const models = fc.integer({ min: 0, max: 25 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => model(i))));
const filter: fc.Arbitrary<ModelFilter> = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  search: fc.oneof(fc.constant(''), fc.string({ maxLength: 4 }), junkText),
  base: fc.constantFrom<ModelFilter['base']>('all', ...BASES),
  sort: fc.constantFrom<ModelFilter['sort']>('name', 'size', 'base', 'type'),
  favorites: fc.array(fc.nat(30).map((n) => `k${n}`), { maxLength: 6 }),
});

describe('filterModels (properties)', () => {
  it('returns a subset that matches the filter, without changing the input', () => {
    check(
      fc.property(models, filter, (list, f) => {
        const before = JSON.stringify(list);
        const out = filterModels(list, f);
        expect(JSON.stringify(list)).toBe(before);
        const q = f.search.trim().toLowerCase();
        for (const m of out) {
          expect(list.includes(m)).toBe(true);
          if (f.base !== 'all') expect(m.base).toBe(f.base);
          if (f.category === 'favorites') expect(f.favorites.includes(m.key)).toBe(true);
          else expect(matchesCategory(m.type, f.category)).toBe(true);
          if (q) expect(m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.base.includes(q)).toBe(true);
        }
        // nothing that matches is lost
        const expected = list.filter((m) => (f.category === 'favorites' ? f.favorites.includes(m.key) : matchesCategory(m.type, f.category)) && (f.base === 'all' || m.base === f.base) && (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.base.includes(q)));
        expect(out.map((m) => m.key).sort()).toEqual(expected.map((m) => m.key).sort());
      }),
    );
  });

  it('is ordered by the sort key, and idempotent', () => {
    check(
      fc.property(models, filter, (list, f) => {
        const out = filterModels(list, f);
        for (let k = 1; k < out.length; k++) {
          const a = out[k - 1]!;
          const b = out[k]!;
          if (f.sort === 'size') expect(a.size).toBeGreaterThanOrEqual(b.size);
          if (f.sort === 'name') expect(a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
          if (f.sort === 'base') expect(a.base.localeCompare(b.base) || a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
          if (f.sort === 'type') expect(a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
        }
        expect(filterModels(out, f).map((m) => m.key)).toEqual(out.map((m) => m.key));
      }),
    );
  });
});
