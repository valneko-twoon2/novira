// @vitest-environment jsdom
// Which AI-fill pictures a scene needs, and loading them for the canvas.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { newTextLayer, richSourceKey, type Scene, type TextLayer } from '@/state/text/textModel';
import { loadRichPictures, richPictureNames, useRichPictures } from './richPictures';

vi.mock('@/backend', async (original) => ({ ...(await original<typeof import('@/backend')>()), loadImage: vi.fn(async (url: string) => (url.includes('broken') ? Promise.reject(new Error('x')) : { url })) }));

const image = (name: string): ImageDTO => ({ name, url: `http://x/${name}` }) as ImageDTO;

function layer(text: string, rich: string | null, patch: Partial<TextLayer> = {}): TextLayer {
  const base = newTextLayer({ width: 400, height: 300 }, text);
  const made = rich ? { rich: { imageName: rich, candidates: [rich], width: 100, height: 50, fontSize: base.style.fontSize, sourceKey: richSourceKey(base) } } : {};
  return { ...base, ...made, ...patch };
}
const sceneOf = (layers: TextLayer[]): Scene => ({ width: 400, height: 300, background: { kind: 'color', color: null }, layers });

afterEach(() => useGallery.setState({ images: [] }));

describe('richPictureNames', () => {
  it('lists the current pictures of visible text layers once each', () => {
    const stale = { ...layer('B', 'b.png'), text: 'changed' };
    const hidden = layer('C', 'c.png', { visible: false });
    const empty = layer('', 'd.png');
    const same1 = layer('E', 'e.png');
    const same2 = layer('F', 'e.png');
    const plain = layer('G', null);
    expect(richPictureNames(sceneOf([layer('A', 'a.png'), stale, hidden, empty, same1, same2, plain]))).toEqual(['a.png', 'e.png']);
  });

  it('is empty for a scene with no AI fill', () => {
    expect(richPictureNames(sceneOf([layer('A', null)]))).toEqual([]);
  });
});

describe('loadRichPictures', () => {
  it('loads what the gallery has and leaves out what is gone or cannot be read', async () => {
    useGallery.setState({ images: [image('a.png'), { ...image('broken.png'), url: 'http://x/broken.png' }] });
    const loaded = await loadRichPictures(['a.png', 'broken.png', 'gone.png']);
    expect([...loaded.keys()]).toEqual(['a.png']);
  });
});

describe('useRichPictures', () => {
  it('gives the loaded pictures, and picks one up that reaches the gallery later', async () => {
    const scene = sceneOf([layer('A', 'a.png')]);
    const { result } = renderHook(() => useRichPictures(scene));
    expect(result.current.size).toBe(0);
    act(() => useGallery.setState({ images: [image('a.png')] }));
    await waitFor(() => expect(result.current.has('a.png')).toBe(true));
  });

  it('is empty again when the scene no longer needs a picture', async () => {
    useGallery.setState({ images: [image('a.png')] });
    let scene = sceneOf([layer('A', 'a.png')]);
    const { result, rerender } = renderHook(() => useRichPictures(scene));
    await waitFor(() => expect(result.current.size).toBe(1));
    scene = sceneOf([layer('A', null)]);
    rerender();
    await waitFor(() => expect(result.current.size).toBe(0));
  });
});
