// The assistant and the raster layers of the comic page: the short list it is told, and its layer operations, each
// checked (a wrong number, kind or value is skipped). Layers are no undo steps of the comic, so taking back the
// rest of an answer leaves them as they are.
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { applyComicOps, comicAgentEditor, comicContext } from './agentEditor';
import { newProject } from './document';
import { pageCanvasStore, resetPageCanvases } from './pageCanvas';
import { MAX_RASTERS_PER_PAGE, pageRasters } from './pageCanvasDoc';
import { startPainting, usePagePaint } from './paintMode';
import { activePage, useComic } from './store';

type Context = {
  layers: { layer: number; name: string; kind: string; visible: boolean; locked?: boolean; opacity?: number; blend?: string; objects?: number }[];
  layerState: { painting: boolean; maxLayers: number; layersTotal: number };
};

const layers = () => pageRasters(activePage(useComic.getState())!.canvas);

beforeEach(() => {
  resetPageCanvases();
  usePagePaint.setState({ painting: false });
  setLocale('en');
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, past: [], future: [] });
  useComic.getState().setProjects([newProject('Harbour')]);
});

describe('the layers in the view of the page the assistant is given', () => {
  it('lists the raster layers bottom first with their names, kinds and visibility', () => {
    expect((comicContext() as Context).layers).toEqual([
      { layer: 1, name: 'Panels', kind: 'panels', visible: true },
      { layer: 2, name: 'Balloons', kind: 'balloons', visible: true },
    ]);
  });
});

describe('the layer operations', () => {
  it('adds an empty raster layer on top, named as asked or by its number', () => {
    expect(applyComicOps([{ op: 'addLayer', name: 'Speed lines' }, { op: 'addLayer', kind: 'raster' }])).toBe(true);
    expect((comicContext() as Context).layers.map((l) => [l.kind, l.name])).toEqual([
      ['panels', 'Panels'],
      ['balloons', 'Balloons'],
      ['raster', 'Speed lines'],
      ['raster', 'Raster Layer 4'],
    ]);
  });

  it('skips a layer of another kind and one past the most a page holds', () => {
    expect(applyComicOps([{ op: 'addLayer', kind: 'drawing' }, { op: 'addLayer', kind: 'balloons' }])).toBe(false);
    applyComicOps(Array.from({ length: MAX_RASTERS_PER_PAGE }, () => ({ op: 'addLayer' })));
    expect(layers()).toHaveLength(MAX_RASTERS_PER_PAGE);
  });

  it('hides, locks, fades and renames a layer by its number', () => {
    expect(applyComicOps([{ op: 'layer', layer: 2, visible: false, locked: true, opacity: 0.4, name: 'Words' }])).toBe(true);
    expect(layers()[1]).toMatchObject({ slot: 'balloons', isEnabled: false, isLocked: true, opacity: 0.4, name: 'Words' });
    expect((comicContext() as Context).layers[1]).toEqual({ layer: 2, name: 'Words', kind: 'balloons', visible: false, locked: true, opacity: 0.4 });
  });

  it('skips a layer number that is not on the page and a change that changes nothing, and keeps opacity in range', () => {
    expect(applyComicOps([{ op: 'layer', layer: 0, visible: false }, { op: 'layer', layer: 3, visible: false }, { op: 'layer', layer: 1.5, visible: false }])).toBe(false);
    expect(applyComicOps([{ op: 'layer', layer: 1 }, { op: 'layer', layer: 1, visible: true }, { op: 'layer', layer: 1, visible: 'no' }])).toBe(false);
    applyComicOps([{ op: 'layer', layer: 1, opacity: 5 }, { op: 'addLayer', name: 'Ink' }, { op: 'layer', layer: 3, name: '   ' }]);
    expect(layers()[0]!.opacity).toBe(1);
    expect(layers()[2]!.name).toBe('Ink');
  });

  it('is not taken back with the rest of the answer, which the comic undo brings back', () => {
    const before = comicAgentEditor.snapshot();
    applyComicOps([{ op: 'addLayer' }, { op: 'layer', layer: 1, visible: false }, { op: 'addPanel', panel: null }]);
    const panels = activePage(useComic.getState())!.panels.length;
    comicAgentEditor.restore(before);
    expect(activePage(useComic.getState())!.panels.length).toBe(panels - 1);
    expect(layers().map((l) => [l.slot ?? 'raster', l.isEnabled])).toEqual([
      ['panels', false],
      ['balloons', true],
      ['raster', true],
    ]);
  });
});

describe('blend, order and deleting', () => {
  const names = () => layers().map((l) => l.name ?? l.slot);

  it('sets a blend and tells the objects of a layer of the user', () => {
    applyComicOps([{ op: 'addLayer', name: 'Ink' }, { op: 'layer', layer: 3, blend: 'multiply' }, { op: 'layer', layer: 3, blend: 'burn' }]);
    expect(layers()[2]!.blend).toBe('multiply');
    expect((comicContext() as Context).layers[2]).toEqual({ layer: 3, name: 'Ink', kind: 'raster', visible: true, blend: 'multiply', objects: 0 });
    expect(applyComicOps([{ op: 'layer', layer: 3, blend: 'normal' }])).toBe(true);
    expect(layers()[2]!.blend).toBeUndefined();
  });

  it('moves a layer under the panels, over the balloons and one place, and skips a move that goes nowhere', () => {
    applyComicOps([{ op: 'addLayer', name: 'Ink' }, { op: 'addLayer', name: 'Tone' }]);
    expect(names()).toEqual(['panels', 'balloons', 'Ink', 'Tone']);
    expect(applyComicOps([{ op: 'layer', layer: 3, move: 'bottom' }])).toBe(true);
    expect(names()).toEqual(['Ink', 'panels', 'balloons', 'Tone']);
    expect(applyComicOps([{ op: 'layer', layer: 1, move: 'down' }, { op: 'layer', layer: 1, move: 'sideways' }])).toBe(false);
    expect(applyComicOps([{ op: 'layer', layer: 1, move: 'up' }])).toBe(true);
    expect(names()).toEqual(['panels', 'Ink', 'balloons', 'Tone']);
    expect(applyComicOps([{ op: 'layer', layer: 1, move: 'top' }])).toBe(true);
    expect(names()).toEqual(['Ink', 'balloons', 'Tone', 'panels']);
  });

  it('deletes a layer of the user that is not locked, never a slot', () => {
    applyComicOps([{ op: 'addLayer', name: 'Ink' }, { op: 'addLayer', name: 'Tone' }, { op: 'layer', layer: 4, locked: true }]);
    expect(applyComicOps([{ op: 'deleteLayer', layer: 1 }, { op: 'deleteLayer', layer: 2 }, { op: 'deleteLayer', layer: 4 }, { op: 'deleteLayer', layer: 9 }])).toBe(false);
    expect(layers()).toHaveLength(4);
    expect(applyComicOps([{ op: 'deleteLayer', layer: 3 }])).toBe(true);
    expect(names()).toEqual(['panels', 'balloons', 'Tone']);
  });

  it('tells whether the page is being painted on and how many layers it holds', () => {
    expect((comicContext() as Context).layerState).toEqual({ painting: false, maxLayers: MAX_RASTERS_PER_PAGE, layersTotal: 2 });
    startPainting(activePage(useComic.getState())!.id);
    expect((comicContext() as Context).layerState).toEqual({ painting: true, maxLayers: MAX_RASTERS_PER_PAGE, layersTotal: 3 });
  });

  it('writes what the user painted first, reseeds the page store and clears its undo history', () => {
    const id = activePage(useComic.getState())!.id;
    startPainting(id);
    const store = pageCanvasStore(id)!;
    const painted = store.getState().selectedEntityId!;
    store.getState().addObject(painted, { kind: 'rect', id: 'r1', x: 1, y: 1, width: 5, height: 5, color: { r: 0, g: 0, b: 0, a: 1 } });
    store.getState().addObject(painted, { kind: 'rect', id: 'r2', x: 1, y: 1, width: 5, height: 5, color: { r: 0, g: 0, b: 0, a: 1 } });
    expect(store.getState().past.length).toBeGreaterThan(0);
    applyComicOps([{ op: 'addLayer', name: 'Tone' }]);
    // The strokes are in the page, the store holds the new layer too, and its history is cleared.
    expect(layers().find((l) => l.id === painted)!.objects).toHaveLength(2);
    expect(store.getState().entities.map((e) => e.name)).toContain('Tone');
    expect(store.getState().past).toHaveLength(0);
    expect(usePagePaint.getState().painting).toBe(true);
  });

  it('leaves painting when the painted layer is deleted', () => {
    const id = activePage(useComic.getState())!.id;
    startPainting(id);
    expect(applyComicOps([{ op: 'deleteLayer', layer: 3 }])).toBe(true);
    expect(usePagePaint.getState().painting).toBe(false);
    expect(layers()).toHaveLength(2);
  });
});
