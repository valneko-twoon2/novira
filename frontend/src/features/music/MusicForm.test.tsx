// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { usePacks } from '@/state/media/packs';
import { useMusic } from '@/state/media/music';
import { TooltipProvider } from '@/ui';
import { registerMusicFeature } from './register';
import { MusicPanel } from './MusicView';

const form = () => useMusic.getState().form;
const initial = useMusic.getState().form;

/** Opens a Radix select by its label and picks the option with the given text. */
const choose = (label: string, option: string) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};
const setNum = (label: string, value: number) => {
  const input = screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  registerMusicFeature();
  usePacks.getState().setPack('music', { state: 'ready' });
  useMusic.setState({ form: { ...initial, randomizeSeed: false, seed: 7, instrumental: false } });
  render(<TooltipProvider><MusicPanel /></TooltipProvider>);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('music form controls', () => {
  it('writes the lyrics and style tags into the form', () => {
    fireEvent.change(screen.getByTestId('music-lyrics'), { target: { value: 'la la' } });
    fireEvent.change(screen.getByTestId('music-tags'), { target: { value: 'jazz' } });
    expect(form()).toMatchObject({ lyrics: 'la la', tags: 'jazz' });
  });

  it('changes the lyrics language, the time signature and the key from their menus', () => {
    choose(t('music.language'), t('music.lang.en'));
    expect(form().language).toBe('en');
    choose(t('music.timeSignature'), '3/4');
    expect(form().timeSignature).toBe(3);
    choose(t('music.key'), 'D minor');
    expect(form().key).toBe('D minor');
  });

  it('keeps the language menu off for an instrumental song', () => {
    act(() => useMusic.getState().setForm({ instrumental: true }));
    expect((screen.getByLabelText(t('music.language')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sets the length, tempo, steps and guidance, clamped to their limits', () => {
    setNum(t('music.lengthLabel'), 60);
    expect(form().seconds).toBe(60);
    setNum(t('music.bpm'), 999);
    expect(form().bpm).toBe(220);
    setNum(t('music.steps'), 1);
    expect(form().steps).toBe(4);
    setNum(t('music.cfg'), 2.5);
    expect(form().cfgScale).toBe(2.5);
  });

  it('grays out the seed box and the roll button while a new seed is drawn each time, and takes a seed otherwise', () => {
    const box = () => screen.getByLabelText(t('params.seed.label')) as HTMLInputElement;
    const roll = () => screen.getByRole('button', { name: t('params.seed.shuffle') }) as HTMLButtonElement;
    expect(form().randomizeSeed).toBe(false);
    expect([box().disabled, roll().disabled]).toEqual([false, false]);
    setNum(t('params.seed.label'), 123);
    expect(form().seed).toBe(123);
    fireEvent.click(roll());
    expect(form().seed).not.toBe(123);
    fireEvent.click(screen.getByTestId('seed-random'));
    expect(form().randomizeSeed).toBe(true);
    expect([box().disabled, roll().disabled]).toEqual([true, true]);
    fireEvent.click(screen.getByTestId('seed-fixed'));
    expect([box().disabled, roll().disabled]).toEqual([false, false]);
  });
});
