// @vitest-environment jsdom
// Scrubbing a video thumbnail: the pointer position seeks the clip (once per frame), and the time and the ready state follow.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { Thumbnail } from './Thumbnail';

const video = { name: 'v', mediaType: 'video', url: 'http://x/full/v', thumbnailUrl: 'http://x/thumb/v', width: 10, height: 10, starred: false } as unknown as ImageDTO;
const audio = { ...video, name: 'au', mediaType: 'audio' } as ImageDTO;

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const show = (image: ImageDTO) =>
  render(<Thumbnail image={image} size={100} selected={false} isCompare={false} alwaysShowSize={false} onClick={() => {}} />);

describe('video scrub', () => {
  it('seeks to the pointer position on the next frame and shows the time once the clip is known', () => {
    const { container } = show(video);
    const thumb = screen.getByTestId('gallery-thumb');
    fireEvent.pointerEnter(thumb);
    const el = container.querySelector('video')!;
    Object.defineProperty(el, 'duration', { value: 120, configurable: true });
    fireEvent.pointerMove(thumb, { clientX: 50 });
    expect(frames).toHaveLength(1);
    frames.pop()!(0);
    expect(el.currentTime).toBe(60);
    // A second move before the frame replaces the pending seek.
    fireEvent.pointerMove(thumb, { clientX: 25 });
    fireEvent.pointerMove(thumb, { clientX: 75 });
    expect(vi.mocked(cancelAnimationFrame)).toHaveBeenCalled();
    frames.pop()!(0);
    expect(el.currentTime).toBe(90);
    fireEvent.loadedMetadata(el);
    expect(container.querySelector('.gthumb__time')?.textContent).toBe('1:30');
    expect(el.className).not.toContain('is-ready');
    fireEvent.seeked(el);
    expect(el.className).toContain('is-ready');
    fireEvent.pointerLeave(thumb);
    expect(container.querySelector('video')).toBeNull();
  });

  it('does not seek before the clip length is known', () => {
    const { container } = show(video);
    const thumb = screen.getByTestId('gallery-thumb');
    fireEvent.pointerEnter(thumb);
    expect(Number.isFinite(container.querySelector('video')!.duration)).toBe(false);
    fireEvent.pointerMove(thumb, { clientX: 50 });
    expect(frames).toHaveLength(0);
  });

  it('moves the play-head of an audio thumbnail without a video element', () => {
    const { container } = show(audio);
    const thumb = screen.getByTestId('gallery-thumb');
    fireEvent.pointerEnter(thumb);
    fireEvent.pointerMove(thumb, { clientX: 40 });
    expect(container.querySelector<HTMLElement>('.gthumb__playhead')?.style.left).toBe('40%');
    expect(container.querySelector('video')).toBeNull();
  });
});
