// Which picture the stage draws over the bbox while canvas results are staged and more are being made.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ProgressEvent, QueueItem } from '@/backend';
import { useGallery } from '@/state/gallery';
import { overlayImageUrl } from './overlayImage';

const staging = (patch: Partial<Parameters<typeof overlayImageUrl>[0]> = {}) => ({ stagedImageNames: ['a.png', 'b.png'], stagedIndex: 0, stagingGenerating: true, stagingShowResults: true, ...patch });
const canvasJob = { items: [{ id: 7, destination: 'canvas' } as QueueItem], progress: { itemId: 7, progressImageUrl: '/live.png' } as ProgressEvent };

beforeEach(() => {
  useGallery.setState({ images: ['a.png', 'b.png'].map((name) => ({ name, url: `/${name}` }) as ImageDTO) });
});

describe('overlayImageUrl', () => {
  it('keeps a finished result on its page while the next one is made', () => {
    expect(overlayImageUrl(staging({ stagedIndex: 1 }), canvasJob, true)).toBe('/b.png');
  });

  it('draws the progress on the generating page, and before any result', () => {
    expect(overlayImageUrl(staging({ stagedIndex: 2 }), canvasJob, true)).toBe('/live.png');
    expect(overlayImageUrl(staging({ stagedImageNames: [] }), canvasJob, true)).toBe('/live.png');
  });

  it('draws no progress of a job bound elsewhere, or on a store canvas jobs do not reach', () => {
    const toGallery = { ...canvasJob, items: [{ id: 7, destination: 'gallery' } as QueueItem] };
    expect(overlayImageUrl(staging({ stagedIndex: 2 }), toGallery, true)).toBeNull();
    expect(overlayImageUrl(staging({ stagedIndex: 2 }), canvasJob, false)).toBeNull();
    expect(overlayImageUrl(staging({ stagedIndex: 2 }), { items: canvasJob.items, progress: null }, true)).toBeNull();
  });

  it('draws no result while results are hidden, and clamps an index left past the end', () => {
    expect(overlayImageUrl(staging({ stagingShowResults: false }), canvasJob, true)).toBeNull();
    expect(overlayImageUrl(staging({ stagedIndex: 2, stagingGenerating: false }), canvasJob, true)).toBe('/b.png');
  });
});
