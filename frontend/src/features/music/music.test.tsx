// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest } from '@/backend';
import { MediaJobs } from '@/features/media/MediaJobs';
import { useMusic } from '@/state/media/music';
import { useUi } from '@/state/ui';
import { usePacks } from '@/state/media/packs';
import { buildMusicRequest, musicProblems } from './buildRequest';
import { TooltipProvider } from '@/ui';
import { registerMusicFeature } from './register';
import { MusicPanel } from './MusicView';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  registerMusicFeature();
  useUi.setState({ activeTab: 'generate', media: 'music' });
  usePacks.getState().setPack('music', { state: 'ready' });
  useMusic.setState({ form: { ...useMusic.getState().form, tags: '', lyrics: '', instrumental: false, randomizeSeed: false, seed: 7 } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('music request', () => {
  it('needs style tags', () => {
    const { form } = useMusic.getState();
    expect(musicProblems(form, { tags: 'tags' })).toEqual(['tags']);
    expect(musicProblems({ ...form, tags: 'lofi' }, { tags: 'tags' })).toEqual([]);
  });

  it('carries the lyrics and musical settings, and drops the lyrics of an instrumental', () => {
    const form = { ...useMusic.getState().form, tags: ' upbeat pop ', lyrics: ' la la ', seconds: 45, bpm: 100, key: 'E minor', language: 'en' };
    const req = buildMusicRequest(form);
    expect(req.params.generationMode).toBe('music');
    expect(req.params.positivePrompt).toBe('upbeat pop');
    expect(req.params.seed).toBe(7);
    expect(req.params.music).toEqual({ lyrics: 'la la', seconds: 45, bpm: 100, key: 'E minor', timeSignature: 4, language: 'en', instrumental: false });
    expect(buildMusicRequest({ ...form, instrumental: true }).params.music?.lyrics).toBe('');
  });
});

describe('music panel', () => {
  it('lists what is missing, then invokes once the style is filled in', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    render(<TooltipProvider><MusicPanel /></TooltipProvider>);
    const start = screen.getByTestId('invoke-button') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByTestId('music-problems').textContent).toBeTruthy();

    fireEvent.change(screen.getByTestId('music-tags'), { target: { value: 'calm piano' } });
    await waitFor(() => expect(start.disabled).toBe(false));
    expect(screen.queryByTestId('music-problems')).toBeNull();

    fireEvent.click(start);
    await waitFor(() => expect(enqueue).toHaveBeenCalled());
    const request = enqueue.mock.calls[0]![0] as EnqueueRequest;
    expect(request.params.generationMode).toBe('music');
    expect(request.params.positivePrompt).toBe('calm piano');
  });

  it('asks for the model download first', async () => {
    usePacks.getState().setPack('music', { state: 'missing', totalBytes: 10_000_000_000 });
    useMusic.getState().setForm({ tags: 'calm piano' });
    render(<TooltipProvider><MusicPanel /></TooltipProvider>);
    expect((screen.getByTestId('invoke-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('music-pack')).toBeTruthy();
  });

  it('turning on instrumental disables the lyrics', () => {
    render(<TooltipProvider><MusicPanel /></TooltipProvider>);
    const lyrics = screen.getByTestId('music-lyrics') as HTMLTextAreaElement;
    expect(lyrics.disabled).toBe(false);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(lyrics.disabled).toBe(true);
  });
});

describe('media jobs', () => {
  it('renders nothing when no job of that kind exists', () => {
    const { container } = render(<MediaJobs kind="music" />);
    expect(container.textContent).toBe('');
  });
});
