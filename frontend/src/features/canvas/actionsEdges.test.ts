// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { useCanvas } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useUi } from '@/state/ui';
import { importImage, saveStagedToGallery } from './actions';

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), ui: useUi.getState() };
const c = () => useCanvas.getState();

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 640, height: 320, isIntermediate: false, ...over }) as ImageDTO;

beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState(initial.gallery, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => vi.restoreAllMocks());

describe('importing a picture as a new canvas', () => {
  it('replaces the canvas by one raster layer and a bbox the size of the picture', () => {
    c().addEntity('inpaint');
    importImage(image('a'), 'newCanvasRaster');
    expect(c().entities.map((e) => e.type)).toEqual(['raster']);
    expect(c().bbox).toMatchObject({ x: 0, y: 0, width: 640, height: 320 });
    expect(c().entities[0]!.objects[0]).toMatchObject({ kind: 'image', imageName: 'a' });
  });
});

describe('saving the staged picture without one', () => {
  it('does nothing when no picture is staged', async () => {
    const update = vi.spyOn(backend, 'updateImages');
    await saveStagedToGallery();
    expect(update).not.toHaveBeenCalled();
  });
});
