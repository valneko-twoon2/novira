// The gallery holds every picture (thousands on a used PC), and a deleted or picked selection can hold thousands of
// names too: taking them out or picking them must read each name a few times, not once per picture.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { imagesNamed, useGallery } from './gallery';

const initial = useGallery.getState();
beforeEach(() => useGallery.setState(initial, true));

const image = (name: string): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:${name}`,
  width: 64,
  height: 64,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
});

const GALLERY = 2000;
const PICKED = 1000;
const gallery = () => Array.from({ length: GALLERY }, (_, i) => image(`20261027_185645_${String(i).padStart(32, '0')}.png`));

/** `names` behind a proxy that counts how many of its entries are read. */
function counted(names: string[]): { list: string[]; reads: () => number } {
  let reads = 0;
  const list = new Proxy(names, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  return { list, reads: () => reads };
}

describe('gallery work against the size of the gallery', () => {
  it('removes a thousand pictures from two thousand reading each name about once', () => {
    const images = gallery();
    const names = images.filter((_, i) => i % 2 === 0).map((i) => i.name);
    useGallery.setState({ images, selection: names.slice(), viewerImageName: names[0]!, compareImageName: images[1]!.name });
    const { list, reads } = counted(names);
    useGallery.getState().removeImages(list);
    const s = useGallery.getState();
    expect(s.images).toHaveLength(GALLERY - PICKED);
    expect(s.images.every((i) => !names.includes(i.name))).toBe(true);
    expect(s.selection).toEqual([]);
    expect(s.viewerImageName).toBeNull();
    expect(s.compareImageName).toBe(images[1]!.name);
    expect(reads()).toBeLessThanOrEqual(2 * PICKED);
  });

  it('takes a removal the backend reports (images_changed) the same way', () => {
    const images = gallery();
    useGallery.setState({ images });
    const { list, reads } = counted(images.slice(0, PICKED).map((i) => i.name));
    useGallery.getState().applyImageChanges([], list);
    expect(useGallery.getState().images).toHaveLength(GALLERY - PICKED);
    expect(reads()).toBeLessThanOrEqual(2 * PICKED);
  });

  it('picks the named pictures in gallery order, reading each name about once', () => {
    const images = gallery();
    const wanted = images.filter((_, i) => i % 2 === 1).reverse();
    const { list, reads } = counted(wanted.map((i) => i.name));
    const picked = imagesNamed(images, list);
    expect(picked.map((i) => i.name)).toEqual(images.filter((_, i) => i % 2 === 1).map((i) => i.name));
    expect(reads()).toBeLessThanOrEqual(2 * PICKED);
  });

  it('picks nothing for no names and ignores names the gallery does not hold', () => {
    const images = gallery().slice(0, 3);
    expect(imagesNamed(images, [])).toEqual([]);
    expect(imagesNamed(images, ['gone.png', images[2]!.name]).map((i) => i.name)).toEqual([images[2]!.name]);
  });
});
