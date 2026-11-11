// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { keepMarks, liveMarks, MARKS_SHOWN } from './pictureMarks';

const picture = (name: string, thumbnailUrl = `thumb/${name}`) => ({ name, thumbnailUrl }) as ImageDTO;

/** An Image that loads (or fails) as soon as its source is set, with a fixed size. */
function fakeImages(fail: (src: string) => boolean) {
  class FakeImage {
    naturalWidth = 200;
    naturalHeight = 100;
    crossOrigin = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      queueMicrotask(() => (fail(value) ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
    return `data:${this.width}x${this.height}`;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('picture marks of a notification', () => {
  it('keeps small copies of at most the first few pictures, scaled to one height', { tags: ['boundary'] }, async () => {
    fakeImages(() => false);
    const marks = await keepMarks(Array.from({ length: MARKS_SHOWN + 2 }, (_, i) => picture(`p${i}`)));
    expect(marks).toHaveLength(MARKS_SHOWN);
    expect(marks[0]).toBe('data:128x64');
  });

  it('leaves out a picture that does not load, and keeps the others', { tags: ['error-guessing'] }, async () => {
    fakeImages((src) => src.endsWith('bad'));
    expect(await keepMarks([picture('bad'), picture('good')])).toEqual(['data:128x64']);
  });

  it(
    'gives up on a picture that never loads, so the notification does not wait for it',
    { tags: ['error-guessing', 'boundary'] },
    async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        'Image',
        class {
          set src(_: string) {}
        },
      );
      const pending = keepMarks([picture('slow')]);
      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toEqual([]);
      vi.useRealTimers();
    },
  );

  it('uses the addresses of pictures that are still in the gallery as they are', { tags: ['condition'] }, () => {
    expect(liveMarks([picture('a'), picture('b', '')])).toEqual(['thumb/a']);
  });
});
