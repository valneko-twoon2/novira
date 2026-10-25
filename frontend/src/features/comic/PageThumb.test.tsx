// @vitest-environment jsdom
// The small drawing of a page with its raster layers: the panels at their slot with its look, the user's rasters between
// the slots composited into one small picture per run, a hidden layer left out. Drawing goes to recorded canvases.
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { CanvasObject, RasterEntity } from '@/state/canvas';
import { emptyPage, type ComicPage } from '@/state/comic/document';
import { moveRaster, updateRasterLook, type PageCanvas } from '@/state/comic/pageCanvasDoc';
import { PageThumb, thumbParts } from './PageThumb';

vi.mock('@/backend', async (original) => ({
  ...(await original<typeof import('@/backend')>()),
  loadImage: vi.fn(async (url: string) => ({ naturalWidth: 100, naturalHeight: 80, src: url }) as HTMLImageElement),
}));

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,thumb';
});
afterEach(() => {
  cleanup();
  canvases.restore();
});

const square = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];
const ink: CanvasObject = { kind: 'stroke', id: 's', tool: 'brush', color: { r: 255, g: 0, b: 0, a: 1 }, width: 8, points: [10, 10, 200, 300], clip: null };
const raster = (id: string, objects: CanvasObject[] = [ink]): RasterEntity => ({ id, type: 'raster', seq: 3, name: id, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects });

function samplePage(change: (doc: PageCanvas) => PageCanvas = (d) => d): ComicPage {
  const page = emptyPage(1);
  const doc = { ...page.canvas, entities: [raster('under'), ...page.canvas.entities, raster('a'), raster('b'), raster('empty', [])] };
  return { ...page, canvas: change(doc) };
}

const order = (svg: Element) => [...svg.querySelectorAll('[data-thumb-layer]')].map((g) => g.getAttribute('data-thumb-layer'));

describe('the runs of a page small drawing', () => {
  it('gathers the shown rasters with something drawn between the slots, bottom first', () => {
    const parts = thumbParts(samplePage().canvas);
    expect(parts.map((p) => (p.kind === 'slot' ? p.layer.slot : p.layers.map((l) => l.id).join('+')))).toEqual(['under', 'panels', 'balloons', 'a+b']);
    const hidden = thumbParts(samplePage((d) => updateRasterLook(d, 'a', { isEnabled: false })!).canvas);
    expect(hidden.at(-1)).toMatchObject({ kind: 'run', layers: [expect.objectContaining({ id: 'b' })] });
  });
});

describe('the small drawing of a page with layers', () => {
  it('draws the panels at their slot with its look, and each run of rasters as a small picture in the stack order', async () => {
    const page = samplePage((d) => updateRasterLook(d, 'panels', { opacity: 0.5, blend: 'multiply' })!);
    const { container } = render(<PageThumb shapes={[square]} aspect={2} page={page} urlOf={(n) => `blob:${n}`} />);
    const svg = container.querySelector('svg')!;
    await waitFor(() => expect(order(svg)).toEqual(['raster', 'panels', 'raster']));
    const panels = svg.querySelector('[data-thumb-layer="panels"]') as SVGGElement;
    expect(panels.getAttribute('opacity')).toBe('0.5');
    expect(panels.style.mixBlendMode).toBe('multiply');
    expect(svg.querySelector('[data-thumb-layer="raster"]')!.getAttribute('href')).toBe('data:image/png;base64,thumb');
  });

  it('leaves out a hidden slot and follows a run moved under the panels', async () => {
    let page = samplePage((d) => updateRasterLook(d, 'panels', { isEnabled: false })!);
    for (const id of ['a', 'a', 'a']) page = { ...page, canvas: moveRaster(page.canvas, id, 'down') ?? page.canvas };
    const { container } = render(<PageThumb shapes={[square]} aspect={1.4} page={page} />);
    await waitFor(() => expect(order(container.querySelector('svg')!)).toEqual(['raster', 'raster']));
    expect(container.querySelectorAll('.comic-thumb__panel')).toHaveLength(0);
  });

  it('draws the panels alone without a page', () => {
    const { container } = render(<PageThumb shapes={[square]} aspect={1.4} />);
    expect(container.querySelectorAll('.comic-thumb__panel')).toHaveLength(1);
    expect(order(container.querySelector('svg')!)).toEqual([]);
  });
});
