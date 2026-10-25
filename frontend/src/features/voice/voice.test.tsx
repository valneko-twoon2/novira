// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest } from '@/backend';
import { t } from '@/i18n';
import { AudioResults } from '@/features/media/AudioResults';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { useUi } from '@/state/ui';
import { useVoice } from '@/state/media/voice';
import { TooltipProvider } from '@/ui';
import { buildVoiceRequest, voiceProblems } from './buildRequest';
import { registerVoiceFeature } from './register';
import { VoicePanel } from './VoiceView';

beforeEach(() => {
  registerVoiceFeature();
  useUi.setState({ activeTab: 'generate', media: 'voice' });
  usePacks.getState().setPack('voice', { state: 'ready' });
  useVoice.setState({ form: { text: '', language: 'Auto', mode: 'preset', speaker: 'Ono_Anna', instruct: '' } });
  useGallery.setState({ images: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('voice request', () => {
  it('needs text, and a description in design mode', () => {
    const { form } = useVoice.getState();
    const texts = { text: 'text', description: 'description' };
    expect(voiceProblems(form, texts)).toEqual(['text']);
    expect(voiceProblems({ ...form, text: 'hello' }, texts)).toEqual([]);
    expect(voiceProblems({ ...form, text: 'hello', mode: 'design' }, texts)).toEqual(['description']);
    expect(voiceProblems({ ...form, text: 'hello', mode: 'design', instruct: 'low voice' }, texts)).toEqual([]);
  });

  it('carries the voice settings', () => {
    const req = buildVoiceRequest({ text: ' こんにちは ', language: 'Japanese', mode: 'preset', speaker: 'Ono_Anna', instruct: ' cheerful ' });
    expect(req.params.generationMode).toBe('voice');
    expect(req.params.voice).toEqual({ text: 'こんにちは', language: 'Japanese', mode: 'preset', speaker: 'Ono_Anna', instruct: 'cheerful' });
  });
});

describe('voice panel', () => {
  it('invokes once there is text', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    render(<TooltipProvider><VoicePanel /></TooltipProvider>);
    const start = screen.getByTestId('invoke-button') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('voice-text'), { target: { value: 'Hello there' } });
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(enqueue).toHaveBeenCalled());
    expect((enqueue.mock.calls[0]![0] as EnqueueRequest).params.voice?.text).toBe('Hello there');
  });

  it('design mode swaps the speaker list for a description', () => {
    render(<TooltipProvider><VoicePanel /></TooltipProvider>);
    expect(screen.queryByTestId('voice-description')).toBeNull();
    fireEvent.click(screen.getByTestId('voice-mode-design'));
    expect(screen.getByTestId('voice-description')).toBeTruthy();
    expect(screen.queryByTestId('voice-style')).toBeNull();
  });

  it('shows the preset card first, and a preset sets the voice but keeps the text', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    // No canvas in jsdom: the preset covers keep their placeholder icon.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    useVoice.getState().setForm({ text: 'Keep me', mode: 'design', instruct: 'a robot' });
    render(<TooltipProvider><VoicePanel /></TooltipProvider>);
    const head = screen.getByTestId('voice-panel').querySelector('.mf-head')!;
    expect(head.firstElementChild?.getAttribute('data-testid')).toBe('voice-presets');
    fireEvent.click(screen.getByTestId('preset-trigger'));
    fireEvent.click(screen.getByText('Calm narrator'));
    expect(useVoice.getState().form).toMatchObject({ text: 'Keep me', mode: 'preset', speaker: 'Ono_Anna' });
    expect(screen.getByTestId('preset-trigger').textContent).toContain('Calm narrator');
  });
});

describe('audio results', () => {
  const clip = (name: string, mode: 'music' | 'voice', createdAt: number) =>
    ({
      name,
      mediaType: 'audio',
      url: `http://x/full/${name}`,
      thumbnailUrl: `http://x/thumb/${name}`,
      width: 256,
      height: 144,
      createdAt,
      metadata: { generationMode: mode, positivePrompt: name, seed: 1, voice: mode === 'voice' ? { text: name, language: 'English', mode: 'preset', speaker: 'Ryan', instruct: '' } : undefined },
    }) as unknown as ImageDTO;

  it('shows only the clips of its own kind, newest first, each with a player', () => {
    useGallery.setState({ images: [clip('old.wav', 'voice', 1), clip('song.flac', 'music', 2), clip('new.wav', 'voice', 3)] });
    render(<TooltipProvider><AudioResults kind="voice" /></TooltipProvider>);
    const clips = screen.getAllByTestId('voice-clip');
    expect(clips.map((c) => c.querySelector('.au-clip__title')?.textContent)).toEqual(['new.wav', 'old.wav']);
    expect(clips[0]!.querySelector('audio')?.getAttribute('src')).toBe('http://x/full/new.wav');
  });

  it('says there is nothing yet when there are no clips', () => {
    render(<TooltipProvider><AudioResults kind="music" /></TooltipProvider>);
    expect(screen.queryByTestId('music-clip')).toBeNull();
    expect(screen.getByTestId('music-results').textContent).toBe(t('audio.empty.music.title'));
  });
});
