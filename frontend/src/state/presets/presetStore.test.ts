// @vitest-environment jsdom
// Tests for the generic preset store and the video, music, voice and text-style preset kinds.
import { beforeEach, describe, expect, it } from 'vitest';
import { useMusic } from '../media/music';
import { useVideo } from '../media/video';
import { useModels } from '../models';
import { useVoice } from '../media/voice';
import { useTextEditor } from '../text/textEditor';
import { DEFAULT_TEXT_STYLE, presetStyle } from '../text/textModel';
import { useImagePresets } from './imagePresets';
import { musicPresets, useMusicPresets } from './musicPresets';
import { applyPreset, createPresetStore, markBuiltins, overwritePreset, savePreset, type Preset, type PresetStore } from './presetStore';
import { logoPresetId, scaleStyle, textStylePresets, useTextStylePresets } from './textStylePresets';
import { useVideoPresets, videoPresets } from './videoPresets';
import { useVoicePresets, voicePresets } from './voicePresets';

/** Back to the built-ins only. */
function reset<D>(store: PresetStore<D>) {
  store.setState({ presets: store.getState().presets.filter((p) => p.builtin), selectedId: null });
}

beforeEach(() => {
  reset(useVideoPresets);
  reset(useMusicPresets);
  reset(useVoicePresets);
  reset(useTextStylePresets);
  localStorage.clear();
});

describe('createPresetStore', () => {
  const seed: Preset<{ n: number }>[] = [{ id: 'seed-a', name: 'A', data: { n: 1 } }];

  it('starts from the built-ins, flagged as built-in', () => {
    const store = createPresetStore({ name: 'test.presets.a', seed });
    expect(store.getState().presets).toEqual([{ id: 'seed-a', name: 'A', data: { n: 1 }, builtin: true }]);
  });

  it('adds, overwrites, renames and removes; editing a built-in makes it the user\'s', () => {
    const store = createPresetStore({ name: 'test.presets.b', seed });
    const id = store.getState().add('mine', { n: 2 });
    expect(store.getState().selectedId).toBe(id);
    expect(store.getState().presets.find((p) => p.id === id)).toMatchObject({ name: 'mine', data: { n: 2 } });

    store.getState().overwrite(id, { n: 3 });
    expect(store.getState().presets.find((p) => p.id === id)).toMatchObject({ data: { n: 3 } });

    store.getState().rename('seed-a', 'Renamed');
    expect(store.getState().presets.find((p) => p.id === 'seed-a')).toMatchObject({ name: 'Renamed', builtin: false });

    store.getState().remove(id);
    expect(store.getState().presets.map((p) => p.id)).toEqual(['seed-a']);
    expect(store.getState().selectedId).toBeNull();
  });

  it('persists under its own key and reads it back', async () => {
    const store = createPresetStore({ name: 'test.presets.c', seed });
    store.getState().add('kept', { n: 9 });
    const saved = JSON.parse(localStorage.getItem('test.presets.c') ?? '{}') as { state: { presets: Preset<{ n: number }>[] } };
    expect(saved.state.presets.map((p) => p.name)).toEqual(['A', 'kept']);

    const again = createPresetStore({ name: 'test.presets.c', seed });
    await again.persist.rehydrate();
    expect(again.getState().presets.map((p) => p.name)).toEqual(['A', 'kept']);
  });

  it('marks stored copies of built-ins only while they are unchanged', () => {
    const marked = markBuiltins(
      [
        { id: 'seed-a', name: 'A', data: { n: 1 } },
        { id: 'seed-b', name: 'B', data: { n: 2 } },
        { id: 'mine', name: 'M', data: { n: 3 } },
      ],
      [...seed, { id: 'seed-b', name: 'B', data: { n: 5 } }],
    );
    expect(marked.map((p) => p.builtin)).toEqual([true, false, false]);
  });

  it('upgrades stored image presets: built-ins renamed in English and flagged', () => {
    const migrate = useImagePresets.persist.getOptions().migrate!;
    const standard = useImagePresets.getState().presets.find((p) => p.id === 'seed-standard')!;
    const migrated = migrate({ presets: [{ id: 'seed-standard', name: 'old name', data: standard.data }, { id: 'u', name: 'u', data: {} }] }, 1) as {
      presets: Preset<unknown>[];
    };
    expect(migrated.presets).toEqual([
      { id: 'seed-standard', name: 'Standard', data: standard.data, builtin: true },
      { id: 'u', name: 'u', data: {}, builtin: false },
    ]);
  });
});

describe('preset kinds', () => {
  it('keeps the presets of each kind apart', () => {
    const before = { music: useMusicPresets.getState().presets.length, voice: useVoicePresets.getState().presets.length };
    savePreset(videoPresets, 'clip');
    expect(useVideoPresets.getState().presets.some((p) => p.name === 'clip')).toBe(true);
    expect(useMusicPresets.getState().presets).toHaveLength(before.music);
    expect(useVoicePresets.getState().presets).toHaveLength(before.voice);
    expect(localStorage.getItem('novira.videoPresets')).toContain('clip');
    expect(localStorage.getItem('novira.musicPresets')).toBeNull();
  });

  it('video: saves and applies the settings but leaves the seed and the source picture alone', () => {
    useVideo.getState().setForm({ positivePrompt: 'waves', steps: 30, width: 832, height: 480, seed: 1, sourceImageName: 'a.png' });
    const id = savePreset(videoPresets, 'mine');
    expect(useVideoPresets.getState().presets.find((p) => p.id === id)?.data).not.toHaveProperty('seed');

    useVideo.getState().setForm({ positivePrompt: 'city', steps: 10, width: 480, height: 832, seed: 2, sourceImageName: 'b.png' });
    expect(applyPreset(videoPresets, id)).toBe(true);
    expect(useVideo.getState().form).toMatchObject({ positivePrompt: 'waves', steps: 30, width: 832, height: 480, seed: 2, sourceImageName: 'b.png' });
    expect(useVideoPresets.getState().selectedId).toBe(id);
  });

  it('video: a built-in only sets the fields it holds, and goes back from an installed model to its own', () => {
    useModels.setState({ models: [{ key: 'wan', name: 'Wan 14B', base: 'wan', type: 'diffusion_model', path: 'wan.safetensors' }] as never });
    useVideo.getState().setForm({ positivePrompt: 'kept prompt', model: 'standard', modelKey: 'wan' });
    applyPreset(videoPresets, 'seed-video-preview');
    expect(useVideo.getState().form).toMatchObject({ positivePrompt: 'kept prompt', model: 'fast', modelKey: null, steps: 4 });
  });

  it('video: keeps the installed model it was saved with, unless that model is gone', () => {
    useModels.setState({ models: [{ key: 'wan', name: 'Wan 14B', base: 'wan', type: 'diffusion_model', path: 'wan.safetensors' }] as never });
    useVideo.getState().setForm({ modelKey: 'wan' });
    const id = savePreset(videoPresets, 'wan clip');
    useVideo.getState().setForm({ modelKey: null });
    applyPreset(videoPresets, id);
    expect(useVideo.getState().form.modelKey).toBe('wan');
    useVideo.getState().setForm({ modelKey: null });
    useModels.setState({ models: [] });
    applyPreset(videoPresets, id);
    expect(useVideo.getState().form.modelKey).toBeNull();
  });

  it('music: overwrite takes the current settings; the lyrics and seed are never touched', () => {
    useMusic.getState().setForm({ tags: 'rock', bpm: 140, lyrics: 'first', seed: 3 });
    const id = savePreset(musicPresets, 'rock');
    useMusic.getState().setForm({ tags: 'jazz', bpm: 90 });
    overwritePreset(musicPresets, id);
    useMusic.getState().setForm({ tags: 'ambient', bpm: 60, lyrics: 'second', seed: 4 });
    applyPreset(musicPresets, id);
    expect(useMusic.getState().form).toMatchObject({ tags: 'jazz', bpm: 90, lyrics: 'second', seed: 4 });
  });

  it('voice: applies the voice and keeps the text', () => {
    useVoice.getState().setForm({ text: 'hello', mode: 'design', instruct: 'old man' });
    applyPreset(voicePresets, 'seed-voice-narrator');
    expect(useVoice.getState().form).toMatchObject({ text: 'hello', mode: 'preset', speaker: 'Ono_Anna' });
  });

  it('ignores fields a preset does not own and presets that are gone', () => {
    useVoicePresets.setState({ presets: [{ id: 'x', name: 'x', data: { language: 'English', text: 'injected' } as never }] });
    useVoice.getState().setForm({ text: 'mine' });
    applyPreset(voicePresets, 'x');
    expect(useVoice.getState().form).toMatchObject({ text: 'mine', language: 'English' });
    expect(applyPreset(voicePresets, 'missing')).toBe(false);
  });
});

describe('text style presets', () => {
  beforeEach(() => {
    useTextEditor.setState({ scene: { width: 1024, height: 1024, background: { kind: 'color', color: null }, layers: [] }, selectedId: null, past: [], future: [] });
  });

  it('ships the logo looks as built-ins', () => {
    const pop = useTextStylePresets.getState().presets.find((p) => p.id === logoPresetId('pop'));
    expect(pop).toMatchObject({ builtin: true, data: presetStyle('pop', DEFAULT_TEXT_STYLE) });
  });

  it('scales pixel measures to the target size', () => {
    const style = { ...DEFAULT_TEXT_STYLE, fontSize: 100, stroke: { color: '#000', width: 10 }, letterSpacing: 4 };
    expect(scaleStyle(style, 50)).toMatchObject({ fontSize: 50, stroke: { color: '#000', width: 5 }, letterSpacing: 2 });
  });

  it('applies to the selected text layer only, keeping its words and size', () => {
    const id = useTextEditor.getState().addText('Title');
    const size = useTextEditor.getState().scene.layers[0]!.style.fontSize;
    applyPreset(textStylePresets, logoPresetId('gold'));
    const layer = useTextEditor.getState().scene.layers[0]!;
    expect(layer).toMatchObject({ id, text: 'Title' });
    expect(layer.style).toMatchObject({ fontFamily: 'Shippori Mincho', fontSize: size });
    // One undo step brings the old style back.
    useTextEditor.getState().undo();
    expect(useTextEditor.getState().scene.layers[0]!.style.fontFamily).toBe(DEFAULT_TEXT_STYLE.fontFamily);
  });

  it('does nothing without a selected text layer', () => {
    useTextEditor.getState().addBubble('round', 'hi');
    const before = useTextEditor.getState().scene;
    applyPreset(textStylePresets, logoPresetId('pop'));
    expect(useTextEditor.getState().scene).toBe(before);
  });
});
