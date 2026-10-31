// @vitest-environment jsdom
// Baking one turned picture: it is drawn turned and mirrored on a canvas, stored as a hidden gallery picture, and the
// temporary address of the drawing is let go whether or not storing worked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { backend, loadImage, type ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { bakeOne } from './bakeRotation';
import type { ProjectBake } from './document';

vi.mock('@/backend', async (original) => ({ ...(await original<typeof import('@/backend')>()), loadImage: vi.fn() }));

const bake = (extra: Partial<ProjectBake> = {}): ProjectBake => ({
  projectId: 'c1', pageId: 'p1', entityId: 'pic', objectId: 'pic-image', imageName: 'sky.png',
  cx: 500, cy: 400, width: 200, height: 100, rotation: 90, flipX: true, flipY: false, ...extra,
});
const stored = { name: 'turned.png', url: '/novira-image/turned.png' } as ImageDTO;
let canvases: ReturnType<typeof installRecordingCanvases>;
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };
  revoke = vi.fn();
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = revoke as never;
  useGallery.setState({ images: [{ name: 'sky.png', url: '/novira-image/sky.png' } as ImageDTO] });
  vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 400 } as HTMLImageElement);
  vi.spyOn(backend, 'saveImageFromUrl').mockResolvedValue(stored);
});

afterEach(() => {
  canvases.restore();
  vi.restoreAllMocks();
});

describe('baking one picture', () => {
  it('draws it turned and mirrored at the density of the picture and returns the name of the stored result', async () => {
    expect(await bakeOne(bake())).toBe('turned.png');
    const rec = canvases.all.at(-1)!;
    // 200 × 100 turned a quarter is 100 × 200; the picture has 2 pixels per page pixel.
    expect(rec.ctx.canvas).toMatchObject({ width: 200, height: 400 });
    expect(rec.of('rotate')[0]![0]).toBeCloseTo(Math.PI / 2);
    expect(rec.of('scale')).toEqual([[-1, 1]]);
    expect(rec.of('drawImage')[0]!.slice(1)).toEqual([-200, -100, 400, 200]);
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('mirrors upside down for a flipped picture and draws a large one smaller', async () => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 100000 } as HTMLImageElement);
    await bakeOne(bake({ rotation: 0, flipX: false, flipY: true }));
    const rec = canvases.all.at(-1)!;
    expect(rec.of('scale')).toEqual([[1, -1]]);
    expect(Math.max((rec.ctx.canvas as HTMLCanvasElement).width, (rec.ctx.canvas as HTMLCanvasElement).height)).toBe(4096);
  });

  it('fails for a picture that is no longer in the gallery', async () => {
    await expect(bakeOne(bake({ imageName: 'gone.png' }))).rejects.toThrow('picture gone.png is gone');
  });

  it('fails when the canvas has no 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(bakeOne(bake())).rejects.toThrow('no canvas');
  });

  it('fails when the browser gives no picture', async () => {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    await expect(bakeOne(bake())).rejects.toThrow('empty image');
  });

  it('lets the address of the drawing go when storing it fails', async () => {
    vi.spyOn(backend, 'saveImageFromUrl').mockRejectedValue(new Error('disk full'));
    await expect(bakeOne(bake())).rejects.toThrow('disk full');
    expect(revoke).toHaveBeenCalledOnce();
  });
});
