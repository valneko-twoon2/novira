import { describe, expect, it, vi } from 'vitest';
import { MOCK_PICTURES } from '@/backend/mock/mockPictures';
import { coverUrl, coverVideoUrl } from './covers';

// The desktop app has no stand-in pictures; `standIn.on = false` turns the browser mock's off for a test.
const standIn = vi.hoisted(() => ({ on: true }));
vi.mock('@/backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/backend')>();
  return { ...real, standInCover: (key: string | number) => (standIn.on ? real.standInCover(key) : undefined) };
});

describe('coverUrl', { tags: [] }, () => {
  it('uses the real cover URLs of a model and an empty URL past the end', { tags: ['boundary'] }, () => {
    const model = { id: '1', imageUrls: ['https://image.civitai.com/a.jpeg'] };
    expect(coverUrl(model, 0)).toBe('https://image.civitai.com/a.jpeg');
    expect(coverUrl(model, 3)).toBe('');
  });

  it('stands a mock picture in for each cover of a model without URLs, the same every time', { tags: ['condition'] }, () => {
    const model = { id: 'civ-7', imageUrls: undefined };
    expect(MOCK_PICTURES).toContain(coverUrl(model, 0));
    expect(coverUrl(model, 1)).toBe(coverUrl(model, 1));
  });

  it('leaves the cover empty for a model without URLs where there is no stand-in (the desktop app)', { tags: ['condition'] }, () => {
    standIn.on = false;
    try {
      expect(coverUrl({ id: 'civ-7', imageUrls: undefined }, 0)).toBe('');
    } finally {
      standIn.on = true;
    }
  });
});

describe('coverVideoUrl', { tags: [] }, () => {
  it('turns the first-frame address of a Civitai video into the video, and leaves pictures alone', { tags: ['equivalence'] }, () => {
    expect(coverVideoUrl('https://image.civitai.com/k/u/anim=false,width=512/1.mp4')).toBe('https://image.civitai.com/k/u/width=512/1.mp4');
    expect(coverVideoUrl('https://image.civitai.com/k/u/anim=false,width=512/1.WEBM')).toBe('https://image.civitai.com/k/u/width=512/1.WEBM');
    expect(coverVideoUrl('https://image.civitai.com/k/u/width=512/1.jpeg')).toBeNull();
    expect(coverVideoUrl('https://image.civitai.com/k/u/anim=false,width=512/1.jpeg')).toBeNull();
    expect(coverVideoUrl('https://image.civitai.com/k/u/width=512/1.mp4')).toBeNull();
    expect(coverVideoUrl('')).toBeNull();
  });
});
