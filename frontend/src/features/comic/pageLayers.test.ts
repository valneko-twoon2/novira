// @vitest-environment jsdom
// The page's raster layers in the saved page and its PSD: drawn in the order of the stack, a hidden one left out of the
// picture (and kept hidden in the file), a faded or blended one laid over the page with its opacity and blend, a user's
// raster drawn by the Canvas's own code on a canvas of its own (its eraser must not reach the layers under it), masks left
// out. Drawing goes to recorded canvases, so this checks the calls.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { setLocale } from '@/i18n';
import type { CanvasEntity, CanvasObject, RasterEntity } from '@/state/canvas';
import { emptyPage, newBubble, type ComicPage } from '@/state/comic/document';
import { moveRaster, updateRasterLook, type PageCanvas, type RasterLook } from '@/state/comic/pageCanvasDoc';
import { buildPagePsd, pageLayers } from './pagePsd';
import { drawPage, pageGroups, pageParts, preparePage, type PreparedPage } from './pageRender';

vi.mock('@/backend', async (original) => ({
  ...(await original<typeof import('@/backend')>()),
  loadImage: vi.fn(async (url: string) => ({ naturalWidth: 100, naturalHeight: 80, src: url }) as HTMLImageElement),
}));

const urlOf = (name: string) => `blob:${name}`;
const black = { r: 0, g: 0, b: 0, a: 1 };
const raster = (id: string, name: string, objects: CanvasObject[]): RasterEntity => ({ id, type: 'raster', seq: 3, name, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects });
const withCanvas = (page: ComicPage, change: (doc: PageCanvas) => PageCanvas | null): ComicPage => ({ ...page, canvas: change(page.canvas)! });
const look = (id: string, change: RasterLook) => (doc: PageCanvas) => updateRasterLook(doc, id, change);

/** A page of one panel with a balloon, an ink layer with a brush and an eraser stroke, and a picture layer on top. */
function samplePage(): ComicPage {
  const page = emptyPage(1);
  page.panels[0]!.bubbles = [{ ...newBubble('speech', 0.1, 0.1), text: 'Hi' }];
  const ink = raster('ink', 'Ink', [
    { kind: 'stroke', id: 's1', tool: 'brush', color: { r: 255, g: 0, b: 0, a: 1 }, width: 4, points: [2, 2, 10, 10], clip: null },
    { kind: 'stroke', id: 's2', tool: 'eraser', color: black, width: 6, points: [5, 5, 6, 6], clip: null },
  ]);
  const sky = raster('sky', 'Sky', [{ kind: 'image', id: 'i', url: '', imageName: 'sky.png', x: 0, y: 0, width: 10, height: 8 }]);
  return { ...page, canvas: { ...page.canvas, entities: [...page.canvas.entities, ink, sky] } };
}

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  setLocale('en');
  canvases = installRecordingCanvases({ pixel: (x, y) => (x < 2 && y < 2 ? [255, 255, 255, 255] : [0, 0, 0, 0]) });
});
afterEach(() => {
  canvases.restore();
  setLocale('ja');
});

async function prepared(page: ComicPage): Promise<PreparedPage> {
  return { ...(await preparePage(page, urlOf)), width: 20, height: 30 };
}

const partKinds = (ready: PreparedPage) => pageParts(ready).map((p) => p.kind);

describe('the order the saved page is drawn in', () => {
  it('follows the stack: paper and backdrop, then each layer bottom first', async () => {
    expect(partKinds(await prepared(samplePage()))).toEqual(['paper', 'backdrop', 'panel', 'frame', 'balloon', 'raster', 'raster']);
  });

  it('puts a layer moved under the panels under them, and the balloons where they were moved', async () => {
    let page = samplePage();
    for (let i = 0; i < 2; i++) page = withCanvas(page, (doc) => moveRaster(doc, 'ink', 'down'));
    page = withCanvas(page, (doc) => moveRaster(doc, 'balloons', 'up'));
    expect(page.canvas.entities.map((e) => e.id)).toEqual(['ink', 'panels', 'sky', 'balloons']);
    const ready = await prepared(page);
    expect(pageParts(ready).map((p) => (p.kind === 'raster' ? p.entity.id : p.kind))).toEqual(['paper', 'backdrop', 'ink', 'panel', 'frame', 'sky', 'balloon']);
  });

  it('leaves out a hidden layer, slot or not, and a page with only its slots is drawn as before there were layers', async () => {
    const hidden = withCanvas(withCanvas(samplePage(), look('balloons', { isEnabled: false })), look('sky', { isEnabled: false }));
    expect(partKinds(await prepared(hidden))).toEqual(['paper', 'backdrop', 'panel', 'frame', 'raster']);
    const plain = emptyPage(1);
    plain.panels[0]!.bubbles = [{ ...newBubble('speech', 0, 0), text: 'Hi' }];
    expect(partKinds(await prepared(plain))).toEqual(['paper', 'backdrop', 'panel', 'frame', 'balloon']);
  });

  it('leaves out an empty raster, one whose picture is gone, and the masks', async () => {
    const page = emptyPage(1);
    const mask = { ...raster('m', 'Mask', [{ kind: 'stroke', id: 'm1', tool: 'brush', color: black, width: 9, points: [1, 1], clip: null }]), type: 'inpaint', color: black, fill: 'solid', denoiseLimit: null, noiseLevel: null } as CanvasEntity;
    const gone = raster('gone', 'Gone', [{ kind: 'image', id: 'g', url: '', imageName: 'gone.png', x: 0, y: 0, width: 5, height: 5 }]);
    page.canvas = { ...page.canvas, entities: [...page.canvas.entities, raster('empty', 'Empty', []), gone, mask] };
    const ready = await preparePage(page, (name) => (name === 'gone.png' ? undefined : urlOf(name)));
    expect(pageGroups(ready).map((g) => [g.layer?.id ?? null, g.parts.length])).toEqual([
      [null, 2],
      ['panels', 2],
      ['balloons', 0],
      ['empty', 0],
      ['gone', 0],
    ]);
  });
});

describe('drawing the layers', () => {
  it('lays a raster over the page from a canvas of its own, its eraser kept on that canvas', async () => {
    const main = canvases.of(drawPage(await prepared(samplePage())));
    const own = canvases.all.filter((r) => r !== main);
    // The eraser cuts the layer's own canvas, and the page's canvas never erases.
    expect(own.some((r) => r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'destination-out'))).toBe(true);
    expect(main.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).not.toContain('destination-out');
    expect(main.of('drawImage').some(([source]) => (source as HTMLCanvasElement).tagName === 'CANVAS')).toBe(true);
  });

  it('lays a faded or blended layer over the page with its opacity and blend, a slot too', async () => {
    const faded = withCanvas(withCanvas(samplePage(), look('sky', { opacity: 0.25, blend: 'multiply' })), look('panels', { opacity: 0.5 }));
    const main = canvases.of(drawPage(await prepared(faded)));
    const sets = main.sets.map((s) => `${s.name}=${String(s.value)}`);
    expect(sets).toContain('globalAlpha=0.25');
    expect(sets).toContain('globalCompositeOperation=multiply');
    expect(sets).toContain('globalAlpha=0.5');
  });

  it('draws the plain slots straight onto the page', async () => {
    const main = canvases.of(drawPage(await prepared(emptyPage(1))));
    expect(main.sets.some((s) => s.name === 'globalAlpha')).toBe(false);
    expect(canvases.all).toHaveLength(1);
  });
});

describe('the layers of the PSD', () => {
  it('follow the stack, named by the layer, with its opacity, blend and visibility, and leave the masks out', async () => {
    const looked = withCanvas(withCanvas(samplePage(), look('ink', { opacity: 0.5, blend: 'screen' })), look('sky', { isEnabled: false }));
    const ready = await prepared(looked);
    const layers = pageLayers(ready);
    expect(layers.map((l) => l.name)).toEqual(['Paper', 'Panel 1', 'Frames', 'Balloon 1-1: Hi', 'Ink', 'Sky']);
    expect(layers[4]!.look).toEqual({ opacity: 0.5, hidden: false, blend: 'screen' });
    expect(layers[5]!.look).toEqual({ opacity: 1, hidden: true, blend: 'normal' });
    const doc = buildPagePsd(ready, 'none');
    expect(doc.layers.map((l) => [l.name, l.opacity, l.hidden, l.blend])).toEqual([
      ['Paper', undefined, undefined, undefined],
      ['Panel 1', 1, false, 'normal'],
      ['Frames', 1, false, 'normal'],
      ['Balloon 1-1: Hi', 1, false, 'normal'],
      ['Ink', 0.5, false, 'screen'],
      ['Sky', 1, true, 'normal'],
    ]);
  });

  it('names a raster without a name by its number', async () => {
    const page = samplePage();
    const unnamed = withCanvas(page, look('ink', { name: null }));
    expect(pageLayers(await prepared(unnamed)).map((l) => l.name)).toContain('Raster Layer 3');
  });
});
