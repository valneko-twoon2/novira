import { beforeEach, describe, expect, it } from 'vitest';
import { createCanvasStore, useCanvas } from '@/state/canvas';
import { useParams } from '@/state/params';
import { fitBbox, fitBboxOnce, fitBboxToLayers, resetView, setStageSize, zoomStep, zoomTo } from './view';

const initialCanvas = useCanvas.getState();
const initialParams = useParams.getState();
const c = () => useCanvas.getState();

beforeEach(() => {
  useParams.setState(initialParams, true);
  useCanvas.setState(initialCanvas, true);
  setStageSize(800, 600);
});

/** The document point shown at the middle of the stage. */
const centerDoc = () => {
  const v = c().viewport;
  return { x: (400 - v.x) / v.scale, y: (300 - v.y) / v.scale };
};

describe('canvas viewport commands', () => {
  it('zooms to a scale around the middle of the stage', () => {
    const before = centerDoc();
    zoomTo(2);
    expect(c().viewport.scale).toBeCloseTo(2);
    expect(centerDoc().x).toBeCloseTo(before.x);
    expect(centerDoc().y).toBeCloseTo(before.y);
  });

  it('steps zoom in and out and keeps the middle of the stage fixed', () => {
    const before = centerDoc();
    const start = c().viewport.scale;
    zoomStep(1);
    expect(c().viewport.scale).toBeGreaterThan(start);
    zoomStep(-1);
    zoomStep(-1);
    expect(c().viewport.scale).toBeLessThan(start);
    expect(centerDoc().x).toBeCloseTo(before.x);
    expect(centerDoc().y).toBeCloseTo(before.y);
  });

  it('uses the stage size it was given when fitting the bbox', () => {
    const { width, height } = c().bbox;
    setStageSize(200, 100);
    fitBbox();
    const v = c().viewport;
    expect(width * v.scale).toBeLessThanOrEqual(200);
    expect(height * v.scale).toBeLessThanOrEqual(100);
    expect(v.x + (c().bbox.x + width / 2) * v.scale).toBeCloseTo(100);
    expect(v.y + (c().bbox.y + height / 2) * v.scale).toBeCloseTo(50);
  });

  it('resets the view to the bbox when there are no layers', () => {
    zoomTo(4);
    resetView();
    const { width, height } = c().bbox;
    expect(width * c().viewport.scale).toBeLessThanOrEqual(800);
    expect(height * c().viewport.scale).toBeLessThanOrEqual(600);
  });

  it('keeps the bbox when there is no visible layer content to fit it to', () => {
    const before = c().bbox;
    fitBboxToLayers();
    expect(c().bbox).toEqual(before);
  });
});

describe('viewport of another store', () => {
  it('keeps its own stage size and acts only on its own store', () => {
    const page = createCanvasStore({ syncParams: false });
    setStageSize(200, 100, page);
    fitBbox(page);
    const v = page.getState().viewport;
    expect(page.getState().bbox.width * v.scale).toBeLessThanOrEqual(200);
    expect(c().viewport).toEqual(initialCanvas.viewport);
    // The global store still fits into its own 800 x 600 stage.
    fitBbox();
    expect(c().viewport.scale).toBeGreaterThan(v.scale);
  });

  it('fits a store once its stage is large enough, and only the first time', () => {
    const page = createCanvasStore({ syncParams: false });
    setStageSize(40, 40, page);
    fitBboxOnce(page);
    expect(page.getState().viewport).toEqual(initialCanvas.viewport);
    setStageSize(400, 300, page);
    fitBboxOnce(page);
    const fitted = page.getState().viewport;
    expect(fitted).not.toEqual(initialCanvas.viewport);
    page.getState().setViewport({ x: 1, y: 2, scale: 3 });
    fitBboxOnce(page);
    expect(page.getState().viewport).toEqual({ x: 1, y: 2, scale: 3 });
  });
});
