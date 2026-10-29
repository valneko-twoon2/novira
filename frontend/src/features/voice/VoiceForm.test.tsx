// @vitest-environment jsdom
// The voice form: the language and speaker lists, the style and the description, and what each mode shows.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { usePacks } from '@/state/media/packs';
import { useVoice } from '@/state/media/voice';
import { TooltipProvider } from '@/ui';
import { registerVoiceFeature } from './register';
import { VoicePanel } from './VoiceView';

const form = () => useVoice.getState().form;
const choose = (label: string, option: string) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  registerVoiceFeature();
  usePacks.getState().setPack('voice', { state: 'ready' });
  useVoice.setState({ form: { text: '', language: 'Auto', mode: 'preset', speaker: 'Ono_Anna', instruct: '' } });
  render(
    <TooltipProvider>
      <VoicePanel />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the voice form', () => {
  it('writes the text', () => {
    fireEvent.change(screen.getByTestId('voice-text'), { target: { value: 'Good morning' } });
    expect(form().text).toBe('Good morning');
  });

  it('chooses the language from the list', () => {
    choose(t('voice.language'), t('voice.lang.Japanese'));
    expect(form().language).toBe('Japanese');
  });

  it('chooses the speaker in preset mode, and writes the style', () => {
    choose(t('voice.speaker'), t('voice.speaker.Ryan'));
    expect(form().speaker).toBe('Ryan');
    fireEvent.change(screen.getByTestId('voice-style'), { target: { value: 'whispering' } });
    expect(form().instruct).toBe('whispering');
  });

  it('marks the mode in use and swaps the speaker for the description in design mode', () => {
    expect(screen.getByTestId('voice-mode-preset').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('voice-mode-design'));
    expect(form().mode).toBe('design');
    expect(screen.getByTestId('voice-mode-design').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('voice-mode-preset').getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByLabelText(t('voice.speaker'))).toBeNull();
    fireEvent.change(screen.getByTestId('voice-description'), { target: { value: 'a deep calm voice' } });
    expect(form().instruct).toBe('a deep calm voice');
    fireEvent.click(screen.getByTestId('voice-mode-preset'));
    expect(screen.getByLabelText(t('voice.speaker'))).toBeTruthy();
  });
});
