// Painting on a comic page: starting chooses a raster layer of the user (a new one when the page has none), lets go of the
// panel choice and the cut tool and chooses it; stopping lets go of the painted layer, so choosing it again
// starts painting again; a choice in the layers follows the mode (a raster of the user paints, a slot goes back).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSlot } from '../canvas';
import { newProject } from './document';
import { pageCanvasStore, resetPageCanvases } from './pageCanvas';
import { followLayerChoice, startPainting, stopPainting, usePagePaint } from './paintMode';
import { activePage, useComic } from './store';

const page = () => activePage(useComic.getState())!;
const store = () => pageCanvasStore(page().id)!;
const userLayers = () => store().getState().entities.filter((e) => e.type === 'raster' && !isSlot(e));

beforeEach(() => {
  resetPageCanvases();
  usePagePaint.setState({ painting: false });
  useComic.getState().setProjects([newProject('Paint')]);
});
afterEach(() => resetPageCanvases());

describe('starting to paint', () => {
  it('adds a raster layer to a page without one, and chooses it', () => {
    useComic.getState().selectPanel(page().panels[0]!.id);
    useComic.getState().setCutting(true);
    expect(startPainting(page().id)).toBe(true);
    expect(usePagePaint.getState().painting).toBe(true);
    expect(userLayers()).toHaveLength(1);
    expect(store().getState().selectedEntityId).toBe(userLayers()[0]!.id);
    expect(useComic.getState().selectedPanelId).toBeNull();
    expect(useComic.getState().cutting).toBe(false);
  });

  it('chooses the top raster of the user when a slot is chosen, and keeps a chosen raster', () => {
    const s = store().getState();
    const low = s.addEntity('raster');
    const high = s.addEntity('raster');
    s.select('panels');
    startPainting(page().id);
    expect(store().getState().selectedEntityId).toBe(high);
    stopPainting(page().id);
    store().getState().select(low);
    startPainting(page().id);
    expect(store().getState().selectedEntityId).toBe(low);
    expect(userLayers()).toHaveLength(2);
  });

  it('does nothing for a page that is gone', () => {
    expect(startPainting('missing')).toBe(false);
    expect(usePagePaint.getState().painting).toBe(false);
  });
});

describe('stopping', () => {
  it('lets go of the painted layer, and of nothing when not painting', () => {
    startPainting(page().id);
    stopPainting(page().id);
    expect(usePagePaint.getState().painting).toBe(false);
    expect(store().getState().selectedEntityId).toBeNull();
    const id = userLayers()[0]!.id;
    store().getState().select(id);
    stopPainting(page().id);
    expect(store().getState().selectedEntityId).toBe(id);
  });
});

describe('following the layer choice', () => {
  it('starts painting on a raster of the user and goes back to the page on a slot', () => {
    const id = store().getState().addEntity('raster');
    followLayerChoice(page().id, id);
    expect(usePagePaint.getState().painting).toBe(true);
    followLayerChoice(page().id, id);
    expect(usePagePaint.getState().painting).toBe(true);
    store().getState().select('balloons');
    followLayerChoice(page().id, 'balloons');
    expect(usePagePaint.getState().painting).toBe(false);
    // A slot stays chosen; nothing else changes.
    expect(store().getState().selectedEntityId).toBe('balloons');
    followLayerChoice(page().id, null);
    expect(usePagePaint.getState().painting).toBe(false);
  });
});
