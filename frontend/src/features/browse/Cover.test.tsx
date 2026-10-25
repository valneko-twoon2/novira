// @vitest-environment jsdom
// An empty Civitai cover says why it may be empty: pictures above the plain level are left out unless mature content is on.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { useBrowse } from './browseStore';
import { Cover } from './Cover';

const model = (over: Partial<CivitaiModel>) => ({ id: 1, imageCount: 0, imageUrls: [], ...over }) as CivitaiModel;
const note = () => screen.queryByText(t('browse.cover.maybeMature'));

beforeEach(() => useBrowse.setState({ includeNsfw: false }));
afterEach(() => {
  cleanup();
  useBrowse.setState({ includeNsfw: false });
});

describe('Cover', () => {
  it('explains an empty Civitai cover while mature content is off', () => {
    render(<Cover model={model({})} index={0} />);
    expect(note()).not.toBeNull();
  });

  it('shows no note once mature content is on, when the model has a picture, or for Hugging Face', () => {
    useBrowse.setState({ includeNsfw: true });
    const { rerender } = render(<Cover model={model({})} index={0} />);
    expect(note()).toBeNull();
    useBrowse.setState({ includeNsfw: false });
    rerender(<Cover model={model({ imageCount: 1, imageUrls: ['https://image.civitai.com/a.jpeg'] })} index={0} />);
    expect(note()).toBeNull();
    rerender(<Cover model={model({ source: 'huggingface' })} index={0} />);
    expect(note()).toBeNull();
  });

  it('shows no note past the last picture of a model that has some', () => {
    render(<Cover model={model({ imageCount: 1, imageUrls: ['https://image.civitai.com/a.jpeg'] })} index={1} />);
    expect(note()).toBeNull();
  });
});

describe('Cover of a video', () => {
  const still = 'https://image.civitai.com/k/u/anim=false,width=512/1.mp4';
  const withVideo = model({ imageCount: 1, imageUrls: [still] });
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  beforeEach(() => {
    play.mockClear();
    pause.mockClear();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  });
  const video = () => document.querySelector('video')!;

  it('is a picture of its first frame where nothing asks it to play', () => {
    render(<Cover model={withVideo} index={0} />);
    expect(video()).toBeNull();
    expect(document.querySelector('img')?.getAttribute('src')).toBe(still);
  });

  it('plays the video itself on hover, with the first frame as its poster, and stops when the pointer leaves', () => {
    render(<Cover model={withVideo} index={0} play="hover" />);
    expect(video().getAttribute('src')).toBe('https://image.civitai.com/k/u/width=512/1.mp4');
    expect(video().getAttribute('poster')).toBe(still);
    expect(video().controls).toBe(false);
    fireEvent.mouseEnter(video());
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(video());
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('has its own controls in the detail view and plays nothing by itself', () => {
    render(<Cover model={withVideo} index={0} play="controls" />);
    expect(video().controls).toBe(true);
    fireEvent.mouseEnter(video());
    expect(play).not.toHaveBeenCalled();
  });

  it('keeps a plain picture an image whatever the play mode', () => {
    render(<Cover model={model({ imageCount: 1, imageUrls: ['https://image.civitai.com/k/u/width=512/1.jpeg'] })} index={0} play="hover" />);
    expect(video()).toBeNull();
    expect(document.querySelector('img')).not.toBeNull();
  });

  it('leaves an empty frame when the video cannot be loaded', () => {
    render(<Cover model={withVideo} index={0} play="hover" />);
    fireEvent.error(video());
    expect(video()).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});
