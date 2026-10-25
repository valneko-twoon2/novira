// @vitest-environment jsdom
// Drawing the whole canvas stage onto a recorded context: background grid, layers in order, staged picture, bbox and cursor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordingContext, installRecordingCanvases, type Recorder } from '@/backend/mock/canvas2dRecorder.testkit';
import type { CanvasEntity, EntityType, RasterEntity } from '@/state/canvas';
import { readPalette } from '../palette';
import { drawStage, drawStageChrome, type StageScene } from './stageRender';

const picture = { width: 4, height: 4 } as HTMLImageElement;
vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: (url: string) => (url === '/staged.png' ? picture : null),
  imageVersion: () => 0,
}));

const palette = readPalette(document.documentElement);
const raster = (id: string, patch: Partial<RasterEntity> = {}): RasterEntity => ({
  id,
  seq: 1,
  name: null,
  isEnabled: true,
  isLocked: false,
  opacity: 1,
  x: 0,
  y: 0,
  type: 'raster',
  objects: [{ kind: 'rect', id: 'r', x: 0, y: 0, width: 30, height: 30, color: { r: 1, g: 2, b: 3, a: 1 } }],
  ...patch,
});
const none: Record<EntityType, boolean> = { raster: false, control: false, inpaint: false, regional: false };
const scene = (patch: Partial<StageScene> = {}): StageScene => ({
  width: 400,
  height: 300,
  dpr: 1,
  viewport: { x: 0, y: 0, scale: 1 },
  entities: [],
  groupHidden: none,
  selectedId: null,
  bbox: { x: 50, y: 40, width: 100, height: 80 },
  tool: 'brush',
  settings: { showGrid: false, snapToGrid: false, showHud: false, clipToBbox: false, preserveMask: false, autoProcess: false, dimOutsideBbox: false },
  palette,
  filterPreviews: {},
  pending: null,
  overlayImageUrl: null,
  cursor: null,
  brushWidth: 20,
  eraserWidth: 30,
  mosaicWidth: 40,
  fillColor: { r: 255, g: 0, b: 0, a: 1 },
  isPanning: false,
  ...patch,
});

let canvases: ReturnType<typeof installRecordingCanvases>;
let rec: Recorder;
beforeEach(() => {
  canvases = installRecordingCanvases();
  rec = recordingContext({ width: 400, height: 300 });
});
afterEach(() => canvases.restore());

describe('drawStage background', () => {
  it('clears and paints the checkerboard, without a grid by default', () => {
    drawStage(rec.ctx, scene());
    expect(rec.of('clearRect')[0]).toEqual([0, 0, 400, 300]);
    expect(rec.of('createPattern')).toHaveLength(1);
    expect(rec.of('fillRect')[0]).toEqual([0, 0, 400, 300]);
    expect(rec.of('moveTo')).toHaveLength(0);
  });

  it('draws minor and major grid lines when the grid is shown, widening the step when zoomed out', () => {
    const settings = { ...scene().settings, showGrid: true };
    drawStage(rec.ctx, scene({ settings }));
    const zoomedIn = rec.of('moveTo').length;
    expect(zoomedIn).toBeGreaterThan(0);
    expect(rec.sets.filter((s) => s.name === 'strokeStyle').map((s) => s.value)).toContain(palette.gridStrong);

    const far = recordingContext();
    drawStage(far.ctx, scene({ settings, viewport: { x: 0, y: 0, scale: 0.05 } }));
    expect(far.of('moveTo').length).toBeGreaterThan(0);
    const near = recordingContext();
    drawStage(near.ctx, scene({ settings, viewport: { x: -10, y: -10, scale: 8 } }));
    expect(near.of('moveTo').length).toBeGreaterThan(0);
  });
});

describe('drawStage layers', () => {
  it('draws enabled layers in group order with their opacity, and skips hidden ones', () => {
    const control = { ...raster('c'), type: 'control' } as unknown as CanvasEntity;
    const hiddenGroup = { ...raster('g'), type: 'inpaint', color: { r: 0, g: 0, b: 255, a: 1 }, fill: 'solid' } as unknown as CanvasEntity;
    const entities = [control, raster('a', { opacity: 0.5, x: 10, y: 20 }), raster('off', { isEnabled: false }), hiddenGroup];
    drawStage(rec.ctx, scene({ entities, groupHidden: { ...none, inpaint: true } }));
    const draws = rec.of('drawImage');
    // Two visible layers (the checker tile is a pattern, not a drawImage).
    expect(draws).toHaveLength(2);
    expect(rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value)).toEqual([0.5, 1, 1]);
    expect(draws[0]!.slice(1)).toEqual([10, 20, 30, 30]);
  });

  it('draws an in-progress object on its own layer and the staged picture inside the bbox', () => {
    const pending = { entityId: 'a', object: { kind: 'rect', id: 'p', x: 0, y: 0, width: 5, height: 5, color: { r: 0, g: 0, b: 0, a: 1 } } as const };
    drawStage(rec.ctx, scene({ entities: [raster('a')], pending, overlayImageUrl: '/staged.png' }));
    expect(rec.of('drawImage').at(-1)).toEqual([picture, 50, 40, 100, 80]);
    drawStage(rec.ctx, scene({ overlayImageUrl: '/still-loading.png' }));
    expect(rec.of('drawImage').filter((a) => a[0] === picture)).toHaveLength(1);
  });

  it('draws the layers apart with their blend when one is blended, then puts them over the checkerboard at once', () => {
    const entities = [raster('a'), raster('m', { blend: 'multiply' }), raster('off', { blend: 'screen', isEnabled: false })];
    drawStage(rec.ctx, scene({ entities }));
    const stage = rec.of('drawImage');
    expect(stage).toHaveLength(1);
    expect(stage[0]!.slice(1)).toEqual([0, 0]);
    const layers = canvases.of(stage[0]![0] as HTMLCanvasElement);
    expect(layers.of('drawImage')).toHaveLength(2);
    expect(layers.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).toEqual(['source-over', 'multiply']);
    expect(rec.sets.some((s) => s.name === 'globalCompositeOperation')).toBe(false);
  });

  it('draws straight onto the stage while no visible layer is blended', () => {
    drawStage(rec.ctx, scene({ entities: [raster('a'), raster('off', { blend: 'multiply', isEnabled: false })] }));
    expect(rec.of('drawImage')).toHaveLength(1);
    expect(rec.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).toEqual(['source-over']);
  });

  it('turns smoothing off when zoomed in', () => {
    drawStage(rec.ctx, scene({ viewport: { x: 0, y: 0, scale: 4 } }));
    expect(rec.sets.find((s) => s.name === 'imageSmoothingEnabled')!.value).toBe(false);
  });
});

describe('drawStage bbox', () => {
  it('outlines the box, dims the outside only when asked and shows handles and the size label for the bbox tool', () => {
    drawStage(rec.ctx, scene());
    expect(rec.of('strokeRect')).toHaveLength(2);
    expect(rec.of('fill')).toHaveLength(0);

    const dim = recordingContext();
    drawStage(dim.ctx, scene({ settings: { ...scene().settings, dimOutsideBbox: true } }));
    expect(dim.of('fill')[0]).toEqual(['evenodd']);

    const tool = recordingContext();
    drawStage(tool.ctx, scene({ tool: 'bbox' }));
    expect(tool.of('strokeRect').length).toBeGreaterThan(2 + 7);
    expect(tool.of('fillText')[0]![0]).toBe('100 × 80');
    expect(tool.of('roundRect')).toHaveLength(1);
  });
});

describe('drawStageChrome bbox', () => {
  const mask = (): CanvasEntity => ({ ...raster('m'), type: 'inpaint', color: { r: 255, g: 0, b: 0, a: 1 }, fill: 'solid', denoiseLimit: null, noiseLevel: null }) as CanvasEntity;
  const boxStrokes = (patch: Partial<StageScene>) => {
    const r = recordingContext({ width: 400, height: 300 });
    drawStageChrome(r.ctx, scene(patch));
    return r.of('strokeRect').length;
  };

  it('draws the generation box only for the box tool, on an inpaint mask or around a staged result', () => {
    expect(boxStrokes({})).toBe(0);
    expect(boxStrokes({ entities: [raster('a')], selectedId: 'a' })).toBe(0);
    expect(boxStrokes({ tool: 'bbox' })).toBeGreaterThanOrEqual(2);
    expect(boxStrokes({ entities: [mask()], selectedId: 'm' })).toBe(2);
    expect(boxStrokes({ overlayImageUrl: '/staged.png' })).toBe(2);
  });
});

describe('drawStage selection and cursor', () => {
  it('frames the selected layer for the move tool only', () => {
    const entities = [raster('a', { x: 5, y: 5 })];
    drawStage(rec.ctx, scene({ entities, selectedId: 'a', tool: 'move' }));
    expect(rec.of('setLineDash').some((a) => (a[0] as number[])[0] === 4)).toBe(true);

    for (const patch of [{ tool: 'brush' as const }, { selectedId: 'missing' }, { entities: [raster('a', { isEnabled: false })] }, { entities: [raster('a', { objects: [] })] }]) {
      const other = recordingContext();
      drawStage(other.ctx, scene({ entities, selectedId: 'a', tool: 'move', ...patch }));
      expect(other.of('setLineDash').some((a) => (a[0] as number[])[0] === 4)).toBe(false);
    }
  });

  it.each([
    ['brush', 10],
    ['eraser', 15],
    ['mosaic', 20],
  ] as const)('draws a %s cursor circle of the tool width', (tool, radius) => {
    drawStage(rec.ctx, scene({ tool, cursor: { x: 100, y: 100 } }));
    expect(rec.of('arc').some((a) => a[2] === radius)).toBe(true);
    // Only the brush shows its colour inside.
    expect(rec.of('arc').filter((a) => a[2] === radius).length).toBe(tool === 'brush' ? 2 : 1);
  });

  it('draws no cursor while panning, outside the stage or with another tool', () => {
    for (const patch of [{ isPanning: true }, { cursor: null }, { tool: 'move' as const }]) {
      const other = recordingContext();
      drawStage(other.ctx, scene({ tool: 'brush', cursor: { x: 1, y: 1 }, ...patch }));
      expect(other.of('arc')).toHaveLength(0);
    }
  });
});
