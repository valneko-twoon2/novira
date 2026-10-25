// A comic page's Canvas layers: the defaults of a page, reading a saved page (damaged parts dropped, every limit at its
// boundary), the saved shape, paper changes, and the look changes the toolbar and the assistant make.
import { describe, expect, it } from 'vitest';
import type { CanvasEntity, CanvasObject, RasterEntity } from '../canvas';
import { pagePixels } from './document';
import {
  addRaster,
  BALLOONS_SLOT,
  defaultBbox,
  defaultPageCanvas,
  MAX_COORDINATES_PER_PAGE,
  MAX_MASKS_PER_PAGE,
  MAX_OBJECTS_PER_LAYER,
  MAX_RASTERS_PER_PAGE,
  moveRaster,
  PANELS_SLOT,
  pageRasters,
  parsePageCanvas,
  rescaleCanvasDoc,
  serializePageCanvas,
  slotOf,
  updateRasterLook,
  withUrls,
  type PageCanvas,
} from './pageCanvasDoc';

const black = { r: 0, g: 0, b: 0, a: 1 };
const stroke = (id: string, points = [10, 10, 20, 20]): CanvasObject => ({ kind: 'stroke', id, tool: 'brush', color: black, width: 4, points, clip: null });
const picture = (id: string, imageName: string | null = 'sky.png', url = ''): CanvasObject => ({ kind: 'image', id, url, imageName, x: 5, y: 6, width: 100, height: 80 });
const raster = (id: string, objects: CanvasObject[] = [], extra: Partial<RasterEntity> = {}): RasterEntity => ({
  id,
  type: 'raster',
  seq: 1,
  name: null,
  isEnabled: true,
  isLocked: false,
  opacity: 1,
  x: 0,
  y: 0,
  objects,
  ...extra,
});
const mask = (id: string): CanvasEntity => ({ ...raster(id), type: 'inpaint', color: black, fill: 'solid', denoiseLimit: null, noiseLevel: null }) as CanvasEntity;
const ids = (doc: PageCanvas) => doc.entities.map((e) => e.id);
const read = (entities: unknown[], bbox: unknown = defaultBbox('A4')) => parsePageCanvas({ entities, bbox }, 'A4');

describe('the layers a page starts with', () => {
  it('are the panels slot with the balloons slot over it, and the whole page as the box in multiples of 8', () => {
    const doc = defaultPageCanvas('A4');
    expect(doc.entities.map((e) => (e as RasterEntity).slot)).toEqual([PANELS_SLOT, BALLOONS_SLOT]);
    const { width, height } = pagePixels({ size: 'A4' });
    expect(doc.bbox).toEqual({ x: 0, y: 0, width: Math.floor(width / 8) * 8, height: Math.floor(height / 8) * 8 });
    expect(doc.bbox.width % 8).toBe(0);
  });
});

describe('reading a saved page', () => {
  it('gives a page without a document (or with a damaged box) the defaults of its paper', () => {
    expect(parsePageCanvas(undefined, 'B5')).toEqual(defaultPageCanvas('B5'));
    expect(parsePageCanvas({ entities: [], bbox: { x: 0, y: 0, width: 'wide', height: 10 } }, 'A5').bbox).toEqual(defaultBbox('A5'));
  });

  it('keeps one slot of each kind, puts a missing one back at its end, and drops a slot of an unknown kind', () => {
    const doc = read([raster('ink', [stroke('s')]), raster('b', [], { slot: BALLOONS_SLOT }), raster('b2', [], { slot: BALLOONS_SLOT }), raster('x', [], { slot: 'tone' })]);
    expect(ids(doc)).toEqual([PANELS_SLOT, 'ink', 'b']);
    // A slot holds nothing and stays at the corner, whatever was saved.
    const odd = read([raster('p', [stroke('s')], { slot: PANELS_SLOT, x: 40, y: 50 })]);
    expect(slotOf(odd, PANELS_SLOT)).toMatchObject({ objects: [], x: 0, y: 0 });
  });

  it('gives a missing slot another id when a user layer holds its own', () => {
    const doc = read([raster(PANELS_SLOT, [stroke('s')])]);
    expect(slotOf(doc, PANELS_SLOT)!.id).toBe(`${PANELS_SLOT}-slot`);
    expect(new Set(ids(doc)).size).toBe(doc.entities.length);
  });

  it('orders the entities by group, keeps the first of a repeated id, and drops control layers and unknown kinds', () => {
    const control = { ...raster('c'), type: 'control', modelKey: null, weight: 1, beginEnd: [0, 1], controlMode: 'balanced', filter: 'none', withTransparencyEffect: true };
    const doc = read([mask('m'), raster('a'), raster('a', [], { name: 'copy' }), control, { id: 'u', type: 'tone', objects: [] }, 'junk']);
    expect(ids(doc)).toEqual([PANELS_SLOT, 'a', BALLOONS_SLOT, 'm']);
    expect(doc.entities[1]!.name).toBeNull();
  });

  it('holds every field to its range and drops damaged objects', () => {
    const doc = read([
      raster('a', [stroke('ok'), { ...stroke('nan'), points: [1, Number.NaN] }, { ...stroke('odd'), points: [1, 2, 3] }, { ...stroke('tool'), tool: 'pen' }, { kind: 'pose', id: 'p' }, 'junk'] as unknown as CanvasObject[], {
        opacity: 4,
        name: ' Line\nart ',
        blend: 'overlay' as never,
        x: 1.26,
      }),
    ]);
    const a = doc.entities[1]!;
    expect(a).toMatchObject({ opacity: 1, name: 'Line art', x: 1.3 });
    expect('blend' in a).toBe(false);
    expect(a.objects.map((o) => o.id)).toEqual(['ok']);
  });

  it('keeps a picture by its gallery name only, and drops one without a name', () => {
    const doc = read([raster('a', [picture('named', 'sky.png', 'blob:live'), picture('page-only', null, 'blob:x')])]);
    expect(doc.entities[1]!.objects).toEqual([{ ...picture('named'), url: '' }]);
  });

  it('cuts the rasters to MAX_RASTERS_PER_PAGE from the top, keeping both slots', () => {
    const many = Array.from({ length: MAX_RASTERS_PER_PAGE + 3 }, (_, i) => raster(`r${i}`));
    const doc = read([raster('p', [], { slot: PANELS_SLOT }), ...many, raster('b', [], { slot: BALLOONS_SLOT })]);
    const rasters = pageRasters(doc);
    expect(rasters).toHaveLength(MAX_RASTERS_PER_PAGE);
    expect(rasters.filter((e) => e.slot)).toHaveLength(2);
    expect(rasters.at(-2)!.id).toBe(`r${MAX_RASTERS_PER_PAGE - 3}`);
    // At the limit exactly, nothing is cut.
    const exact = read([raster('p', [], { slot: PANELS_SLOT }), ...many.slice(0, MAX_RASTERS_PER_PAGE - 2), raster('b', [], { slot: BALLOONS_SLOT })]);
    expect(pageRasters(exact)).toHaveLength(MAX_RASTERS_PER_PAGE);
  });

  it('keeps at most MAX_MASKS_PER_PAGE masks', () => {
    const doc = read(Array.from({ length: MAX_MASKS_PER_PAGE + 1 }, (_, i) => mask(`m${i}`)));
    expect(doc.entities.filter((e) => e.type === 'inpaint')).toHaveLength(MAX_MASKS_PER_PAGE);
  });

  it('keeps at most MAX_OBJECTS_PER_LAYER objects in a layer', () => {
    const objects = Array.from({ length: MAX_OBJECTS_PER_LAYER + 1 }, (_, i) => stroke(`s${i}`, [1, 1]));
    expect(read([raster('a', objects)]).entities[1]!.objects).toHaveLength(MAX_OBJECTS_PER_LAYER);
    expect(read([raster('a', objects.slice(0, MAX_OBJECTS_PER_LAYER))]).entities[1]!.objects).toHaveLength(MAX_OBJECTS_PER_LAYER);
  });

  it('keeps no more than MAX_COORDINATES_PER_PAGE coordinate numbers on a page', () => {
    const half = MAX_COORDINATES_PER_PAGE / 2;
    const big = (id: string, n: number) => stroke(id, Array.from({ length: n }, (_, i) => i % 100));
    // Two strokes that fill the page exactly are kept; one number more is not.
    expect(read([raster('a', [big('a1', half)]), raster('b', [big('b1', half)])]).entities.flatMap((e) => e.objects)).toHaveLength(2);
    const over = read([raster('a', [big('a1', half)]), raster('b', [big('b1', half), stroke('extra', [1, 1])])]);
    expect(over.entities.flatMap((e) => e.objects).map((o) => o.id)).toEqual(['a1', 'b1']);
  });

  it('rounds every coordinate to a tenth of a pixel and keeps the box in multiples of 8, at least 64', () => {
    const doc = read([raster('a', [stroke('s', [1.04, 2.06, 3.16, 4.149])])], { x: 3.4, y: 2.6, width: 70.2, height: 10 });
    expect((doc.entities[1]!.objects[0] as { points: number[] }).points).toEqual([1, 2.1, 3.2, 4.1]);
    expect(doc.bbox).toEqual({ x: 3, y: 3, width: 64, height: 64 });
  });
});

describe('the saved shape of a page', () => {
  it('reads back as it was saved', () => {
    const doc = read([raster('a', [stroke('s'), picture('i')], { blend: 'multiply', opacity: 0.5, name: 'Ink' }), mask('m')]);
    expect(parsePageCanvas(JSON.parse(JSON.stringify(serializePageCanvas(doc, 'A4'))), 'A4')).toEqual(doc);
  });

  it('leaves out a picture that lives only in the page', () => {
    const live: PageCanvas = { ...defaultPageCanvas('A4'), entities: [...defaultPageCanvas('A4').entities, raster('a', [picture('i', null, 'blob:x')])] };
    expect(serializePageCanvas(live, 'A4').entities.flatMap((e) => e.objects)).toEqual([]);
  });
});

describe('a page on another paper', () => {
  const doc: PageCanvas = { entities: [raster('p', [], { slot: PANELS_SLOT }), raster('a', [stroke('s', [0, 0, 100, 200])], { x: 10, y: 20 })], bbox: { x: 0, y: 0, width: 1000, height: 2000 } };

  it('scales everything by one factor, centres it, and leaves the slots at the corner', () => {
    const next = rescaleCanvasDoc(doc, { width: 1000, height: 2000 }, { width: 1000, height: 1000 });
    // Half as tall: everything at half size, centred across.
    const a = next.entities[1]!;
    expect(a).toMatchObject({ x: 255, y: 10 });
    expect(a.objects[0]).toMatchObject({ width: 2, points: [0, 0, 50, 100] });
    expect(next.entities[0]).toBe(doc.entities[0]);
    expect(next.bbox).toEqual({ x: 250, y: 0, width: 496, height: 1000 });
  });

  it('keeps the same document when the size does not change', () => {
    expect(rescaleCanvasDoc(doc, { width: 1000, height: 2000 }, { width: 1000, height: 2000 })).toBe(doc);
  });
});

describe('changing the look of the layers', () => {
  const doc = read([raster('a'), raster('b')]);

  it('changes a raster layer in range and nothing when nothing changes', () => {
    const next = updateRasterLook(doc, 'a', { opacity: 3, isEnabled: false, isLocked: true, blend: 'screen', name: ' Ink ' })!;
    expect(next.entities.find((e) => e.id === 'a')).toMatchObject({ opacity: 1, isEnabled: false, isLocked: true, blend: 'screen', name: 'Ink' });
    expect('blend' in updateRasterLook(next, 'a', { blend: 'normal' })!.entities.find((e) => e.id === 'a')!).toBe(false);
    expect(updateRasterLook(doc, 'a', { opacity: 1, isEnabled: true })).toBeNull();
    expect(updateRasterLook(doc, 'missing', { isEnabled: false })).toBeNull();
  });

  it('moves a raster among the rasters, slots too, and not past either end', () => {
    expect(ids(moveRaster(doc, BALLOONS_SLOT, 'down')!)).toEqual([PANELS_SLOT, 'a', BALLOONS_SLOT, 'b']);
    expect(moveRaster(doc, PANELS_SLOT, 'down')).toBeNull();
    expect(moveRaster(doc, BALLOONS_SLOT, 'up')).toBeNull();
    expect(moveRaster(doc, 'missing', 'up')).toBeNull();
  });

  it('adds an empty raster on top with the next number, and none past the limit', () => {
    const next = addRaster(doc, 'Speed lines')!;
    expect(pageRasters(next).at(-1)).toMatchObject({ name: 'Speed lines', objects: [], seq: 4 });
    let full: PageCanvas | null = doc;
    for (let i = pageRasters(doc).length; i < MAX_RASTERS_PER_PAGE; i++) full = addRaster(full!, null);
    expect(addRaster(full!, null)).toBeNull();
  });

  it('looks pictures up by name for drawing, and leaves out one that is gone', () => {
    const [e] = withUrls([raster('a', [picture('i', 'sky.png'), picture('j', 'gone.png'), picture('k', null, 'blob:x')])], (n) => (n === 'sky.png' ? 'url:sky' : undefined));
    expect(e!.objects.map((o) => (o as { url: string }).url)).toEqual(['url:sky', 'blob:x']);
  });
});
