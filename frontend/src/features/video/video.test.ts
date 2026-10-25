import { beforeEach, describe, expect, it } from 'vitest';
import { FAST_MODEL_KEY, buildVideoRequest } from './buildRequest';
import { VIDEO_FAMILY_PRESETS, VIDEO_PRESETS, useVideo } from '@/state/media/video';
import { useModels } from '@/state/models';
import type { ModelConfig } from '@/backend';

describe('the video models', () => {
  beforeEach(() => useVideo.setState({ form: { ...useVideo.getState().form, model: 'standard', ...VIDEO_PRESETS.standard } }));

  it('asks the backend for the fast model only when it is picked', () => {
    expect(buildVideoRequest(useVideo.getState().form).params.modelKey).toBe('');
    useVideo.getState().setForm({ model: 'fast', ...VIDEO_PRESETS.fast });
    const p = buildVideoRequest(useVideo.getState().form).params;
    expect(p.modelKey).toBe(FAST_MODEL_KEY);
    expect(p.steps).toBe(4);
    expect(p.cfgScale).toBe(1);
  });

  it('sends the small-GPU switches only when they are on', () => {
    const plain = buildVideoRequest(useVideo.getState().form).params;
    expect(plain.videoFp8).toBeUndefined();
    expect(plain.videoTiledDecode).toBeUndefined();
    useVideo.getState().setForm({ fp8: true, tiledDecode: true });
    const light = buildVideoRequest(useVideo.getState().form).params;
    expect(light).toMatchObject({ videoFp8: true, videoTiledDecode: true });
    useVideo.getState().setForm({ fp8: false, tiledDecode: false });
  });

  it('keeps the fast model inside what the form allows', () => {
    expect(VIDEO_PRESETS.fast.steps).toBeGreaterThanOrEqual(4);
    expect(VIDEO_PRESETS.fast.cfgScale).toBeGreaterThanOrEqual(1);
  });
});

describe('an installed video model', () => {
  const wan = { key: 'wan-1', name: 'wan2.1_t2v_1.3B', base: 'wan', type: 'diffusion_model', format: 'checkpoint', description: '', path: 'p', size: 1, source: 'local' } as ModelConfig;
  beforeEach(() => {
    useModels.setState({ models: [wan] });
    useVideo.setState({ form: { ...useVideo.getState().form, model: 'standard', modelKey: null, ...VIDEO_PRESETS.standard } });
  });

  it('is sent by its key and name instead of the pack model', () => {
    useVideo.getState().setForm({ modelKey: 'wan-1' });
    const p = buildVideoRequest(useVideo.getState().form).params;
    expect(p.modelKey).toBe('wan-1');
    expect(p.modelName).toBe('wan2.1_t2v_1.3B');
  });

  it('falls back to the pack model when the installed one is gone', () => {
    useVideo.getState().setForm({ modelKey: 'removed' });
    expect(buildVideoRequest(useVideo.getState().form).params.modelKey).toBe('');
  });

  it('has settings for each family the backend runs', () => {
    expect(Object.keys(VIDEO_FAMILY_PRESETS).sort()).toEqual(['hunyuan-video', 'hunyuan-video-15', 'ltx-video', 'ltx2', 'wan']);
    for (const p of Object.values(VIDEO_FAMILY_PRESETS)) {
      expect(p.steps).toBeGreaterThanOrEqual(4);
      expect(p.width % 16).toBe(0);
      expect(p.height % 16).toBe(0);
    }
  });
});
