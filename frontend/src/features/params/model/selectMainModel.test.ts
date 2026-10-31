// Selecting a main model: its own defaults are applied, and settings that do not fit its base are dropped (the picture
// prompts and the LoRAs of another family). "Apply recommended" sets the profile's values too.
import { beforeEach, describe, expect, it } from 'vitest';
import type { BaseModel, ModelConfig } from '@/backend';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { applyRecommended, selectMainModel } from './selectMainModel';
import { modelProfile } from './modelProfile';

const model = (key: string, base: BaseModel, type: ModelConfig['type'] = 'main', defaults?: ModelConfig['defaultSettings']): ModelConfig => ({
  key,
  name: key,
  base,
  type,
  format: 'checkpoint',
  description: '',
  path: '',
  size: 0,
  source: '',
  defaultSettings: defaults,
});

const initial = useParams.getState();

beforeEach(() => {
  useParams.setState(initial, true);
  useToasts.setState({ toasts: [] });
  useModels.setState({
    models: [
      model('main-xl', 'sdxl'),
      model('vae-xl', 'sdxl', 'vae'),
      model('vae-flux', 'flux', 'vae'),
      model('lora-xl', 'sdxl', 'lora'),
      model('lora-flux', 'flux', 'lora'),
      model('lora-any', 'any', 'lora'),
      model('ip-xl', 'sdxl', 'ip_adapter'),
      model('main-flux', 'flux'),
    ],
  });
});

describe('selecting a main model', () => {
  it('applies its own defaults and takes the aspect ratio of its size', () => {
    selectMainModel(model('tuned', 'sdxl', 'main', { steps: 30, cfgScale: 4.5, scheduler: 'euler_a', width: 768, height: 1024 }));
    expect(useParams.getState()).toMatchObject({ modelKey: 'tuned', steps: 30, cfgScale: 4.5, scheduler: 'euler_a', width: 768, height: 1024, aspectRatio: '3:4' });
  });

  it('takes no ratio for a size that is near none of the fixed ones', () => {
    selectMainModel(model('tall', 'sdxl', 'main', { width: 832, height: 1216 }));
    expect(useParams.getState()).toMatchObject({ width: 832, height: 1216, aspectRatio: 'free' });
  });

  it('only changes the model when it has no defaults of its own', () => {
    useParams.setState({ steps: 12 });
    selectMainModel(model('plain', 'sdxl'));
    expect(useParams.getState()).toMatchObject({ modelKey: 'plain', steps: 12 });
  });

  it('keeps the settings when the base stays the same', () => {
    useParams.setState({ modelKey: 'main-xl', vaeKey: 'vae-xl', loras: [{ key: 'lora-flux', weight: 1, isEnabled: true }] });
    selectMainModel(model('other-xl', 'sdxl'));
    expect(useParams.getState()).toMatchObject({ vaeKey: 'vae-xl', loras: [{ key: 'lora-flux', weight: 1, isEnabled: true }] });
  });

  it('drops the VAE and the LoRAs of another base, keeps the ones that fit and those for any base, and says how many went', () => {
    useParams.setState({
      modelKey: 'main-flux',
      vaeKey: 'vae-flux',
      loras: [
        { key: 'lora-xl', weight: 1, isEnabled: true },
        { key: 'lora-flux', weight: 0.5, isEnabled: true },
        { key: 'lora-any', weight: 0.7, isEnabled: false },
      ],
    });
    selectMainModel(model('main-xl2', 'sdxl'));
    const p = useParams.getState();
    expect(p.vaeKey).toBeNull();
    expect(p.loras.map((l) => l.key)).toEqual(['lora-xl', 'lora-any']);
    expect(useToasts.getState().toasts).toHaveLength(1);
  });

  it('is quiet about dropped LoRAs when asked to be', () => {
    useParams.setState({ modelKey: 'main-flux', loras: [{ key: 'lora-flux', weight: 1, isEnabled: true }] });
    selectMainModel(model('main-xl2', 'sdxl'), { quiet: true });
    expect(useParams.getState().loras).toEqual([]);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('replaces a reference image whose model does not fit with the first IP adapter of the new base', () => {
    const ref = (modelKey: string | null) => ({ id: modelKey ?? 'none', isEnabled: true, imageName: 'a.png', imageUrl: null, modelKey, weight: 1, beginEnd: [0, 1], method: 'full' }) as never;
    useParams.setState({ modelKey: 'main-flux', refImages: [ref('lora-flux'), ref('ip-xl'), ref(null)] });
    selectMainModel(model('main-xl2', 'sdxl'));
    expect(useParams.getState().refImages.map((r) => r.modelKey)).toEqual(['ip-xl', 'ip-xl', null]);
  });

  it('clears the tile ControlNet of the upscale when it does not fit the new base', () => {
    useParams.setState({ modelKey: 'main-flux', upscale: { ...initial.upscale, tileControlnetModelKey: 'lora-flux' } });
    selectMainModel(model('main-xl2', 'sdxl'));
    expect(useParams.getState().upscale.tileControlnetModelKey).toBeNull();
  });
});

describe('applying the recommended settings', () => {
  it('selects the model and sets the values of its profile, with the aspect ratio of the profile size', () => {
    const tuned = model('tuned', 'sdxl', 'main', { steps: 25, width: 1024, height: 1024 });
    applyRecommended(tuned);
    const profile = modelProfile(tuned);
    expect(useParams.getState()).toMatchObject({
      modelKey: 'tuned',
      steps: profile.steps,
      cfgScale: profile.cfgScale,
      scheduler: profile.scheduler,
      width: profile.width,
      height: profile.height,
      aspectRatio: '1:1',
    });
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
