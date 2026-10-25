// Migrating version 1 page layers to Canvas layers, by equivalence class (built-in layers, drawings, pictures with and
// without a gallery picture, turned or not) and at the boundaries (a dot, points at the edge of their range, the most
// layers and points version 1 kept); and the document versions a build reads.
import { describe, expect, it } from 'vitest';
import type { ImageObject, RasterEntity, StrokeObject } from '../canvas';
import { COMIC_VERSION, pagePixels, parseComicProject, readComicProject, serializeComicProject } from './document';
import { pictureBox } from './imageView';
import { MAX_LAYERS_PER_PAGE, MAX_POINTS_PER_PAGE, MAX_POINTS_PER_STROKE } from './layersV1';
import { hexToRgba, migrateLayers, type ImageSizeOf } from './migrateLayers';
import { BALLOONS_SLOT, defaultBbox, MAX_COORDINATES_PER_PAGE, PANELS_SLOT, pageRasters } from './pageCanvasDoc';

const { width: W, height: H } = pagePixels({ size: 'A4' });
const sizes: Record<string, { width: number; height: number }> = { 'sky.png': { width: 400, height: 300 } };
const sizeOf: ImageSizeOf = (name) => sizes[name];
const migrate = (layers: unknown) => migrateLayers(layers, 'A4', sizeOf);
const rasters = (layers: unknown) => pageRasters(migrate(layers).canvas);
const view = (extra: object = {}) => ({ cx: 0.4, cy: 0.6, scale: 0.5, rotation: 0, flipX: false, flipY: false, ...extra });
const panels = { id: 'panels', kind: 'panels' };
const balloons = { id: 'balloons', kind: 'balloons' };

describe('the built-in layers', () => {
  it('become the two slots of a page saved without layers', () => {
    const doc = migrate(undefined).canvas;
    expect(pageRasters(doc).map((e) => [e.id, e.slot, e.objects.length])).toEqual([
      ['panels', PANELS_SLOT, 0],
      ['balloons', BALLOONS_SLOT, 0],
    ]);
    expect(doc.bbox).toEqual(defaultBbox('A4'));
  });

  it('keep their visibility, lock, opacity, blend and name', () => {
    const [p, b] = rasters([
      { ...panels, visible: false, locked: true, opacity: 0.25, blend: 'multiply', name: 'Frames' },
      { ...balloons, blend: 'normal' },
    ]);
    expect(p).toMatchObject({ isEnabled: false, isLocked: true, opacity: 0.25, blend: 'multiply', name: 'Frames', slot: PANELS_SLOT });
    expect(b).toMatchObject({ isEnabled: true, isLocked: false, opacity: 1, name: null, slot: BALLOONS_SLOT });
    expect('blend' in b!).toBe(false);
  });
});

describe('a drawing layer', () => {
  it('becomes a raster of strokes in page pixels: points, width and colour', () => {
    const [, ink] = rasters([panels, { id: 'ink', kind: 'drawing', name: 'Ink', opacity: 0.5, blend: 'screen', strokes: [{ points: [0.1, 0.2, 0.5, 0.25], color: '#FF8000', width: 0.004, erase: false }] }, balloons]);
    expect(ink).toMatchObject({ id: 'ink', name: 'Ink', opacity: 0.5, blend: 'screen', x: 0, y: 0 });
    const s = ink!.objects[0] as StrokeObject;
    const r = (v: number) => Math.round(v * 10) / 10;
    expect(s).toEqual({ kind: 'stroke', id: 'ink-stroke-0', tool: 'brush', color: { r: 255, g: 128, b: 0, a: 1 }, width: r(0.004 * W), points: [r(0.1 * W), r(0.2 * H), r(0.5 * W), r(0.25 * H)], clip: null });
  });

  it('keeps an eraser stroke as an eraser stroke of the same layer, and a single press as a dot', () => {
    const [, ink] = rasters([{ id: 'ink', kind: 'drawing', strokes: [{ points: [0.5, 0.5], color: '#000000', width: 0.01, erase: true }] }]);
    expect(ink!.objects[0]).toMatchObject({ tool: 'eraser', points: [Math.round(0.5 * W * 10) / 10, Math.round(0.5 * H * 10) / 10] });
  });

  it('keeps points at the edges of their range, a little off the page', () => {
    const [, ink] = rasters([{ id: 'ink', kind: 'drawing', strokes: [{ points: [-0.1, 1.1, 1.1, -0.1], color: '#000000', width: 0.01 }] }]);
    expect((ink!.objects[0] as StrokeObject).points).toEqual([Math.round(-0.1 * W * 10) / 10, Math.round(1.1 * H * 10) / 10, Math.round(1.1 * W * 10) / 10, Math.round(-0.1 * H * 10) / 10]);
  });

  it('keeps an empty drawing as an empty raster', () => {
    expect(rasters([{ id: 'ink', kind: 'drawing', name: 'Empty', strokes: [] }])[1]).toMatchObject({ name: 'Empty', objects: [] });
  });

  it('keeps everything at the most layers and points version 1 kept', () => {
    const long = Array.from({ length: MAX_POINTS_PER_STROKE * 2 }, (_, i) => (i % 2 ? 0.3 : 0.6));
    const strokesPerLayer = MAX_POINTS_PER_PAGE / MAX_POINTS_PER_STROKE / (MAX_LAYERS_PER_PAGE - 2);
    const layers = [panels, ...Array.from({ length: MAX_LAYERS_PER_PAGE - 2 }, (_, i) => ({ id: `l${i}`, kind: 'drawing', strokes: Array.from({ length: Math.ceil(strokesPerLayer) }, () => ({ points: long, color: '#000000', width: 0.01 })) })), balloons];
    const out = rasters(layers);
    expect(out).toHaveLength(MAX_LAYERS_PER_PAGE);
    const points = out.reduce((n, e) => n + e.objects.reduce((m, o) => m + (o as StrokeObject).points.length, 0), 0);
    expect(points).toBe(MAX_POINTS_PER_PAGE * 2);
    expect(points).toBeLessThanOrEqual(MAX_COORDINATES_PER_PAGE);
  });
});

describe('a picture layer', () => {
  it('becomes a raster holding the picture where the page showed it, mirrored as it was', () => {
    const { canvas, bakes } = migrate([{ id: 'pic', kind: 'image', name: 'Sky', imageName: 'sky.png', view: view({ flipX: true }) }]);
    const box = pictureBox(view(), sizes['sky.png']!, { width: W, height: H });
    const o = pageRasters(canvas)[1]!.objects[0] as ImageObject;
    const r = (v: number) => Math.round(v * 10) / 10;
    expect(o).toEqual({ kind: 'image', id: 'pic-image', url: '', imageName: 'sky.png', x: r(box.cx - box.width / 2), y: r(box.cy - box.height / 2), width: r(box.width), height: r(box.height), flipX: true });
    expect(bakes).toEqual([]);
  });

  it('becomes an empty raster without a picture, or with one no longer in the gallery (version 1 did not draw it either)', () => {
    for (const imageName of [null, 'gone.png']) {
      const { canvas, bakes } = migrate([{ id: 'pic', kind: 'image', imageName, view: view() }]);
      expect(pageRasters(canvas)[1]!.objects).toEqual([]);
      expect(bakes).toEqual([]);
    }
  });

  it('notes a turned picture to bake and places it unturned meanwhile', () => {
    const { canvas, bakes } = migrate([{ id: 'pic', kind: 'image', imageName: 'sky.png', view: view({ rotation: 30, flipY: true }) }]);
    const box = pictureBox(view(), sizes['sky.png']!, { width: W, height: H });
    expect(bakes).toEqual([{ entityId: 'pic', objectId: 'pic-image', imageName: 'sky.png', cx: box.cx, cy: box.cy, width: box.width, height: box.height, rotation: 30, flipX: false, flipY: true }]);
    expect(pageRasters(canvas)[1]!.objects[0]).toMatchObject({ imageName: 'sky.png', flipY: true });
  });

  it('notes the smallest turn there is (a turn of 180 degrees too)', () => {
    expect(migrate([{ id: 'a', kind: 'image', imageName: 'sky.png', view: view({ rotation: 0.001 }) }]).bakes).toHaveLength(1);
    expect(migrate([{ id: 'a', kind: 'image', imageName: 'sky.png', view: view({ rotation: 180 }) }]).bakes).toHaveLength(1);
  });
});

describe('migrating', () => {
  it('keeps the order of the stack and gives the same layers when read twice', () => {
    const layers = [{ id: 'under', kind: 'drawing', strokes: [] }, panels, { id: 'mid', kind: 'image', imageName: 'sky.png', view: view() }, balloons];
    expect(rasters(layers).map((e) => e.id)).toEqual(['under', 'panels', 'mid', 'balloons']);
    expect(migrate(layers)).toEqual(migrate(layers));
  });

  it('turns colours into opaque Canvas colours, and a damaged one into black', () => {
    expect(hexToRgba('#0a0B0c')).toEqual({ r: 10, g: 11, b: 12, a: 1 });
    expect(hexToRgba('red')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('the versions a build reads', () => {
  const doc = (version: unknown, page: object) => ({ version, id: 'c', name: 'Story', pages: [{ id: 'p', panels: [{ id: 'x' }], ...page }] });

  it('reads version 1 by migrating its layers, and notes its turned pictures with the page', () => {
    const read = readComicProject(doc(1, { layers: [panels, { id: 'pic', kind: 'image', imageName: 'sky.png', view: view({ rotation: 90 }) }, balloons] }), sizeOf)!;
    expect(pageRasters(read.project.pages[0]!.canvas).map((e) => e.id)).toEqual(['panels', 'pic', 'balloons']);
    expect(read.bakes).toEqual([expect.objectContaining({ pageId: 'p', entityId: 'pic', rotation: 90 })]);
  });

  it('reads version 2 from its canvas, and gives a page without one the defaults', () => {
    const canvas = { entities: [{ id: 'r', type: 'raster', seq: 3, objects: [] }], bbox: { x: 0, y: 0, width: 512, height: 512 } };
    const page = parseComicProject(doc(2, { canvas }), sizeOf)!.pages[0]!;
    expect(pageRasters(page.canvas).map((e: RasterEntity) => e.id)).toEqual(['panels', 'r', 'balloons']);
    expect(page.canvas.bbox).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(pageRasters(parseComicProject(doc(2, {}), sizeOf)!.pages[0]!.canvas)).toHaveLength(2);
  });

  it('skips a document of another version or none, so it is never written back', () => {
    for (const version of [0, 3, '2', undefined, null]) expect(parseComicProject(doc(version, {}), sizeOf)).toBeNull();
  });

  it('saves under version 2 with the canvas and no version 1 layers', () => {
    const project = parseComicProject(doc(1, { layers: [panels, balloons] }), sizeOf)!;
    const saved = serializeComicProject(project) as { version: number; pages: Record<string, unknown>[] };
    expect(saved.version).toBe(COMIC_VERSION);
    expect(COMIC_VERSION).toBe(2);
    expect(saved.pages[0]).not.toHaveProperty('layers');
    expect(parseComicProject(JSON.parse(JSON.stringify(saved)), sizeOf)).toEqual(project);
  });
});
