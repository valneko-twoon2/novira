import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS } from './settings';
import { createCanvasStore, isSlot, selectedEntity, stagedPage, stagedPageCount, useCanvas,type CanvasEntity, type RectObject, type StrokeObject } from './canvas';
import { useParams } from './params';

const initialCanvas = useCanvas.getState();
const initialParams = useParams.getState();

beforeEach(() => {
  useParams.setState(initialParams, true);
  useCanvas.setState(initialCanvas, true);
});
afterEach(() => vi.useRealTimers());

const c = () => useCanvas.getState();
const ids = () => c().entities.map((e) => e.id);
const types = () => c().entities.map((e) => e.type);

const rect = (id: string): RectObject => ({ kind: 'rect', id, x: 0, y: 0, width: 8, height: 8, color: { r: 0, g: 0, b: 0, a: 1 } });

describe('entities', { tags: [] }, () => {
  it('numbers entities per type, selects the new one and regroups them by type when arranged', { tags: ['scenario'] }, () => {
    const r1 = c().addEntity('raster');
    const m1 = c().addEntity('inpaint');
    const r2 = c().addEntity('raster');
    expect(c().selectedEntityId).toBe(r2);
    expect(c().entities.map((e) => [e.type, e.seq])).toEqual([
      ['raster', 1],
      ['inpaint', 1],
      ['raster', 2],
    ]);
    // Arranging regroups the entities in render order.
    c().arrangeEntity(r1, 'top');
    expect(ids()).toEqual([r2, r1, m1]);
  });

  it('gives regional masks different colors', { tags: ['equivalence'] }, () => {
    const a = c().addEntity('regional');
    const b = c().addEntity('regional');
    const color = (id: string) => (c().entities.find((e) => e.id === id) as Extract<CanvasEntity, { type: 'regional' }>).color;
    expect(color(a)).not.toEqual(color(b));
  });

  it('shows a hidden group again when an entity is added to it', { tags: ['condition'] }, () => {
    c().setGroupHidden('control', true);
    c().addEntity('control');
    expect(c().groupHidden.control).toBe(false);
  });

  it('selects the last entity of the same type after removing the selected one', { tags: ['condition'] }, () => {
    const r1 = c().addEntity('raster');
    c().addEntity('inpaint');
    const r2 = c().addEntity('raster');
    c().setFilterPreview(r2, { url: 'blob:p', x: 0, y: 0, width: 1, height: 1 });
    c().removeEntity(r2);
    expect(c().selectedEntityId).toBe(r1);
    expect(c().filterPreviews).toEqual({});
  });

  it('falls back to any entity, then to none, when no entity of the same type is left', { tags: ['boundary', 'condition'] }, () => {
    const m = c().addEntity('inpaint');
    const r = c().addEntity('raster');
    c().removeEntity(r);
    expect(c().selectedEntityId).toBe(m);
    c().removeEntity(m);
    expect(c().selectedEntityId).toBeNull();
  });

  it('duplicates an entity right after the source with a fresh number and no name', { tags: ['equivalence'] }, () => {
    const a = c().addEntity('raster', { name: 'Sky' });
    const b = c().addEntity('raster');
    c().duplicateEntity(a);
    const copy = c().entities[1]!;
    expect(ids()).toEqual([a, copy.id, b]);
    expect(copy).toMatchObject({ type: 'raster', seq: 3, name: null });
    expect(c().selectedEntityId).toBe(copy.id);
  });

  it('moves an entity up and down within its type only', { tags: ['boundary', 'condition'] }, () => {
    const r1 = c().addEntity('raster');
    const r2 = c().addEntity('raster');
    const ctl = c().addEntity('control');
    c().arrangeEntity(r2, 'down');
    expect(ids()).toEqual([r2, r1, ctl]);
    const before = c().past.length;
    // Already at the bottom: nothing changes and no history step is added.
    c().arrangeEntity(r2, 'bottom');
    expect(ids()).toEqual([r2, r1, ctl]);
    expect(c().past.length).toBe(before);
  });

  it(
    'moves a layer to the position of another layer of the same type, and ignores other types',
    { tags: ['condition', 'error-guessing'] },
    () => {
      const a = c().addEntity('raster');
      const b = c().addEntity('raster');
      const d = c().addEntity('raster');
      const m = c().addEntity('inpaint');
      c().moveEntityTo(a, d);
      expect(ids().slice(0, 3)).toEqual([b, d, a]);
      c().moveEntityTo(a, b);
      expect(ids().slice(0, 3)).toEqual([a, b, d]);
      const before = c().past.length;
      c().moveEntityTo(a, m);
      c().moveEntityTo(a, a);
      expect(ids().slice(0, 3)).toEqual([a, b, d]);
      expect(c().past.length).toBe(before);
    },
  );

  it(
    'flips a layer around the given center, mirroring strokes, rects and images, and undoes it',
    { tags: ['equivalence', 'state-transition'] },
    () => {
      const id = c().addEntity('raster');
      const stroke: StrokeObject = { kind: 'stroke', id: 's1', tool: 'brush', color: { r: 0, g: 0, b: 0, a: 1 }, width: 2, points: [0, 0, 10, 4], clip: null };
      c().addObject(id, stroke);
      c().addObject(id, { kind: 'image', id: 'i1', url: 'u', imageName: null, x: 20, y: 0, width: 10, height: 10 });
      c().flipEntity(id, 'horizontal', 15);
      const [s, i] = c().entities[0]!.objects;
      expect(s).toMatchObject({ points: [30, 0, 20, 4] });
      expect(i).toMatchObject({ x: 0, flipX: true });
      c().undo();
      expect(c().entities[0]!.objects[0]).toMatchObject({ points: [0, 0, 10, 4] });
      expect(c().entities[0]!.objects[1]).not.toHaveProperty('flipX', true);
    },
  );

  it('flips vertically and restores the picture when flipped twice', { tags: ['scenario'] }, () => {
    const id = c().addEntity('raster');
    c().addObject(id, { kind: 'rect', id: 'r1', x: 0, y: 2, width: 4, height: 6, color: { r: 0, g: 0, b: 0, a: 1 } });
    c().addObject(id, { kind: 'image', id: 'i1', url: 'u', imageName: null, x: 0, y: 0, width: 4, height: 2 });
    c().flipEntity(id, 'vertical', 5);
    expect(c().entities[0]!.objects[0]).toMatchObject({ y: 2 });
    expect(c().entities[0]!.objects[1]).toMatchObject({ y: 8, flipY: true });
    c().flipEntity(id, 'vertical', 5);
    expect(c().entities[0]!.objects[0]).toMatchObject({ y: 2 });
    expect(c().entities[0]!.objects[1]).toMatchObject({ y: 0, flipY: false });
  });

  it('does nothing to a layer without objects', { tags: ['boundary'] }, () => {
    const id = c().addEntity('raster');
    const before = c().past.length;
    c().flipEntity(id, 'horizontal', 0);
    expect(c().past.length).toBe(before);
  });

  it('converts between mask types keeping color, fill, opacity and objects', { tags: ['equivalence'] }, () => {
    const id = c().addEntity('inpaint', { opacity: 0.3 });
    c().addObject(id, rect('o1'));
    const before = c().entities[0] as Extract<CanvasEntity, { type: 'inpaint' }>;
    c().convertEntity(id, 'regional');
    const after = c().entities[0]!;
    expect(after).toMatchObject({ id, type: 'regional', opacity: 0.3, color: before.color, fill: before.fill });
    expect(after.objects.map((o) => o.id)).toEqual(['o1']);
  });

  it('converting a mask to a raster layer takes the raster defaults and re-sorts', { tags: ['equivalence'] }, () => {
    const r = c().addEntity('raster');
    const m = c().addEntity('inpaint');
    c().convertEntity(m, 'raster');
    expect(types()).toEqual(['raster', 'raster']);
    expect(c().entities[1]).toMatchObject({ id: m, seq: 2 });
    expect(c().entities[0]!.id).toBe(r);
  });

  it('clears the canvas but can undo it', { tags: ['state-transition'] }, () => {
    c().addEntity('raster');
    c().clearCanvas();
    expect(c().entities).toEqual([]);
    expect(c().selectedEntityId).toBeNull();
    c().undo();
    expect(types()).toEqual(['raster']);
  });

  it('finds the selected entity', { tags: ['condition'] }, () => {
    const id = c().addEntity('control');
    expect(selectedEntity(c())?.id).toBe(id);
    c().select(null);
    expect(selectedEntity(c())).toBeUndefined();
  });
});

describe('slots', { tags: [] }, () => {
  const entity = (id: string) => c().entities.find((e) => e.id === id)!;

  it('tells a slot from an ordinary layer', { tags: ['equivalence'] }, () => {
    const slot = c().addEntity('raster', { slot: 'panels' });
    const plain = c().addEntity('raster');
    const mask = c().addEntity('inpaint');
    expect([slot, plain, mask].map((id) => isSlot(entity(id)))).toEqual([true, false, false]);
    expect(isSlot(undefined)).toBe(false);
  });

  it('takes no objects and no position, but keeps the rest of an update', { tags: ['condition'] }, () => {
    const slot = c().addEntity('raster', { slot: 'panels' });
    const steps = c().past.length;
    c().addObject(slot, rect('r'));
    c().updateEntity(slot, { objects: [rect('r')], x: 5, y: 6 });
    expect(entity(slot)).toMatchObject({ objects: [], x: 0, y: 0, slot: 'panels' });
    expect(c().past).toHaveLength(steps);
    c().updateEntity(slot, { objects: [rect('r')], opacity: 0.5, blend: 'multiply', isLocked: true, slot: 'other' });
    expect(entity(slot)).toMatchObject({ objects: [], opacity: 0.5, blend: 'multiply', isLocked: true, slot: 'panels' });
    expect(c().past).toHaveLength(steps + 1);
  });

  it('cannot be deleted, duplicated, flipped or converted', { tags: ['error-guessing'] }, () => {
    const slot = c().addEntity('raster', { slot: 'panels' });
    const before = c().entities;
    c().removeEntity(slot);
    c().duplicateEntity(slot);
    c().flipEntity(slot, 'horizontal', 10);
    c().convertEntity(slot, 'inpaint');
    expect(c().entities).toBe(before);
  });

  it('stays when the canvas is cleared, and is reordered like any raster layer', { tags: ['scenario'] }, () => {
    const below = c().addEntity('raster');
    const slot = c().addEntity('raster', { slot: 'panels' });
    const above = c().addEntity('raster');
    c().arrangeEntity(slot, 'top');
    expect(ids()).toEqual([below, above, slot]);
    c().moveEntityTo(above, slot);
    expect(ids()).toEqual([below, slot, above]);
    c().clearCanvas();
    expect(ids()).toEqual([slot]);
    expect(c().selectedEntityId).toBeNull();
  });

  it('adds a layer right under another layer of its type when asked, else on top', { tags: ['condition'] }, () => {
    const low = c().addEntity('raster');
    const slot = c().addEntity('raster', { slot: 'panels' });
    const under = c().addEntity('raster', {}, { under: slot });
    expect(ids()).toEqual([low, under, slot]);
    expect(c().selectedEntityId).toBe(under);
    const mask = c().addEntity('inpaint');
    const top = c().addEntity('raster', {}, { under: mask });
    expect(ids()).toEqual([low, under, slot, mask, top]);
  });
});

describe('history', { tags: [] }, () => {
  it('undoes and redoes document changes', { tags: ['state-transition', 'boundary'] }, () => {
    const a = c().addEntity('raster');
    c().updateEntity(a, { opacity: 0.5 });
    c().undo();
    expect(c().entities[0]!.opacity).toBe(1);
    c().undo();
    expect(c().entities).toEqual([]);
    c().redo();
    c().redo();
    expect(c().entities[0]!.opacity).toBe(0.5);
    // Nothing more to redo.
    c().redo();
    expect(c().entities[0]!.opacity).toBe(0.5);
  });

  it('drops the redo stack when a new change is made', { tags: ['state-transition'] }, () => {
    c().addEntity('raster');
    c().undo();
    expect(c().future).toHaveLength(1);
    c().addEntity('control');
    expect(c().future).toEqual([]);
  });

  it('coalesces changes with the same key within a second', { tags: ['boundary', 'condition'] }, () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const id = c().addEntity('raster');
    const base = c().past.length;
    c().updateEntity(id, { opacity: 0.9 }, { history: 'opacity' });
    vi.setSystemTime(10_500);
    c().updateEntity(id, { opacity: 0.8 }, { history: 'opacity' });
    expect(c().past.length).toBe(base + 1);
    vi.setSystemTime(12_000);
    c().updateEntity(id, { opacity: 0.7 }, { history: 'opacity' });
    expect(c().past.length).toBe(base + 2);
  });

  it('skips history when asked', { tags: ['condition'] }, () => {
    const id = c().addEntity('raster');
    const base = c().past.length;
    c().updateEntity(id, { opacity: 0.2 }, { history: false });
    expect(c().past.length).toBe(base);
  });

  it('keeps at most as many steps as the undo setting says (60 at first)', { tags: ['boundary'] }, () => {
    for (let i = 0; i < 70; i++) c().pushHistory();
    expect(c().past).toHaveLength(SETTINGS_DEFAULTS.undoLimit);
    expect(SETTINGS_DEFAULTS.undoLimit).toBe(60);
  });
});

describe('bbox', { tags: [] }, () => {
  it('rounds the bbox and syncs the generation size and aspect ratio', { tags: ['equivalence', 'boundary'] }, () => {
    c().setBbox({ x: 10.4, y: 0, width: 1283, height: 717 });
    expect(c().bbox).toEqual({ x: 10, y: 0, width: 1280, height: 720 });
    expect(useParams.getState()).toMatchObject({ width: 1280, height: 720, aspectRatio: '16:9' });
  });

  it('keeps a locked aspect ratio and skips syncing when asked', { tags: ['decision-table'] }, () => {
    useParams.getState().set({ aspectRatio: '1:1', aspectLocked: true });
    c().setBbox({ x: 0, y: 0, width: 640, height: 480 });
    expect(useParams.getState()).toMatchObject({ width: 640, height: 480, aspectRatio: '1:1' });
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { syncParams: false });
    expect(useParams.getState().width).toBe(640);
  });

  it('restores the generation size on undo', { tags: ['state-transition'] }, () => {
    c().setBbox({ x: 0, y: 0, width: 768, height: 512 });
    c().undo();
    expect(useParams.getState()).toMatchObject({ width: initialParams.width, height: initialParams.height });
  });

  it('adds no history step when the bbox does not change', { tags: ['condition'] }, () => {
    c().setBbox({ ...c().bbox });
    expect(c().past).toEqual([]);
  });
});

describe('tools and staging', { tags: [] }, () => {
  it('starts on the view tool', { tags: ['equivalence'] }, () => {
    expect(c().tool).toBe('view');
    expect(createCanvasStore({ syncParams: false }).getState().tool).toBe('view');
  });

  it('remembers the previous tool for swapping', { tags: ['state-transition'] }, () => {
    c().setTool('move');
    c().setTool('move');
    expect([c().tool, c().lastTool]).toEqual(['move', 'view']);
    c().swapTool();
    expect([c().tool, c().lastTool]).toEqual(['view', 'move']);
  });

  it('clamps brush and eraser widths', { tags: ['boundary'] }, () => {
    c().setBrushWidth(0);
    c().setEraserWidth(9999);
    expect([c().brushWidth, c().eraserWidth]).toEqual([1, 600]);
  });

  it('clamps the mosaic width and block size', { tags: ['boundary'] }, () => {
    c().setMosaicWidth(0);
    c().setMosaicBlock(1);
    expect([c().mosaicWidth, c().mosaicBlock]).toEqual([1, 2]);
    c().setMosaicWidth(9999);
    c().setMosaicBlock(9999);
    expect([c().mosaicWidth, c().mosaicBlock]).toEqual([600, 128]);
  });

  it('shows the newest staged image and wraps around when stepping', { tags: ['boundary', 'scenario'] }, () => {
    c().addStagedImage('a');
    c().addStagedImage('b');
    c().addStagedImage('c');
    expect(c().stagedIndex).toBe(2);
    c().setStagedIndex(3);
    expect(c().stagedIndex).toBe(0);
    c().setStagedIndex(-1);
    expect(c().stagedIndex).toBe(2);
  });

  it('keeps the staged index in range after discarding', { tags: ['boundary', 'state-transition'] }, () => {
    c().addStagedImage('a');
    c().addStagedImage('b');
    c().discardStaged(1);
    expect([c().stagedImageNames, c().stagedIndex]).toEqual([['a'], 0]);
    c().discardStaged(0);
    expect([c().stagedImageNames, c().stagedIndex]).toEqual([[], 0]);
  });
});

describe('the generating page of staging', { tags: [] }, () => {
  const page = () => stagedPage(c());
  // The backend reports a job done before its picture arrives, as the worker does.
  const finishLast = (name: string) => {
    c().setStagingGenerating(false);
    c().addStagedImage(name, { fromQueue: true });
  };

  it(
    'opens on the generating page, stays there while more come and shows the last result at the end',
    { tags: ['state-transition', 'scenario'] },
    () => {
      c().setStagingGenerating(true);
      expect(page()).toEqual({ index: 0, generating: true });
      c().addStagedImage('a', { fromQueue: true });
      expect([stagedPageCount(c()), page()]).toEqual([2, { index: 1, generating: true }]);
      finishLast('b');
      expect([stagedPageCount(c()), page()]).toEqual([2, { index: 1, generating: false }]);
      expect(c().stagedImageNames[page().index]).toBe('b');
    },
  );

  it(
    'leaves someone looking at a finished result on it while the next ones are made, the last included',
    { tags: ['state-transition'] },
    () => {
      c().setStagingGenerating(true);
      c().addStagedImage('a', { fromQueue: true });
      c().setStagedIndex(0);
      expect(page()).toEqual({ index: 0, generating: false });
      c().addStagedImage('b', { fromQueue: true });
      expect(page().index).toBe(0);
      finishLast('c');
      expect(page()).toEqual({ index: 0, generating: false });
    },
  );

  it('steps through the results and the generating page, wrapping around', { tags: ['boundary'] }, () => {
    c().setStagingGenerating(true);
    c().addStagedImage('a', { fromQueue: true });
    c().setStagedIndex(2);
    expect(page().index).toBe(0);
    c().setStagedIndex(-1);
    expect(page()).toEqual({ index: 1, generating: true });
  });

  it(
    'jumps to a new generation\'s page, and back into range when a job ends without a picture',
    { tags: ['state-transition', 'boundary'] },
    () => {
      c().addStagedImage('a');
      c().addStagedImage('b');
      c().setStagedIndex(0);
      c().setStagingGenerating(true);
      expect(page()).toEqual({ index: 2, generating: true });
      c().setStagingGenerating(false);
      expect(page()).toEqual({ index: 1, generating: false });
    },
  );

  it('shows a one-off result (an erase) straight away, even while a generation runs', { tags: ['condition'] }, () => {
    c().setStagingGenerating(true);
    c().addStagedImage('a', { fromQueue: true });
    c().addStagedImage('erased');
    expect(page()).toEqual({ index: 1, generating: false });
    expect(c().stagedImageNames[1]).toBe('erased');
  });
});

describe('separate stores', { tags: [] }, () => {
  it('keeps two instances and the global store independent', { tags: ['scenario'] }, () => {
    const a = createCanvasStore({ syncParams: false });
    const b = createCanvasStore({ syncParams: false });
    const id = a.getState().addEntity('raster');
    a.getState().setBrushWidth(7);
    a.getState().setBbox({ x: 0, y: 0, width: 640, height: 320 });
    expect(a.getState().entities.map((e) => e.id)).toEqual([id]);
    expect(b.getState().entities).toEqual([]);
    expect(c().entities).toEqual([]);
    expect(b.getState().brushWidth).toBe(initialCanvas.brushWidth);
    expect(c().bbox).toEqual(initialCanvas.bbox);
    b.getState().undo();
    expect(a.getState().entities).toHaveLength(1);
    a.getState().undo();
    expect(a.getState().bbox).toEqual(initialCanvas.bbox);
    expect(a.getState().entities).toHaveLength(1);
  });

  it('never writes the left form when syncParams is false', { tags: ['decision-table'] }, () => {
    const page = createCanvasStore({ syncParams: false });
    const params = useParams.getState();
    page.getState().setBbox({ x: 0, y: 0, width: 1280, height: 720 });
    page.getState().setBbox({ x: 0, y: 0, width: 768, height: 512 }, { syncParams: true });
    page.getState().undo();
    page.getState().redo();
    expect(page.getState().bbox).toEqual({ x: 0, y: 0, width: 768, height: 512 });
    expect(useParams.getState()).toBe(params);
  });
});
