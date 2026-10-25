// @vitest-environment jsdom
// Smaller Generate-settings pieces: Advanced and High-resolution accordions, aspect buttons, LoRA cards, recommended hints, builder registration.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { ModelProfilePopover } from '../model/ModelProfileChips';
import { RecommendedHint } from '../model/RecommendedHint';
import { LoraPicker } from '../model/LoraPicker';
import { SCHEDULER_LABELS } from '../labels';
import { registerParamsFeature } from '../register';
import { AdvancedSection } from './AdvancedSection';
import { AspectControls, AspectPreview } from './AspectControls';
import { GenerationSection } from './GenerationSection';
import { HiresSection } from './HiresSection';

const initial = { params: useParams.getState(), models: useModels.getState() };
const state = () => useParams.getState();
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);
const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'] = 'sdxl', extra: Partial<ModelConfig> = {}): ModelConfig =>
  ({ key, name: key, type, base, format: 'diffusers', description: '', path: '', size: 0, source: '', ...extra }) as ModelConfig;

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
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdvancedSection', () => {
  const openSection = () => {
    show(<AdvancedSection />);
    fireEvent.click(screen.getByText(t('params.advanced.title')));
  };

  it('picks a VAE and falls back to the default, and switches the VAE precision', () => {
    useModels.setState({ models: [model('main1', 'main'), model('vae1', 'vae')] });
    useParams.setState({ modelKey: 'main1' });
    openSection();
    choose(t('params.advanced.vae'), 'vae1');
    expect(state().vaeKey).toBe('vae1');
    choose(t('params.advanced.vae'), t('params.advanced.vaeDefault'));
    expect(state().vaeKey).toBeNull();
    choose(t('params.advanced.vaePrecision'), 'FP16');
    expect(state().vaePrecision).toBe('fp16');
  });

  it('edits CFG rescale, rounds the CLIP skip and toggles seamless tiling', () => {
    useModels.setState({ models: [model('main1', 'main')] });
    useParams.setState({ modelKey: 'main1' });
    openSection();
    setNum(t('params.advanced.cfgRescale'), 0.4);
    setNum(t('params.advanced.clipSkip'), 3);
    fireEvent.click(screen.getByLabelText(t('params.advanced.seamlessX')));
    fireEvent.click(screen.getByLabelText(t('params.advanced.seamlessY')));
    expect(state()).toMatchObject({ cfgRescale: 0.4, clipSkip: 3, seamlessX: true, seamlessY: true });
  });

  it('hides CFG rescale and CLIP skip for FLUX', () => {
    useModels.setState({ models: [model('flux1', 'main', 'flux')] });
    useParams.setState({ modelKey: 'flux1' });
    openSection();
    expect(screen.queryByLabelText(t('params.advanced.cfgRescale'))).toBeNull();
    expect(screen.queryByLabelText(t('params.advanced.clipSkip'))).toBeNull();
  });

  it('summarises the changed settings in badges', () => {
    useModels.setState({ models: [model('main1', 'main'), model('vae1', 'vae')] });
    useParams.setState({ modelKey: 'main1', vaeKey: 'vae1', vaePrecision: 'fp16', cfgRescale: 0.3, clipSkip: 2, seamlessX: true, seamlessY: true });
    show(<AdvancedSection />);
    expect(screen.getByText(t('params.advanced.badgeVae', { name: 'vae1' }))).toBeTruthy();
    expect(screen.getByText(t('params.advanced.badgeSeamlessXY'))).toBeTruthy();
    act(() => state().set({ seamlessY: false }));
    expect(screen.getByText(t('params.advanced.badgeSeamlessX'))).toBeTruthy();
    act(() => state().set({ seamlessX: false, seamlessY: true }));
    expect(screen.getByText(t('params.advanced.badgeSeamlessY'))).toBeTruthy();
  });
});

describe('HiresSection', () => {
  it('stays disabled until switched on, then edits scale, strength, method and steps', () => {
    useModels.setState({ models: [model('main1', 'main'), model('up1', 'spandrel_image_to_image')] });
    useParams.setState({ modelKey: 'main1' });
    show(<HiresSection />);
    fireEvent.click(screen.getByText(t('params.hires.title')));
    expect(screen.queryByTestId('hires-output')).toBeNull();
    fireEvent.click(screen.getByLabelText(t('params.hires.enable')));
    expect(state().hires.enabled).toBe(true);
    setNum(t('params.hires.scale'), 1.5);
    setNum(t('params.hires.strength'), 0.4);
    setNum(t('params.hires.steps'), 10.4);
    choose(t('params.hires.method'), 'up1');
    expect(state().hires).toMatchObject({ scale: 1.5, strength: 0.4, steps: 10, upscaleModelKey: 'up1' });
    choose(t('params.hires.method'), t('params.hires.methodSmooth'));
    expect(state().hires.upscaleModelKey).toBeNull();
    expect(screen.getByTestId('hires-output').textContent).toBe(t('params.hires.output', { width: state().width * 1.5, height: state().height * 1.5, steps: 10 }));
  });

  it('says the steps are shared when the second pass has none, and shows size warnings only while enabled', () => {
    useModels.setState({ models: [model('main1', 'main')] });
    useParams.setState({ modelKey: 'main1', width: 4096, height: 4096 });
    state().setHires({ enabled: true, steps: 0 });
    show(<HiresSection />);
    expect(screen.getByTestId('hires-output').textContent).toContain(String(state().hires.scale * 4096));
    expect(screen.getByTestId('hires-output').textContent).toBe(t('params.hires.outputSameSteps', { width: 4096 * state().hires.scale, height: 4096 * state().hires.scale }));
  });
});

describe('HiresSection warnings', () => {
  it('warns when the enlarged size is beyond what the model draws well, only while enabled', () => {
    useModels.setState({ models: [model('main1', 'main', 'sd-1')] });
    useParams.setState({ modelKey: 'main1', width: 1024, height: 1024 });
    state().setHires({ enabled: true, scale: 2 });
    registerParamsFeature();
    show(<HiresSection />);
    expect(screen.getByRole('status').textContent).toContain('2048');
    fireEvent.click(screen.getByLabelText(t('params.hires.enable')));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('AspectControls', () => {
  it('changes the ratio, swaps the sides, toggles the lock and picks the optimal size', () => {
    useModels.setState({ models: [model('main1', 'main', 'sd-1')] });
    useParams.setState({ modelKey: 'main1', width: 512, height: 768, aspectRatio: 'free', aspectLocked: false });
    show(<AspectControls />);
    fireEvent.click(screen.getByLabelText(t('params.image.swap')));
    expect([state().width, state().height]).toEqual([768, 512]);
    fireEvent.click(screen.getByLabelText(t('params.image.lock')));
    expect(state().aspectLocked).toBe(true);
    fireEvent.click(screen.getByLabelText(t('params.image.unlock')));
    expect(state().aspectLocked).toBe(false);
    fireEvent.click(screen.getByLabelText(t('params.image.optimal')));
    expect(Math.max(state().width, state().height)).toBeLessThanOrEqual(1024);
    choose(t('params.image.aspect'), '1:1');
    expect(state().aspectRatio).toBe('1:1');
    expect(state().width).toBe(state().height);
  });

  it('draws the preview box for wide and tall pictures', () => {
    useParams.setState({ width: 200, height: 100 });
    const { container } = render(<AspectPreview />);
    const box = () => container.querySelector<HTMLElement>('.pp-aspect__box')!;
    expect(box().style.height).toBe('50%');
    act(() => state().set({ width: 100, height: 200 }));
    expect(box().style.width).toBe('50%');
    expect(box().textContent).toBe('100×200');
  });
});

describe('LoraPicker', () => {
  const lora = model('lora1', 'lora', 'sdxl', { triggerPhrases: ['mia style'] });

  it('adds a LoRA, edits its weight, inserts a trigger word, disables and removes it', () => {
    useModels.setState({ models: [model('main1', 'main'), lora] });
    useParams.setState({ modelKey: 'main1', positivePrompt: '' });
    show(<LoraPicker />);
    fireEvent.click(screen.getByTestId('lora-picker'));
    fireEvent.click(screen.getByText('lora1'));
    expect(state().loras).toEqual([{ key: 'lora1', weight: 0.75, isEnabled: true }]);
    const card = screen.getByTestId('lora-card');
    setNum(t('params.lora.weight'), 1.2);
    expect(state().loras[0]!.weight).toBe(1.2);
    expect(within(card).queryByText('mia style')).toBeNull();
    fireEvent.click(within(card).getByTestId('lora-triggers'));
    fireEvent.click(screen.getByText('mia style'));
    expect(state().positivePrompt).toBe('mia style');
    fireEvent.click(screen.getByText('mia style'));
    expect(state().positivePrompt).toBe('mia style');
    fireEvent.click(screen.getByLabelText(t('params.lora.enabled')));
    expect(state().loras[0]!.isEnabled).toBe(false);
    expect(card.className).toContain('is-disabled');
    fireEvent.click(screen.getByLabelText(t('params.lora.remove')));
    expect(screen.queryByTestId('lora-card')).toBeNull();
  });

  it('adds every trigger word of a long list at once, keeping the prompt it has and skipping the ones already in it', () => {
    const many = model('lora2', 'lora', 'sdxl', { triggerPhrases: ['a, b', 'c', 'd'] });
    useModels.setState({ models: [model('main1', 'main'), many] });
    useParams.setState({ modelKey: 'main1', positivePrompt: 'cat, c', loras: [{ key: 'lora2', weight: 1, isEnabled: true }] });
    show(<LoraPicker />);
    fireEvent.click(screen.getByTestId('lora-triggers'));
    fireEvent.click(screen.getByText(t('params.lora.triggerAll')));
    expect(state().positivePrompt).toBe('cat, c, a, b, d');
  });

  it('marks a LoRA of another base as incompatible and keeps the raw key for an unknown one', () => {
    useModels.setState({ models: [model('main1', 'main'), model('sd1lora', 'lora', 'sd-1')] });
    useParams.setState({ modelKey: 'main1', loras: [{ key: 'sd1lora', weight: 1, isEnabled: true }, { key: 'ghost', weight: 1, isEnabled: true }] });
    show(<LoraPicker />);
    const cards = screen.getAllByTestId('lora-card');
    expect(cards[0]!.className).toContain('is-invalid');
    expect(cards[1]!.className).not.toContain('is-invalid');
    expect(within(cards[1]!).getByText('ghost')).toBeTruthy();
  });

  it('is disabled when no LoRA is left to add', () => {
    useModels.setState({ models: [model('main1', 'main')] });
    useParams.setState({ modelKey: 'main1' });
    show(<LoraPicker />);
    expect((screen.getByTestId('lora-picker') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('RecommendedHint', () => {
  const main = model('main1', 'main', 'sdxl', { defaultSettings: { steps: 30, cfgScale: 5, scheduler: 'euler', width: 832, height: 1216 } });

  it('renders nothing without a main model', () => {
    const { container } = show(<RecommendedHint k="steps" />);
    expect(container.textContent).toBe('');
  });

  it('applies the recommended value when the setting differs, and confirms when it matches', () => {
    useModels.setState({ models: [main] });
    useParams.setState({ modelKey: 'main1', steps: 5, cfgScale: 12, scheduler: 'euler_a', width: 64, height: 64 });
    const { container, rerender } = show(
      <>
        <RecommendedHint k="steps" />
        <RecommendedHint k="cfg" />
        <RecommendedHint k="scheduler" />
        <RecommendedHint k="width" />
        <RecommendedHint k="height" />
      </>,
    );
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.pp-rec__apply'));
    expect(buttons()).toHaveLength(5);
    expect(buttons()[2]!.textContent).toContain(SCHEDULER_LABELS.euler);
    buttons().forEach((b) => fireEvent.click(b));
    expect(state()).toMatchObject({ steps: 30, cfgScale: 5, scheduler: 'euler', width: 832, height: 1216, aspectRatio: 'free' });
    expect(buttons()).toHaveLength(0);
    expect(container.querySelectorAll('.pp-rec__ok')).toHaveLength(5);
    rerender(<TooltipProvider><RecommendedHint k="steps" /></TooltipProvider>);
    act(() => state().set({ steps: 31 }));
    expect(container.querySelector('.pp-rec__ok')).not.toBeNull();
  });
});

describe('ModelProfilePopover', () => {
  const anima = model('anima1', 'main', 'anima');

  it('says when the steps are too few or too many, with the bound that was crossed', () => {
    useModels.setState({ models: [anima] });
    useParams.setState({ modelKey: 'anima1', steps: 17, cfgScale: 4.5, scheduler: 'euler', width: 1024, height: 1024 });
    const { rerender } = show(<ModelProfilePopover model={anima} />);
    expect(screen.getByTestId('model-profile-trigger').getAttribute('title')).toBe(t('params.profile.mismatch.stepsLow', { value: 30, min: 24 }));
    act(() => state().set({ steps: 60 }));
    rerender(<TooltipProvider><ModelProfilePopover model={anima} /></TooltipProvider>);
    expect(screen.getByTestId('model-profile-trigger').getAttribute('title')).toBe(t('params.profile.mismatch.stepsHigh', { value: 30, max: 38 }));
    act(() => state().set({ steps: 24 }));
    expect(screen.getByTestId('model-profile-trigger').getAttribute('title')).toBe(t('params.profile.matches'));
  });
});

describe('GenerationSection scheduler', () => {
  it('shows the sampling an Anima model always runs, read-only, and the choice for an SDXL model', () => {
    const anima = model('anima1', 'main', 'anima');
    const xl = model('xl1', 'main', 'sdxl');
    useModels.setState({ models: [anima, xl] });
    useParams.setState({ modelKey: 'anima1', scheduler: 'euler_a' });
    const { rerender } = show(<GenerationSection showLoras={false} />);
    expect(screen.getByTestId('sampling-fixed').textContent).toBe('euler / simple');
    expect(screen.getByText(t('params.generation.samplingFixed', { family: 'Anima' }))).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: t('params.generation.scheduler') })).toBeNull();
    act(() => state().set({ modelKey: 'xl1' }));
    rerender(<TooltipProvider><GenerationSection showLoras={false} /></TooltipProvider>);
    expect(screen.queryByTestId('sampling-fixed')).toBeNull();
    expect(screen.getByLabelText(t('params.generation.scheduler'))).toBeTruthy();
  });

  it('does not count the unused scheduler setting as off the recommended values', () => {
    const anima = model('anima1', 'main', 'anima');
    useModels.setState({ models: [anima] });
    useParams.setState({ modelKey: 'anima1', steps: 30, cfgScale: 4.5, scheduler: 'euler_a', width: 1024, height: 1024 });
    show(<ModelProfilePopover model={anima} />);
    expect(screen.getByTestId('model-profile-trigger').getAttribute('title')).toBe(t('params.profile.matches'));
  });
});
