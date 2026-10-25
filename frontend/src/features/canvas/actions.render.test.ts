// @vitest-environment jsdom
// The canvas commands that flatten layers into a picture: save, merge, copy, hand out and filter. Drawing goes to
// recorded canvases, so these check what is saved and reported, not pixels.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { useCanvas, type CanvasEntity } from '@/state/canvas';
import { newProject } from '@/state/comic/document';
import { pageCanvasStore, resetPageCanvases } from '@/state/comic/pageCanvas';
import { activePage, useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { t } from '@/i18n';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { applyRasterFilter, bucketFill, copyEntityToClipboard, entityAsGalleryImage, exportEntityToFile, mergeVisible, processFilter, saveCanvasAsPsd, saveCanvasToGallery, saveEntityToGallery, transformEntity, pasteImageBlob, invertMask, fillPolygon } from './actions';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), toasts: useToasts.getState() };
const c = () => useCanvas.getState();
const lastToast = () => useToasts.getState().toasts.at(-1);
const saved = { name: 'saved.png', url: 'blob:saved', thumbnailUrl: 'blob:t', width: 10, height: 10, isIntermediate: false } as ImageDTO;
const red = { r: 255, g: 0, b: 0, a: 1 };
const rect = (x = 0) => ({ kind: 'rect' as const, id: `r${x}`, x, y: 0, width: 20, height: 20, color: red });

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState(initial.gallery, true);
  useToasts.setState(initial.toasts, true);
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };
  URL.createObjectURL = () => 'blob:flat';
  vi.spyOn(backend, 'saveImageFromUrl').mockResolvedValue(saved);
});
afterEach(() => {
  canvases.restore();
  vi.restoreAllMocks();
});

function layer(type: 'raster' | 'control' = 'raster', objects = [rect()]): string {
  return c().addEntity(type, { objects });
}

describe('exporting a layer to a file', () => {
  it('downloads the flattened layer as a png and tells the user', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.revokeObjectURL = () => {};
    await exportEntityToFile(layer());
    expect(click).toHaveBeenCalledOnce();
    expect(backend.saveImageFromUrl).not.toHaveBeenCalled();
    expect(lastToast()?.status).toBe('success');
  });

  it('warns when the layer is empty and downloads nothing', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportEntityToFile(layer('raster', []));
    expect(click).not.toHaveBeenCalled();
    expect(lastToast()?.status).toBe('warning');
  });

  it('reports a failure to render', async () => {
    URL.createObjectURL = () => {
      throw new Error('no memory');
    };
    await exportEntityToFile(layer());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'no memory' });
  });
});

describe('saving the canvas as a PSD', () => {
  it('downloads a layered PSD of the bounding box named after the canvas and tells the user', async () => {
    let saved: Blob | null = null;
    URL.createObjectURL = (blob: Blob) => ((saved = blob), 'blob:psd');
    URL.revokeObjectURL = () => {};
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/\.psd$/);
    });
    useCanvas.setState({ bbox: { x: 0, y: 0, width: 8, height: 8 } });
    layer();
    await saveCanvasAsPsd();
    expect(click).toHaveBeenCalledOnce();
    const bytes = new Uint8Array(await saved!.arrayBuffer());
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('8BPS');
    expect(backend.saveImageFromUrl).not.toHaveBeenCalled();
    expect(lastToast()?.status).toBe('success');
  });

  it('reports a canvas too large for a PSD', async () => {
    useCanvas.setState({ bbox: { x: 0, y: 0, width: 30001, height: 1 } });
    await saveCanvasAsPsd();
    expect(lastToast()?.status).toBe('error');
  });
});

describe('saving the canvas', () => {
  it('flattens the visible raster layers, saves them and tells the user', async () => {
    layer();
    await saveCanvasToGallery();
    expect(backend.saveImageFromUrl).toHaveBeenCalledWith('blob:flat', expect.any(Object));
    expect(useGallery.getState().images[0]?.name).toBe('saved.png');
    expect(lastToast()?.status).toBe('success');
  });

  it('reports a failure to save', async () => {
    vi.mocked(backend.saveImageFromUrl).mockRejectedValue(new Error('disk full'));
    await saveCanvasToGallery();
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
  });

  it('saves one layer, or warns that an empty layer has nothing to save', async () => {
    const id = layer();
    await saveEntityToGallery(id);
    expect(lastToast()?.status).toBe('success');
    const empty = layer('raster', []);
    await saveEntityToGallery(empty);
    expect(lastToast()?.status).toBe('warning');
    vi.mocked(backend.saveImageFromUrl).mockRejectedValue('nope');
    await saveEntityToGallery(id);
    expect(lastToast()).toMatchObject({ status: 'error', description: 'nope' });
  });
});

describe('merging', () => {
  it('replaces the visible raster layers by one layer holding their flattened picture', async () => {
    layer('raster', [rect(0)]);
    layer('raster', [rect(40)]);
    const control = layer('control');
    await mergeVisible();
    const types = c().entities.map((e) => e.type);
    expect(types.sort()).toEqual(['control', 'raster']);
    expect(c().entities.find((e) => e.id === control)).toBeTruthy();
    const merged = c().entities.find((e) => e.type === 'raster')!;
    expect(merged.objects[0]).toMatchObject({ kind: 'image', url: 'blob:flat', x: 0, width: 60 });
    expect(lastToast()?.status).toBe('success');
  });

  it('never merges a slot: the layers between two slots are merged on their own and stay between them', async () => {
    const low = [layer('raster', [rect(0)]), layer('raster', [rect(40)])];
    const panels = c().addEntity('raster', { slot: 'panels' });
    const lone = layer('raster', [rect(80)]);
    const balloons = c().addEntity('raster', { slot: 'balloons' });
    const high = [layer('raster', [rect(0)]), layer('raster', [rect(20)])];
    await mergeVisible();
    const order = c().entities.map((e) => e.id);
    expect(order).toHaveLength(5);
    expect(order.slice(1)).toEqual([panels, lone, balloons, order[4]]);
    for (const id of [...low, ...high]) expect(order).not.toContain(id);
    expect(c().entities[0]!.objects[0]).toMatchObject({ kind: 'image', x: 0, width: 60 });
    expect(c().entities[4]!.objects[0]).toMatchObject({ kind: 'image', x: 0, width: 40 });
    expect(lastToast()?.status).toBe('success');
  });

  it('merges on a full comic page: the bands between its slots on their own, hidden layers left, and room kept', async () => {
    resetPageCanvases();
    useComic.getState().setProjects([newProject('Merge')]);
    const store = pageCanvasStore(activePage(useComic.getState())!.id)!;
    const s = () => store.getState();
    const add = (objects = [rect()], under?: string) => s().addEntity('raster', { objects }, under ? { under } : undefined);
    // Down to up: two + a hidden one under the panels, one between the slots, then fill the top up to the limit.
    const low = [add([rect(0)], 'panels'), add([rect(40)], 'panels')];
    const hidden = add([rect(80)], 'panels');
    s().updateEntity(hidden, { isEnabled: false });
    const lone = add([rect(0)], 'balloons');
    while (s().entities.length < 32) add();
    expect(s().entities).toHaveLength(32);
    await mergeVisible(store);
    const ids = s().entities.map((e) => e.id);
    expect(ids).toContain(hidden);
    expect(ids).toContain(lone);
    for (const id of low) expect(ids).not.toContain(id);
    // The merged bottom layer sits under the panels slot, the hidden one stays beside it, the slots keep their order.
    expect(ids.indexOf('panels')).toBeLessThan(ids.indexOf(lone));
    expect(ids.indexOf(lone)).toBeLessThan(ids.indexOf('balloons'));
    const merged = s().entities.find((e) => e.objects[0]?.kind === 'image')!;
    expect(ids.indexOf(merged.id)).toBeLessThan(ids.indexOf('panels'));
    expect(s().entities.length).toBeLessThan(32);
    resetPageCanvases();
  });

  it('has nothing to merge when no two visible layers share a band between slots', async () => {
    layer('raster', [rect(0)]);
    c().addEntity('raster', { slot: 'panels' });
    layer('raster', [rect(40)]);
    const before = c().entities;
    await mergeVisible();
    expect(c().entities).toBe(before);
    expect(lastToast()?.status).toBe('info');
  });

  it('reports a failure while flattening', async () => {
    layer('raster', [rect(0)]);
    layer('raster', [rect(40)]);
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    await mergeVisible();
    expect(lastToast()?.status).toBe('error');
    expect(c().entities).toHaveLength(2);
  });
});

describe('handing out and copying a layer', () => {
  it('saves a flattened layer and returns its image name; an empty layer or a failure gives null', async () => {
    const id = layer();
    expect(await entityAsGalleryImage(id)).toBe('saved.png');
    expect(await entityAsGalleryImage('missing')).toBeNull();
    expect(await entityAsGalleryImage(layer('raster', []))).toBeNull();
    expect(lastToast()?.status).toBe('warning');
    vi.mocked(backend.saveImageFromUrl).mockRejectedValue(new Error('boom'));
    expect(await entityAsGalleryImage(id)).toBeNull();
    expect(lastToast()?.status).toBe('error');
  });

  it('copies the layer to the clipboard as a PNG', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class { constructor(public items: unknown) {} });
    vi.stubGlobal('navigator', { clipboard: { write } });
    await copyEntityToClipboard(layer());
    expect(write).toHaveBeenCalledTimes(1);
    expect(lastToast()?.status).toBe('success');
    await copyEntityToClipboard('missing');
    expect(write).toHaveBeenCalledTimes(1);
    await copyEntityToClipboard(layer('raster', []));
    expect(lastToast()?.status).toBe('warning');
    write.mockRejectedValue(new Error('denied'));
    await copyEntityToClipboard(layer());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'denied' });
    vi.unstubAllGlobals();
  });

  it('says so when the browser cannot copy pictures', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    await copyEntityToClipboard(layer());
    expect(lastToast()?.status).toBe('error');
    vi.unstubAllGlobals();
  });
});

describe('control filters', () => {
  const control = (filter: 'none' | 'canny', objects = [rect()]): string => {
    const id = layer('control', objects);
    c().updateEntity(id, { filter });
    return id;
  };

  it('previews the filtered picture of a control layer', async () => {
    const id = control('canny');
    await processFilter(id);
    expect(c().filterPreviews[id]).toMatchObject({ url: 'blob:flat', width: 20, height: 20 });
  });

  it('drops the preview for the "none" filter, ignores other layers and warns about an empty layer', async () => {
    const id = control('none');
    c().setFilterPreview(id, { url: 'x', x: 0, y: 0, width: 1, height: 1 });
    await processFilter(id);
    expect(c().filterPreviews[id]).toBeUndefined();
    await processFilter('missing');
    await processFilter(layer('raster'));
    const empty = control('canny', []);
    await processFilter(empty);
    expect(lastToast()?.status).toBe('warning');
    expect(c().filterPreviews[empty]).toBeUndefined();
    const all: CanvasEntity[] = c().entities;
    expect(all.length).toBeGreaterThan(2);
  });
});

describe('transforming a layer', () => {
  it('turns a raster layer into one picture with swapped sides around the same centre', async () => {
    const id = layer('raster', [{ ...rect(0), width: 40 }]);
    await transformEntity(id, 'rotateRight');
    expect(c().entities[0]!.objects).toEqual([expect.objectContaining({ kind: 'image', url: 'blob:flat', x: 10, y: -10, width: 20, height: 40 })]);
    await transformEntity(id, 'scaleDown');
    expect(c().entities[0]!.objects[0]).toMatchObject({ width: 10, height: 20 });
  });

  it('leaves masks, locked layers and empty layers alone and refuses a size beyond the limit', async () => {
    const mask = c().addEntity('inpaint', { objects: [rect()] });
    const locked = layer();
    c().updateEntity(locked, { isLocked: true });
    const empty = layer('raster', []);
    for (const id of [mask, locked, empty]) await transformEntity(id, 'scaleUp');
    expect(c().entities.find((e) => e.id === mask)!.objects[0]).toMatchObject({ kind: 'rect' });
    expect(c().entities.find((e) => e.id === locked)!.objects[0]).toMatchObject({ kind: 'rect' });
    expect(lastToast()?.status).toBe('warning');
    const big = layer('raster', [{ ...rect(0), width: 5000 }]);
    await transformEntity(big, 'scaleUp');
    expect(c().entities.find((e) => e.id === big)!.objects[0]).toMatchObject({ kind: 'rect' });
  });

  it('leaves a slot alone, without a warning', async () => {
    const slot = c().addEntity('raster', { slot: 'panels' });
    const before = c().entities;
    await transformEntity(slot, 'rotateRight');
    expect(c().entities).toBe(before);
    expect(lastToast()).toBeUndefined();
  });
});

describe('pasting a picture', () => {
  it('saves it to the gallery and adds it as a raster layer', async () => {
    URL.createObjectURL = () => 'blob:pasted';
    await pasteImageBlob(new Blob(['png'], { type: 'image/png' }));
    expect(backend.saveImageFromUrl).toHaveBeenCalledWith('blob:pasted', expect.any(Object));
    expect(c().entities[0]).toMatchObject({ type: 'raster', objects: [{ kind: 'image', imageName: 'saved.png' }] });
  });

  it('reports a failure', async () => {
    vi.mocked(backend.saveImageFromUrl).mockRejectedValue(new Error('bad'));
    await pasteImageBlob(new Blob(['x']));
    expect(lastToast()).toMatchObject({ status: 'error', description: 'bad' });
    expect(c().entities).toEqual([]);
  });
});

describe('inverting a mask', () => {
  it('redraws a mask as one picture the size of the generation area, and leaves other layers alone', async () => {
    c().setBbox({ x: 8, y: 16, width: 64, height: 64 });
    const mask = c().addEntity('inpaint', { objects: [rect()] });
    const raster = layer();
    await invertMask(mask);
    await invertMask(raster);
    expect(c().entities.find((e) => e.id === mask)!.objects).toEqual([expect.objectContaining({ kind: 'image', url: 'blob:flat', x: 8, y: 16, width: 64, height: 64 })]);
    expect(c().entities.find((e) => e.id === raster)!.objects[0]).toMatchObject({ kind: 'rect' });
  });
});

describe('filling a lasso shape', () => {
  it('adds the shape as a picture covering its outline', async () => {
    const id = layer('raster', []);
    await fillPolygon(id, [10.5, 4, 30, 4, 20, 24.2]);
    expect(c().entities[0]!.objects).toEqual([expect.objectContaining({ kind: 'image', url: 'blob:flat', x: 10, y: 4, width: 20, height: 21 })]);
  });

  it('ignores a scribble that is not a shape', async () => {
    const id = layer('raster', []);
    await fillPolygon(id, [5, 5, 9, 9]);
    await fillPolygon(id, [5, 5, 9, 5, 12, 5]);
    expect(c().entities[0]!.objects).toEqual([]);
  });

  it('puts nothing into a slot', async () => {
    const slot = c().addEntity('raster', { slot: 'panels' });
    await fillPolygon(slot, [10, 4, 30, 4, 20, 24]);
    expect(c().entities[0]!.objects).toEqual([]);
  });
});

describe('raster filters and the bucket', () => {
  const objectsOf = (id: string) => c().entities.find((e) => e.id === id)!.objects;
  const warned = () => useToasts.getState().toasts.some((x) => x.status === 'warning');

  it('blurs a raster layer into one picture larger by the blur margin, as one undo step', async () => {
    const id = layer('raster', [rect(10)]);
    const before = c().past.length;
    expect(await applyRasterFilter(id, { kind: 'blur', radius: 4 })).toBe(true);
    const [only] = objectsOf(id);
    expect(objectsOf(id)).toHaveLength(1);
    // The layer drew 20 x 20 at (10, 0); the picture grows by 12 px (three times the radius) on every side.
    expect(only).toMatchObject({ kind: 'image', url: 'blob:flat', imageName: null, x: -2, y: -12, width: 44, height: 44 });
    expect(c().past.length).toBe(before + 1);
    c().undo();
    expect(objectsOf(id)).toEqual([rect(10)]);
  });

  it('keeps the size of the layer for grayscale and invert', async () => {
    const id = layer('raster', [rect(10)]);
    await applyRasterFilter(id, { kind: 'grayscale' });
    expect(objectsOf(id)[0]).toMatchObject({ x: 10, y: 0, width: 20, height: 20 });
    await applyRasterFilter(id, { kind: 'invert' });
    expect(objectsOf(id)[0]).toMatchObject({ x: 10, y: 0, width: 20, height: 20 });
    const filters = canvases.all.flatMap((r) => r.sets).filter((s) => s.name === 'filter').map((s) => s.value);
    expect(filters).toContain('grayscale(1)');
    expect(filters).toContain('invert(1)');
  });

  it('refuses what is not a raster layer of the user: a control layer, a locked layer, an empty layer, a slot', async () => {
    const control = layer('control');
    expect(await applyRasterFilter(control, { kind: 'invert' })).toBe(false);
    expect(warned()).toBe(true);
    const locked = layer();
    c().updateEntity(locked, { isLocked: true });
    expect(await applyRasterFilter(locked, { kind: 'invert' })).toBe(false);
    const empty = layer('raster', []);
    expect(await applyRasterFilter(empty, { kind: 'invert' })).toBe(false);
    expect(lastToast()?.title).toBe(t('canvas.toast.entityEmpty'));
    expect(await applyRasterFilter(null, { kind: 'invert' })).toBe(false);
  });

  it('fills the region around the pressed point up to a line, one pixel under it, and keeps the layer as one picture', async () => {
    canvases.restore();
    // A black vertical line at x = 10 on a clear layer 40 x 30.
    canvases = installRecordingCanvases({ pixel: (x) => (x === 10 ? [0, 0, 0, 255] : [0, 0, 0, 0]) });
    const id = layer('raster', [rect(10)]);
    c().setFillColor({ r: 10, g: 20, b: 30, a: 1 });
    expect(await bucketFill(id, { x: 3, y: 5 }, { x: 0, y: 0, width: 40, height: 30 })).toBe(true);
    const [only] = objectsOf(id);
    expect(objectsOf(id)).toHaveLength(1);
    // The fill covers x 0 to 10 (the region and the line's pixel), the whole height; the layer drew x 10 to 30.
    expect(only).toMatchObject({ kind: 'image', x: 0, y: 0, width: 30, height: 30 });
    const put = canvases.all.flatMap((r) => r.of('putImageData')).map((a) => a[0] as ImageData);
    const filled = put.find((d) => d.width === 11 && d.height === 30)!;
    expect(filled).toBeDefined();
    let painted = 0;
    for (let i = 0; i < filled.data.length; i += 4) {
      if (filled.data[i + 3] === 255) {
        painted++;
        expect([filled.data[i], filled.data[i + 1], filled.data[i + 2]]).toEqual([10, 20, 30]);
      }
    }
    expect(painted).toBe(11 * 30);
  });

  it('fills nothing outside the area, and nothing for a layer that cannot be filled', async () => {
    const id = layer();
    expect(await bucketFill(id, { x: 500, y: 5 }, { x: 0, y: 0, width: 40, height: 30 })).toBe(false);
    expect(objectsOf(id)).toEqual([rect()]);
    expect(await bucketFill(layer('control'), { x: 1, y: 1 }, { x: 0, y: 0, width: 40, height: 30 })).toBe(false);
  });

  it('works on a comic page store with the page as its area', async () => {
    useComic.getState().setProjects([newProject('Fill')]);
    const store = pageCanvasStore(activePage(useComic.getState())!.id)!;
    const id = store.getState().addEntity('raster');
    expect(await bucketFill(id, { x: 100, y: 100 }, { x: 0, y: 0, width: 1654, height: 2339 }, store)).toBe(true);
    expect(store.getState().entities.find((e) => e.id === id)!.objects).toHaveLength(1);
    expect(c().entities).toEqual([]);
    resetPageCanvases();
  });
});
