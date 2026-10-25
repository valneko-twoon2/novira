// @vitest-environment jsdom
// The recall list of the picture viewer: each stored setting, with a button that puts it back into the Generate settings,
// and a copy button on the prompts.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationMetadata, ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { RecallParameters } from './RecallParameters';

const initial = { params: useParams.getState(), models: useModels.getState(), toasts: useToasts.getState() };

const metadata = (over: Partial<GenerationMetadata> = {}): GenerationMetadata =>
  ({
    generationMode: 'txt2img',
    positivePrompt: 'a cat',
    negativePrompt: '',
    modelKey: 'm1',
    modelName: 'Model One',
    vaeKey: null,
    seed: 42,
    steps: 20,
    cfgScale: 6,
    cfgRescale: 0,
    scheduler: 'euler',
    width: 640,
    height: 960,
    clipSkip: 1,
    seamlessX: false,
    seamlessY: false,
    loras: [],
    ...over,
  }) as GenerationMetadata;
const show = (m: GenerationMetadata | null, onCopy: (text: string) => void = () => {}) =>
  render(
    <TooltipProvider>
      <RecallParameters image={{ name: 'a.png', metadata: m } as ImageDTO} onCopy={onCopy} />
    </TooltipProvider>,
  );
const row = (label: Parameters<typeof t>[0]) => screen.getByText(t(label)).closest('.vrecall__row') as HTMLElement;
const recall = (label: Parameters<typeof t>[0]) => fireEvent.click(within(row(label)).getByLabelText(t('gallery.meta.recall', { name: t(label) })));

beforeEach(() => {
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useToasts.setState(initial.toasts, true);
});
afterEach(cleanup);

describe('RecallParameters', () => {
  it('says so when the picture has no stored settings', () => {
    show(null);
    expect(screen.getByText(t('gallery.meta.none'))).toBeTruthy();
  });

  it('lists the settings and recalls each one alone', () => {
    useModels.setState({ models: [{ key: 'm1', name: 'Model One', type: 'main', base: 'sdxl', path: '' } as never] });
    show(metadata({ negativePrompt: 'blurry' }));
    recall('gallery.meta.positivePrompt');
    expect(useParams.getState().positivePrompt).toBe('a cat');
    recall('gallery.meta.negativePrompt');
    expect(useParams.getState().negativePrompt).toBe('blurry');
    recall('gallery.meta.model');
    expect(useParams.getState().modelKey).toBe('m1');
    recall('gallery.meta.seed');
    expect(useParams.getState()).toMatchObject({ seed: 42, shouldRandomizeSeed: false });
    recall('gallery.meta.steps');
    recall('gallery.meta.cfgScale');
    recall('gallery.meta.cfgRescale');
    recall('gallery.meta.scheduler');
    recall('gallery.meta.clipSkip');
    recall('gallery.meta.vae');
    expect(useParams.getState()).toMatchObject({ steps: 20, cfgScale: 6, scheduler: 'euler', clipSkip: 1, vaeKey: null });
    recall('gallery.meta.size');
    expect(useParams.getState()).toMatchObject({ width: 640, height: 960, aspectRatio: 'free' });
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('info');
    expect(screen.getByText('640×960')).toBeTruthy();
    expect(screen.getByText(t('gallery.meta.defaultVae'))).toBeTruthy();
  });

  it('shows the sampling that ran in place of the unused scheduler setting, with nothing to recall', () => {
    show(metadata({ scheduler: 'euler_a', sampling: { sampler: 'euler', scheduler: 'simple' } }));
    expect(screen.queryByText(t('gallery.meta.scheduler'))).toBeNull();
    const r = row('gallery.meta.sampling');
    expect(r.textContent).toContain('euler / simple');
    expect(within(r).queryByRole('button')).toBeNull();
  });

  it('finds the model by its name, and keeps the current one when none is installed', () => {
    useModels.setState({ models: [{ key: 'wai', name: 'waiIllustriousSDXL_v170', type: 'main', base: 'sdxl', path: '' } as never] });
    useParams.setState({ modelKey: 'current' });
    show(metadata({ modelKey: '', modelName: 'WAI-illustrious-SDXL-v17' }));
    recall('gallery.meta.model');
    expect(useParams.getState().modelKey).toBe('wai');
    expect(useToasts.getState().toasts.at(-1)?.description).toBe(t('gallery.toast.recallModelByName', { name: 'waiIllustriousSDXL_v170' }));
    cleanup();
    useParams.setState({ modelKey: 'current' });
    show(metadata({ modelKey: '', modelName: 'ponyDiffusionV6XL' }));
    recall('gallery.meta.model');
    expect(useParams.getState().modelKey).toBe('current');
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'warning', description: t('gallery.toast.recallModelMissing', { name: 'ponyDiffusionV6XL' }) });
  });

  it('copies each prompt as written, and only the prompts', () => {
    const onCopy = vi.fn();
    show(metadata({ positivePrompt: 'a cat, sitting', negativePrompt: 'blurry' }), onCopy);
    const copy = (label: Parameters<typeof t>[0]) => within(row(label)).getByLabelText(t('gallery.meta.copy', { name: t(label) }));
    fireEvent.click(copy('gallery.meta.positivePrompt'));
    expect(onCopy).toHaveBeenLastCalledWith('a cat, sitting');
    fireEvent.click(copy('gallery.meta.negativePrompt'));
    expect(onCopy).toHaveBeenLastCalledWith('blurry');
    expect(useParams.getState().positivePrompt).toBe(initial.params.positivePrompt);
    expect(within(row('gallery.meta.seed')).queryByLabelText(t('gallery.meta.copy', { name: t('gallery.meta.seed') }))).toBeNull();
  });

  it('shows the generation mode without a recall button', () => {
    show(metadata());
    expect(within(row('gallery.meta.generationMode')).queryByRole('button')).toBeNull();
    expect(screen.queryByText(t('gallery.meta.negativePrompt'))).toBeNull();
  });

  it('shows and recalls seamless tiling, strength, the high-resolution fix and each LoRA', () => {
    useModels.setState({ models: [{ key: 'l1', name: 'Style LoRA', type: 'lora' } as never] });
    useParams.setState({ loras: [{ key: 'l1', weight: 0.2 } as never, { key: 'other', weight: 1 } as never] });
    show(
      metadata({
        seamlessX: true,
        seamlessY: true,
        strength: 0.6,
        hiresFix: { scale: 1.5, strength: 0.4 } as never,
        loras: [{ key: 'l1', weight: 0.8 } as never, { key: 'gone', weight: 1 } as never],
      }),
    );
    expect(screen.getByText('X / Y')).toBeTruthy();
    recall('gallery.meta.seamless');
    expect(useParams.getState()).toMatchObject({ seamlessX: true, seamlessY: true });
    recall('gallery.meta.strength');
    expect(useParams.getState().strength).toBe(0.6);
    recall('gallery.meta.hiresFix');
    expect(useParams.getState().hires.enabled).toBe(true);
    expect(screen.getByText('Style LoRA (0.8)')).toBeTruthy();
    expect(screen.getByText('gone (1)')).toBeTruthy();
    fireEvent.click(within(screen.getByText('Style LoRA (0.8)').closest('.vrecall__row') as HTMLElement).getByRole('button'));
    expect(useParams.getState().loras.map((l) => [l.key, l.weight])).toEqual([['other', 1], ['l1', 0.8]]);
  });

  it('shows the settings of upscales and workflow pictures, which cannot be recalled', () => {
    show(metadata({ upscaleScale: 4, creativity: 0.3, structure: 0.5, workflowName: 'My flow' }));
    expect(screen.getByText('×4')).toBeTruthy();
    expect(screen.getByText('My flow')).toBeTruthy();
    expect(within(row('gallery.meta.upscaleScale')).queryByRole('button')).toBeNull();
    expect(within(row('gallery.meta.workflow')).queryByRole('button')).toBeNull();
  });
});
