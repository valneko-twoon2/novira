// Property tests for the Generate form's store: size and aspect-ratio operations in any order keep a usable size, LoRA
// and reference-image lists stay consistent, and recalling stored settings behaves. In-process only (no backend).
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationMetadata, ModelConfig, SchedulerName } from '@/backend';
import { SCHEDULERS } from '@/backend';
import { check, blockExternalNetwork } from '@/propertyTest.testkit';
import { useModels } from './models';
import { ASPECT_RATIOS, useParams } from './params';

blockExternalNetwork();

const initial = useParams.getState();
beforeEach(() => useParams.setState(initial, true));

const value = fc.double({ min: -1e4, max: 1e5, noNaN: true });
type Op =
  | { op: 'dim'; axis: 'width' | 'height'; v: number }
  | { op: 'aspect'; id: (typeof ASPECT_RATIOS)[number]['id'] }
  | { op: 'swap' }
  | { op: 'optimize'; base: number }
  | { op: 'lock'; locked: boolean };
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constant('dim' as const), axis: fc.constantFrom('width' as const, 'height' as const), v: value }),
  fc.record({ op: fc.constant('aspect' as const), id: fc.constantFrom(...ASPECT_RATIOS.map((a) => a.id)) }),
  fc.constant({ op: 'swap' as const }),
  fc.record({ op: fc.constant('optimize' as const), base: fc.integer({ min: 64, max: 2048 }) }),
  fc.boolean().map((locked) => ({ op: 'lock' as const, locked })),
);

describe('Generate form size (properties)', () => {
  it('any order of size operations keeps whole-number sides that are multiples of 8, at least 64, and a known aspect ratio', () => {
    check(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        useParams.setState(initial, true);
        for (const o of ops) {
          const s = useParams.getState();
          if (o.op === 'dim') s.setDimension(o.axis, o.v);
          else if (o.op === 'aspect') s.setAspectRatio(o.id);
          else if (o.op === 'swap') s.swapDimensions();
          else if (o.op === 'optimize') s.optimizeSize(o.base);
          else s.set({ aspectLocked: o.locked });
          const { width, height, aspectRatio } = useParams.getState();
          for (const side of [width, height]) {
            expect(Number.isInteger(side)).toBe(true);
            expect(side).toBeGreaterThanOrEqual(64);
            expect(side % 8).toBe(0);
          }
          expect(ASPECT_RATIOS.some((a) => a.id === aspectRatio)).toBe(true);
        }
      }),
    );
  });

  it('swapping twice gives the size and the ratio back', () => {
    check(
      fc.property(fc.integer({ min: 8, max: 512 }), fc.integer({ min: 8, max: 512 }), fc.constantFrom(...ASPECT_RATIOS.map((a) => a.id)), (w, h, id) => {
        useParams.setState({ ...initial, width: w * 8, height: h * 8, aspectRatio: id }, true);
        useParams.getState().swapDimensions();
        useParams.getState().swapDimensions();
        const s = useParams.getState();
        expect([s.width, s.height]).toEqual([w * 8, h * 8]);
        expect(s.aspectRatio).toBe(id);
      }),
    );
  });

  // Regression: a side set to NaN keeps a usable size (it used to become NaN).
  it('keeps a usable size when a side is set to NaN', () => {
    useParams.getState().setDimension('width', NaN);
    expect(Number.isFinite(useParams.getState().width)).toBe(true);
  });
});

describe('Generate form lists and recall (properties)', () => {
  it('addLora never duplicates a LoRA, and remove / update touch only that key', () => {
    check(
      fc.property(fc.array(fc.tuple(fc.constantFrom('add', 'remove', 'update'), fc.constantFrom('a', 'b', 'c')), { maxLength: 30 }), (ops) => {
        useParams.setState(initial, true);
        for (const [kind, key] of ops) {
          const s = useParams.getState();
          const before = s.loras.map((l) => ({ ...l }));
          if (kind === 'add') s.addLora(key);
          else if (kind === 'remove') s.removeLora(key);
          else s.updateLora(key, { weight: 1.5 });
          const after = useParams.getState().loras;
          const keys = after.map((l) => l.key);
          expect(new Set(keys).size).toBe(keys.length);
          for (const l of after) if (l.key !== key) expect(before.find((b) => b.key === l.key)).toEqual(l);
        }
      }),
    );
  });

  it('reference images get unique ids, and removing one removes only it', () => {
    check(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.nat(), (n, pick) => {
        useParams.setState(initial, true);
        const ids = Array.from({ length: n }, () => useParams.getState().addRefImage({}));
        expect(new Set(ids).size).toBe(n);
        const gone = ids[pick % n]!;
        useParams.getState().removeRefImage(gone);
        expect(useParams.getState().refImages.map((r) => r.id)).toEqual(ids.filter((i) => i !== gone));
      }),
    );
  });

  const metadata = fc.record({
    generationMode: fc.constant('txt2img' as const),
    positivePrompt: fc.string({ maxLength: 20 }),
    negativePrompt: fc.string({ maxLength: 20 }),
    modelKey: fc.constantFrom('a', 'b', '', 'gone'),
    modelName: fc.constantFrom('', 'Model A', 'nothing'),
    vaeKey: fc.option(fc.string({ maxLength: 8 }), { nil: null }),
    seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    steps: fc.integer({ min: 1, max: 150 }),
    cfgScale: fc.integer({ min: 0, max: 300 }).map((n) => n / 10),
    cfgRescale: fc.constant(0),
    scheduler: fc.constantFrom<SchedulerName>(...SCHEDULERS),
    width: fc.integer({ min: 8, max: 512 }).map((n) => n * 8),
    height: fc.integer({ min: 8, max: 512 }).map((n) => n * 8),
    clipSkip: fc.integer({ min: 0, max: 2 }),
    seamlessX: fc.boolean(),
    seamlessY: fc.boolean(),
    loras: fc.array(fc.record({ key: fc.string({ maxLength: 6 }), weight: fc.integer({ min: -20, max: 20 }).map((n) => n / 10), isEnabled: fc.boolean() }), { maxLength: 5 }),
  }) as unknown as fc.Arbitrary<GenerationMetadata>;

  it('recallAll puts the stored settings back, and remix keeps the current seed and seed mode', () => {
    const main = (key: string, name: string) => ({ key, name, base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' }) as ModelConfig;
    useModels.setState({ models: [main('a', 'Model A'), main('b', 'Model B')] });
    check(
      fc.property(metadata, fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.boolean(), (m, seed, random) => {
        useParams.setState({ ...initial, modelKey: 'current', seed, shouldRandomizeSeed: random }, true);
        useParams.getState().remix(m);
        let s = useParams.getState();
        expect([s.seed, s.shouldRandomizeSeed]).toEqual([seed, random]);
        // The model is set only when it is installed: by its key, else by its name; otherwise the current one stays.
        const model = m.modelKey === 'a' || m.modelKey === 'b' ? m.modelKey : m.modelName === 'Model A' ? 'a' : 'current';
        expect([s.positivePrompt, s.steps, s.width, s.height, s.modelKey]).toEqual([m.positivePrompt, m.steps, m.width, m.height, model]);
        useParams.getState().recallAll(m);
        s = useParams.getState();
        expect([s.seed, s.shouldRandomizeSeed, s.cfgScale, s.scheduler]).toEqual([m.seed, false, m.cfgScale, m.scheduler]);
        expect(s.loras).toEqual(m.loras);
        expect(s.loras[0] === m.loras[0] && m.loras.length > 0).toBe(false);
      }),
    );
  });
});
