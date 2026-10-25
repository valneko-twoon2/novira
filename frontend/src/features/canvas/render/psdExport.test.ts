// @vitest-environment jsdom
// "Save Canvas as PSD": which canvas layers become layers of the file, with their names, opacity and visibility, and that
// the document is the bounding box. Drawing goes to recorded canvases, so this checks the layers, not the pixels.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { setLocale } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { buildCanvasPsd, canvasPsdLayers } from './psdExport';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));

const initial = useCanvas.getState();
const c = () => useCanvas.getState();
const red = { r: 255, g: 0, b: 0, a: 1 };
const square = (x: number) => [{ kind: 'rect' as const, id: `r${x}`, x, y: 0, width: 20, height: 20, color: red }];

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  setLocale('en');
  useCanvas.setState(initial, true);
  useCanvas.setState({ bbox: { x: 0, y: 0, width: 16, height: 12 } });
  canvases = installRecordingCanvases();
});
afterEach(() => {
  canvases.restore();
  setLocale('ja');
});

/** Two raster layers (the second switched off, at half opacity and renamed), a control layer and an inpaint mask. */
function sample() {
  const first = c().addEntity('raster', { objects: square(0) });
  const second = c().addEntity('raster', { objects: square(5), opacity: 0.5, isEnabled: false, name: 'Ink' });
  const control = c().addEntity('control', { objects: square(2) });
  c().addEntity('inpaint', { objects: square(1) });
  return { first, second, control };
}

describe('the layers of the canvas file', () => {
  it('are the raster layers with their name, opacity and visibility, then the control layers hidden; masks are left out', () => {
    const { first, second, control } = sample();
    expect(canvasPsdLayers(c()).map((l) => [l.entity.id, l.name, l.opacity, l.hidden])).toEqual([
      [first, 'Raster Layer 1', 1, false],
      [second, 'Ink', 0.5, true],
      [control, 'Control Layer 1', 1, true],
    ]);
  });

  it('are hidden when their group is hidden', () => {
    sample();
    c().setGroupHidden('raster', true);
    expect(canvasPsdLayers(c()).map((l) => l.hidden)).toEqual([true, true, true]);
  });
});

describe('the canvas file', () => {
  it('is the size of the bounding box, has one layer per drawn layer, and the visible raster layers as its picture', async () => {
    sample();
    const doc = await buildCanvasPsd(c());
    expect(doc).toMatchObject({ width: 16, height: 12 });
    expect(doc.layers.map((l) => [l.name, l.opacity ?? 1, !!l.hidden])).toEqual([
      ['Raster Layer 1', 1, false],
      ['Ink', 0.5, true],
      ['Control Layer 1', 1, true],
    ]);
    expect(doc.composite.length).toBe(16 * 12 * 4);
    // Each layer is drawn at full strength; the file carries its opacity.
    const strengths = canvases.all.flatMap((rec) => rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value));
    expect(strengths).not.toContain(0.5);
  });

  it('keeps the blend of a raster layer in the file and draws the layer itself normally', async () => {
    c().addEntity('raster', { objects: square(0), blend: 'multiply' });
    c().addEntity('raster', { objects: square(5), blend: 'screen' });
    c().addEntity('raster', { objects: square(2), blend: 'normal' });
    expect(canvasPsdLayers(c()).map((l) => l.blend)).toEqual(['multiply', 'screen', 'normal']);
    const doc = await buildCanvasPsd(c());
    expect(doc.layers.map((l) => l.blend)).toEqual(['multiply', 'screen', undefined]);
    // The flattened picture is drawn first with the blends; each layer after it alone and normal.
    const [flat, ...alone] = canvases.all.filter((rec) => rec.of('drawImage').length > 0);
    expect(flat!.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).toContain('multiply');
    for (const rec of alone) expect(rec.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).not.toContain('multiply');
  });

  it('leaves out a layer with nothing inside the bounding box', async () => {
    canvases.restore();
    canvases = installRecordingCanvases({ pixel: () => [0, 0, 0, 0] });
    sample();
    expect((await buildCanvasPsd(c())).layers).toEqual([]);
  });
});
