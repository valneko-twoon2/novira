// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { currentMessages, useAgent } from '@/state/agent';
import { useMusic } from '@/state/media/music';
import { useUi } from '@/state/ui';
import { useVideo } from '@/state/media/video';
import { useVoice } from '@/state/media/voice';
import { videoPatch } from '../video/agentEditor';
import { registerVideoFeature } from '../video/register';
import { registerMusicFeature } from './register';
import { registerVoiceFeature } from '../voice/register';
import { musicPatch } from './agentEditor';
import { voicePatch } from '../voice/agentEditor';

beforeEach(() => {
  registerMusicFeature();
  registerVoiceFeature();
  registerVideoFeature();
  useAgent.setState({ sessions: [], currentId: null, busy: false });
  useMusic.setState({ form: { ...useMusic.getState().form, tags: 'old', lyrics: '', seconds: 60, instrumental: false } });
  useVoice.setState({ form: { text: 'old', language: 'Auto', mode: 'preset', speaker: 'Ono_Anna', instruct: '' } });
});

describe('assistant fields', () => {
  it('keeps valid music fields, clamps numbers and drops unknown choices', () => {
    expect(musicPatch({ tags: ' lofi ', seconds: 9999, bpm: 5, key: 'H major', language: 'ja', timeSignature: 5, extra: 1 })).toEqual({ tags: 'lofi', seconds: 240, bpm: 40, language: 'ja' });
  });

  it('keeps valid voice fields and drops unknown choices', () => {
    expect(voicePatch({ text: ' hi ', speaker: 'Nobody', language: 'English', mode: 'design' })).toEqual({ text: 'hi', language: 'English', mode: 'design' });
  });
});

describe('video fields', () => {
  it('keeps a listed size, clamps the length and drops the rest', () => {
    expect(videoPatch({ prompt: ' a cat ', size: '480x832', seconds: 99, fps: 24, mode: 'audio', x: 1 })).toEqual({ positivePrompt: 'a cat', width: 480, height: 832, seconds: 10, fps: 24 });
    expect(videoPatch({ size: '1x1' })).toEqual({});
  });

  it('is filled from the video screen and undone', async () => {
    useUi.setState({ activeTab: 'generate', media: 'video' });
    useVideo.getState().setForm({ positivePrompt: 'old', seconds: 2 });
    await useAgent.getState().send('a dog running');
    expect(useVideo.getState().form.positivePrompt).toBe('a dog running');
    expect(useVideo.getState().form.seconds).toBe(3);
    useAgent.getState().undo(currentMessages(useAgent.getState()).at(-1)!.id);
    expect(useVideo.getState().form.positivePrompt).toBe('old');
  });
});

describe('assistant on the music and voice screens', () => {
  it('sends the form, fills it, and undoes the change', async () => {
    useUi.setState({ activeTab: 'generate', media: 'music' });
    const chat = vi.spyOn(backend, 'agentChat');
    await useAgent.getState().send('calm piano, instrumental');
    expect(chat.mock.calls[0]![0].screen).toBe('music');
    expect(useMusic.getState().form.tags).toBe('piano, calm');
    expect(useMusic.getState().form.instrumental).toBe(true);

    const reply = currentMessages(useAgent.getState()).at(-1)!;
    useAgent.getState().undo(reply.id);
    expect(useMusic.getState().form.tags).toBe('old');
    expect(useMusic.getState().form.instrumental).toBe(false);
  });

  it('fills the voice text', async () => {
    useUi.setState({ activeTab: 'generate', media: 'voice' });
    await useAgent.getState().send('Good morning');
    expect(useVoice.getState().form.text).toBe('Good morning');
  });
});
