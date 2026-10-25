import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { useCanvas, type ImageObject, type StrokeObject } from './canvas';
import { parseCanvas, restoreAndWatchCanvas, serializeCanvas } from './canvasPersistence';
import { useGallery } from './gallery';

const initialCanvas = useCanvas.getState();
const initialGallery = useGallery.getState();

const image = (name: string): ImageDTO =>
  ({ name, url: `asset://${name}`, thumbnailUrl: `asset://${name}`, width: 64, height: 64, isIntermediate: true, category: 'general', boardId: null }) as unknown as ImageDTO;
const stroke: StrokeObject = { kind: 'stroke', id: 's1', tool: 'brush', color: { r: 1, g: 2, b: 3, a: 1 }, width: 4, points: [0, 0, 5, 5], clip: null };
const picture = (url: string, imageName: string | null): ImageObject => ({ kind: 'image', id: 'i1', url, imageName, x: 0, y: 0, width: 64, height: 64 });

beforeEach(() => {
  useCanvas.setState(initialCanvas, true);
  useGallery.setState(initialGallery, true);
});
afterEach(() => vi.restoreAllMocks());

describe('serializeCanvas', () => {
  it('stores a page-only picture once as a hidden image and keeps only its name in the document', async () => {
    const store = vi.spyOn(backend, 'saveImageFromUrl').mockResolvedValue(image('layer-1.png'));
    const id = useCanvas.getState().addEntity('raster', { objects: [stroke, picture('blob:x', null)] });
    const doc = JSON.parse(await serializeCanvas());
    expect(store).toHaveBeenCalledWith('blob:x', { boardId: null, isIntermediate: true, category: 'general' });
    expect(doc.entities[0].objects[1]).toMatchObject({ kind: 'image', imageName: 'layer-1.png', url: '' });
    // The live layer now points at the stored picture, so another save uploads nothing.
    expect(useCanvas.getState().entities.find((e) => e.id === id)?.objects[1]).toMatchObject({ url: 'asset://layer-1.png', imageName: 'layer-1.png' });
    await serializeCanvas();
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('leaves out a picture that cannot be stored and still saves the rest', async () => {
    vi.spyOn(backend, 'saveImageFromUrl').mockRejectedValue(new Error('disk full'));
    useCanvas.getState().addEntity('raster', { objects: [stroke, picture('blob:y', null)] });
    const doc = JSON.parse(await serializeCanvas());
    expect(doc.entities[0].objects).toHaveLength(1);
  });
});

describe('restoring', () => {
  it('looks pictures up by name, drops the ones whose image is gone and ignores damaged parts', () => {
    useGallery.setState({ images: [image('here.png')] });
    const text = JSON.stringify({
      version: 1,
      bbox: { x: 0, y: 0, width: 512, height: 512 },
      selectedEntityId: 'e1',
      groupHidden: { inpaint: true },
      entities: [
        { id: 'e1', type: 'raster', objects: [stroke, picture('', 'here.png'), { ...picture('', 'gone.png'), id: 'i2' }, { kind: 'bogus', id: 'x' }] },
        { id: 'e2', type: 'unknown', objects: [] },
        'junk',
      ],
    });
    const doc = parseCanvas(text)!;
    expect(doc.entities).toHaveLength(1);
    expect(doc.entities[0]!.objects.map((o) => o.id)).toEqual(['s1', 'i1']);
    expect(doc.entities[0]!.objects[1]).toMatchObject({ url: 'asset://here.png' });
    expect(doc.selectedEntityId).toBe('e1');
    expect(doc.groupHidden.inpaint).toBe(true);
  });

  it('refuses text that is not a canvas document', () => {
    expect(parseCanvas('not json')).toBeNull();
    expect(parseCanvas('{"version":2,"entities":[],"bbox":{"x":0,"y":0,"width":1,"height":1}}')).toBeNull();
    expect(parseCanvas('{"version":1,"entities":[]}')).toBeNull();
  });

  it('does not start saving when the saved document cannot be read, so it is not overwritten', async () => {
    vi.useFakeTimers();
    vi.spyOn(backend, 'loadCanvas').mockRejectedValue(new Error('locked'));
    const save = vi.spyOn(backend, 'saveCanvas');
    await restoreAndWatchCanvas();
    useCanvas.getState().addEntity('raster');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('restores the saved layers, then saves once after a change (debounced)', async () => {
    vi.useFakeTimers();
    vi.spyOn(backend, 'loadCanvas').mockResolvedValue(
      JSON.stringify({ version: 1, bbox: { x: 0, y: 0, width: 256, height: 256 }, entities: [{ id: 'e1', type: 'raster', objects: [stroke] }] }),
    );
    const save = vi.spyOn(backend, 'saveCanvas').mockResolvedValue();
    await restoreAndWatchCanvas();
    expect(useCanvas.getState().entities.map((e) => e.id)).toEqual(['e1']);
    expect(useCanvas.getState().past).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
    useCanvas.getState().addEntity('inpaint');
    useCanvas.getState().addEntity('inpaint');
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.mock.calls[0]![0]).entities).toHaveLength(3);
    vi.useRealTimers();
  });
});
