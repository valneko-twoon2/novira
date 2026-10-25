// Property tests for the gallery store and its derived lists: filtering, sorting, date filter, arbitrary operation
// sequences and what is loaded back from storage. In-process only (the store runs without a backend).
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BoardDTO, ImageDTO } from '@/backend';
import { check, junkJson, installMemoryLocalStorage, blockExternalNetwork } from '@/propertyTest.testkit';
import { inRange } from './dateFilter';
import { filterBoardImages, mergePersisted, selectBoardImages, useGallery } from './gallery';

blockExternalNetwork();

installMemoryLocalStorage();
const initial = useGallery.getState();
beforeEach(() => useGallery.setState(initial, true));

const BOARDS = ['b1', 'b2'];
const T0 = Date.UTC(2024, 0, 1);

const imageArb = (name: string): fc.Arbitrary<ImageDTO> =>
  fc.record({
    name: fc.constant(name),
    url: fc.constant(`blob:${name}`),
    thumbnailUrl: fc.constant(`blob:${name}`),
    width: fc.integer({ min: 1, max: 4096 }),
    height: fc.integer({ min: 1, max: 4096 }),
    createdAt: fc.integer({ min: T0, max: T0 + 40 * 86_400_000 }),
    boardId: fc.constantFrom<string | null>(null, ...BOARDS),
    starred: fc.boolean(),
    isIntermediate: fc.boolean(),
    category: fc.constantFrom<ImageDTO['category']>('general', 'user', 'mask', 'control', 'other'),
    metadata: fc.constant(null),
    workflow: fc.constant(null),
  });

/** Images with unique names `i0`, `i1`, ... */
const images = fc.integer({ min: 0, max: 30 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => imageArb(`i${i}`))));
const settings = fc.record({
  starredFirst: fc.boolean(),
  sortDirection: fc.constantFrom<'asc' | 'desc'>('asc', 'desc'),
  groupByDate: fc.boolean(),
});
const range = fc.option(
  fc.tuple(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 })).map(([a, b]) => {
    const day = (n: number) => new Date(T0 + n * 86_400_000).toISOString().slice(0, 10);
    return { from: day(Math.min(a, b)), to: day(Math.max(a, b)) };
  }),
  { nil: null },
);
const base = (imgs: ImageDTO[]) => fc.record({ images: fc.constant(imgs), selectedBoardId: fc.constantFrom<string>('none', ...BOARDS), view: fc.constantFrom<'images' | 'assets'>('images', 'assets'), search: fc.constantFrom('', 'i1', ' I2 ', 'zzz') });

describe('gallery list selection (properties)', () => {
  it('selectBoardImages returns a subset of one board and view, visible, in the date range, in comparator order', () => {
    check(
      fc.property(
        images.chain((imgs) => fc.tuple(base(imgs), settings, range)),
        ([b, st, dateFilter]) => {
          const out = selectBoardImages({ ...b, dateFilter, settings: { ...initial.settings, ...st } });
          const names = new Set(b.images.map((i) => i.name));
          expect(new Set(out.map((i) => i.name)).size).toBe(out.length);
          for (const i of out) {
            expect(names.has(i.name)).toBe(true);
            expect(i.isIntermediate).toBe(false);
            expect(i.boardId).toBe(b.selectedBoardId === 'none' ? null : b.selectedBoardId);
            expect((i.category !== 'general') === (b.view === 'assets')).toBe(true);
            if (dateFilter) expect(inRange(i.createdAt, dateFilter)).toBe(true);
          }
          // nothing that matches is lost
          const matching = filterBoardImages(b).filter((i) => !dateFilter || inRange(i.createdAt, dateFilter));
          expect([...out.map((i) => i.name)].sort()).toEqual(matching.map((i) => i.name).sort());
          if (!st.groupByDate) {
            for (let k = 1; k < out.length; k++) {
              const a = out[k - 1]!;
              const c = out[k]!;
              if (st.starredFirst && a.starred !== c.starred) expect(a.starred).toBe(true);
              else if (!st.starredFirst || a.starred === c.starred) {
                expect(st.sortDirection === 'desc' ? a.createdAt >= c.createdAt : a.createdAt <= c.createdAt).toBe(true);
              }
            }
          }
        },
      ),
    );
  });

  it('is idempotent: selecting from its own output gives the same list', () => {
    check(
      fc.property(
        images.chain((imgs) => fc.tuple(base(imgs), settings, range)),
        ([b, st, dateFilter]) => {
          const input = { dateFilter, settings: { ...initial.settings, ...st } };
          const once = selectBoardImages({ ...b, ...input });
          expect(selectBoardImages({ ...b, images: once, ...input })).toEqual(once);
        },
      ),
    );
  });

  it('is stable: equal sort keys keep their input order', () => {
    check(
      fc.property(images, (imgs) => {
        const flat = imgs.map((i) => ({ ...i, createdAt: T0, starred: false, isIntermediate: false, boardId: null, category: 'general' as const }));
        const out = selectBoardImages({ images: flat, selectedBoardId: 'none', view: 'images', search: '', dateFilter: null, settings: initial.settings });
        expect(out.map((i) => i.name)).toEqual(flat.map((i) => i.name));
      }),
    );
  });

  it('does not change the input array', () => {
    check(
      fc.property(images, settings, (imgs, st) => {
        const copy = [...imgs];
        selectBoardImages({ images: imgs, selectedBoardId: 'none', view: 'images', search: '', dateFilter: null, settings: { ...initial.settings, ...st } });
        expect(imgs).toEqual(copy);
      }),
    );
  });
});

type Op =
  | { op: 'add'; image: ImageDTO }
  | { op: 'remove'; picks: number[] }
  | { op: 'upsert'; picks: number[]; starred: boolean }
  | { op: 'select'; picks: number[] }
  | { op: 'viewer'; pick: number }
  | { op: 'compare'; pick: number }
  | { op: 'board'; id: string }
  | { op: 'removeBoard'; id: string }
  | { op: 'upsertBoard'; id: string }
  | { op: 'detach'; id: string }
  | { op: 'setImages'; count: number };

const picks = fc.array(fc.nat(50), { maxLength: 6 });
const boardId = fc.constantFrom('none', ...BOARDS);
const ops: fc.Arbitrary<Op[]> = fc.array(
  fc.oneof(
    imageArb('new').map((image) => ({ op: 'add' as const, image })),
    picks.map((p) => ({ op: 'remove' as const, picks: p })),
    fc.record({ op: fc.constant('upsert' as const), picks, starred: fc.boolean() }),
    picks.map((p) => ({ op: 'select' as const, picks: p })),
    fc.nat(50).map((pick) => ({ op: 'viewer' as const, pick })),
    fc.nat(50).map((pick) => ({ op: 'compare' as const, pick })),
    boardId.map((id) => ({ op: 'board' as const, id })),
    fc.constantFrom(...BOARDS).map((id) => ({ op: 'removeBoard' as const, id })),
    fc.constantFrom(...BOARDS).map((id) => ({ op: 'upsertBoard' as const, id })),
    fc.constantFrom(...BOARDS).map((id) => ({ op: 'detach' as const, id })),
    fc.nat(12).map((count) => ({ op: 'setImages' as const, count })),
  ),
  { maxLength: 40 },
);

describe('gallery store event sequences (properties)', () => {
  it('keeps names unique, selection / viewer / compare on existing images and boards valid', () => {
    let serial = 0;
    check(
      fc.property(ops, (sequence) => {
        useGallery.setState(initial, true);
        const g = () => useGallery.getState();
        const mk = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({ ...imageSample, name, url: `blob:${name}`, thumbnailUrl: `blob:${name}`, ...over });
        const nameAt = (p: number) => g().images[p % Math.max(1, g().images.length)]?.name;
        g().setImages(Array.from({ length: 6 }, (_, i) => mk(`s${i}`)));
        g().setBoards(BOARDS.map((id): BoardDTO => ({ id, name: id, archived: false, createdAt: 0 })));
        for (const o of sequence) {
          switch (o.op) {
            case 'add':
              g().addImage({ ...o.image, name: `n${serial++ % 8}` });
              break;
            case 'remove':
              g().removeImages(o.picks.flatMap((p) => nameAt(p) ?? []));
              break;
            case 'upsert':
              g().upsertImages(o.picks.flatMap((p) => nameAt(p) ?? []).map((n) => mk(n, { starred: o.starred })));
              break;
            case 'select':
              g().setSelection([...new Set(o.picks.flatMap((p) => nameAt(p) ?? []))]);
              break;
            case 'viewer':
              g().setViewerImage(nameAt(o.pick) ?? null);
              break;
            case 'compare':
              g().setCompareImage(nameAt(o.pick) ?? null);
              break;
            case 'board':
              // the UI only offers boards that exist
              g().selectBoard(['none', ...g().boards.map((b) => b.id)].includes(o.id) ? o.id : 'none');
              break;
            case 'removeBoard':
              g().removeBoard(o.id);
              break;
            case 'upsertBoard':
              g().upsertBoard({ id: o.id, name: o.id, archived: false, createdAt: 1 });
              break;
            case 'detach':
              g().detachBoardImages(o.id);
              break;
            case 'setImages':
              g().setImages(Array.from({ length: o.count }, (_, i) => mk(`s${i}`)));
              g().setSelection([]);
              g().setViewerImage(null);
              g().setCompareImage(null);
              break;
          }
          const s = g();
          const names = s.images.map((i) => i.name);
          expect(new Set(names).size).toBe(names.length);
          expect(new Set(s.boards.map((b) => b.id)).size).toBe(s.boards.length);
          const present = new Set(names);
          expect(s.selection.every((n) => present.has(n))).toBe(true);
          // removeImages (the only way an image leaves) also clears viewer and compare
          if (o.op === 'remove') {
            if (s.viewerImageName) expect(present.has(s.viewerImageName)).toBe(true);
            if (s.compareImageName) expect(present.has(s.compareImageName)).toBe(true);
          }
          const ids = new Set(['none', ...s.boards.map((b) => b.id)]);
          expect(ids.has(s.selectedBoardId)).toBe(true);
          expect(ids.has(s.autoAddBoardId)).toBe(true);
          expect(s.page).toBeGreaterThanOrEqual(0);
        }
      }),
      60,
    );
  });
});

const imageSample: ImageDTO = {
  name: 'x',
  url: '',
  thumbnailUrl: '',
  width: 64,
  height: 64,
  createdAt: T0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
};

describe('gallery persistence (properties)', () => {
  it('mergePersisted never throws for any stored value and keeps every default setting key', () => {
    check(
      fc.property(junkJson, (stored) => {
        const merged = mergePersisted(stored, initial);
        for (const key of Object.keys(initial.settings)) expect(key in merged.settings).toBe(true);
        expect(merged.images).toBe(initial.images);
      }),
    );
  });

  it('mergePersisted keeps defaults for settings that an older save lacks', () => {
    check(
      fc.property(fc.subarray(Object.keys(initial.settings)), (keys) => {
        const saved = Object.fromEntries(keys.map((k) => [k, (initial.settings as unknown as Record<string, unknown>)[k]]));
        expect(mergePersisted({ settings: saved }, initial).settings).toEqual(initial.settings);
      }),
    );
  });
});
