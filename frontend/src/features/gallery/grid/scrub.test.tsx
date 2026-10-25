// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { ratioOf } from './ScrubPreview';
import { Thumbnail } from './Thumbnail';

afterEach(cleanup);

const media = (mediaType: ImageDTO['mediaType']) =>
  ({ name: 'a', mediaType, url: 'http://x/full/a', thumbnailUrl: 'http://x/thumb/a', width: 10, height: 10, starred: false }) as unknown as ImageDTO;

const show = (image: ImageDTO) =>
  render(<Thumbnail image={image} size={100} selected={false} isCompare={false} alwaysShowSize={false} onClick={() => {}} />);

describe('scrub position', () => {
  it('is the pointer position across the element, kept inside 0..1', () => {
    const rect = { left: 100, width: 200 };
    expect(ratioOf(200, rect)).toBe(0.5);
    expect(ratioOf(0, rect)).toBe(0);
    expect(ratioOf(900, rect)).toBe(1);
    expect(ratioOf(5, { left: 0, width: 0 })).toBe(0);
  });
});

describe('thumbnail scrub', () => {
  it('loads the video only while the pointer is over a video thumbnail', () => {
    const { container } = show(media('video'));
    const thumb = screen.getByTestId('gallery-thumb');
    expect(container.querySelector('video')).toBeNull();
    fireEvent.pointerEnter(thumb);
    expect(container.querySelector('video')?.getAttribute('src')).toBe('http://x/full/a');
    expect(container.querySelector('.gthumb__progress')).not.toBeNull();
    fireEvent.pointerLeave(thumb);
    expect(container.querySelector('video')).toBeNull();
  });

  it('shows a play-head on audio and nothing on still images', () => {
    const audio = show(media('audio'));
    fireEvent.pointerEnter(screen.getByTestId('gallery-thumb'));
    expect(audio.container.querySelector('.gthumb__playhead')).not.toBeNull();
    cleanup();
    const still = show(media(undefined as unknown as ImageDTO['mediaType']));
    fireEvent.pointerEnter(screen.getByTestId('gallery-thumb'));
    expect(still.container.querySelector('.gthumb__progress')).toBeNull();
  });
});
