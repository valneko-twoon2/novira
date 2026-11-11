// @vitest-environment jsdom
// The "Example settings" of the detail view: the examples Civitai keeps settings for, and the button that puts them into the form.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiModel, type CivitaiSample, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { SamplesSection } from './SamplesSection';
import { useBrowse } from './browseStore';

const sample = (over: Partial<CivitaiSample> = {}): CivitaiSample => ({
  id: '1',
  imageUrl: 'https://image.civitai.com/x.jpeg',
  prompt: 'a cozy cafe',
  negativePrompt: 'blurry',
  seed: 1234,
  steps: 28,
  cfgScale: 6,
  width: 832,
  height: 1216,
  clipSkip: 2,
  sampler: 'DPM++ 2M Karras',
  resources: [
    { kind: 'checkpoint', name: null, versionId: '288982', weight: null },
    { kind: 'lora', name: null, versionId: '900001', weight: 0.7 },
  ],
  ...over,
});
const version = { id: '288982', name: 'v9', baseModel: 'SDXL 1.0', createdAt: 0, triggerWords: [], files: [] };
const model = { id: 'm1', name: 'Juggernaut XL', source: 'civitai', kind: 'Checkpoint', versions: [version] } as unknown as CivitaiModel;
const installed: ModelConfig = {
  key: 'main-1',
  name: 'Juggernaut XL v9',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: 'sdxl/main/j.safetensors',
  size: 1,
  source: 'https://civitai.com/models/133005',
  pageUrl: 'https://civitai.com/models/133005?modelVersionId=288982',
};

const initial = { models: useModels.getState(), params: useParams.getState(), toasts: useToasts.getState(), ui: useUi.getState(), browse: useBrowse.getState() };
beforeEach(() => {
  useModels.setState({ ...initial.models, models: [installed] }, true);
  useParams.setState(initial.params, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState({ ...initial.ui, activeTab: 'browse' }, true);
  useBrowse.setState(initial.browse, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderSection = () => render(<SamplesSection model={model} version={version} />);

describe('SamplesSection', () => {
  it('asks for the shown version and lists the examples with their settings and resources', { tags: ['scenario'] }, async () => {
    const ask = vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([sample()]);
    renderSection();
    expect(screen.getByText(t('browse.samples.loading'))).toBeTruthy();
    await screen.findByTestId('browse-sample');
    expect(ask).toHaveBeenCalledWith('288982', false);
    expect(screen.getByText('a cozy cafe')).toBeTruthy();
    expect(screen.getByText(/DPM\+\+ 2M Karras/)).toBeTruthy();
    expect(screen.getByText(/832×1216/)).toBeTruthy();
    // The checkpoint is the model shown (installed); the LoRA is not.
    expect(screen.getByTitle(t('browse.samples.installed')).textContent).toBe('Juggernaut XL');
    expect(screen.getByTitle(t('browse.samples.notInstalled')).textContent).toBe(`${t('browse.samples.versionN', { id: '900001' })} ×0.7`);
  });

  it('asks again for another version, and shows no example of the old one while it loads', { tags: ['regression', 'boundary'] }, async () => {
    const ask = vi.spyOn(backend, 'civitaiSamples').mockResolvedValueOnce([sample()]).mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = renderSection();
    await screen.findByTestId('browse-sample');
    rerender(<SamplesSection model={model} version={{ ...version, id: '999' }} />);
    expect(ask).toHaveBeenLastCalledWith('999', false);
    expect(screen.queryByTestId('browse-sample')).toBeNull();
    expect(screen.getByText(t('browse.samples.loading'))).toBeTruthy();
  });

  it('asks for the mature examples too when mature content is on', { tags: ['scenario'] }, async () => {
    useBrowse.setState({ includeNsfw: true });
    const ask = vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([]);
    renderSection();
    await screen.findByText(t('browse.samples.none'));
    expect(ask).toHaveBeenCalledWith('288982', true);
  });

  it('says so when no example shares its settings', { tags: ['scenario'] }, async () => {
    vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText(t('browse.samples.none'))).toBeTruthy();
    expect(screen.queryByTestId('browse-sample')).toBeNull();
  });

  it('says so when the request fails, and asks again on retry', { tags: ['regression', 'error-guessing'] }, async () => {
    const ask = vi.spyOn(backend, 'civitaiSamples').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([sample()]);
    renderSection();
    await screen.findByText(t('browse.samples.failed'));
    fireEvent.click(screen.getByText(t('browse.status.retry')));
    await screen.findByTestId('browse-sample');
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('puts the settings into the form, opens Generate, and names what is not installed', { tags: ['state-transition', 'scenario'] }, async () => {
    vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([sample()]);
    useParams.setState({ loras: [{ key: 'old', weight: 1, isEnabled: true }] });
    renderSection();
    fireEvent.click(await screen.findByTestId('browse-sample-use'));
    const p = useParams.getState();
    expect(p.positivePrompt).toBe('a cozy cafe');
    expect(p.negativePrompt).toBe('blurry');
    expect([p.seed, p.shouldRandomizeSeed, p.steps, p.cfgScale, p.width, p.height]).toEqual([1234, false, 28, 6, 832, 1216]);
    expect(p.clipSkip).toBe(1);
    expect(p.scheduler).toBe('dpmpp_2m_k');
    expect(p.modelKey).toBe('main-1');
    // The sample used a LoRA that is not installed: the old ones go, and the toast names it.
    expect(p.loras).toEqual([]);
    expect(useUi.getState().activeTab).toBe('generate');
    const toast = useToasts.getState().toasts[0]!;
    expect(toast.status).toBe('warning');
    expect(toast.description).toContain(t('browse.samples.versionN', { id: '900001' }));
  });

  it('reports success without a warning when everything was found', { tags: ['error-guessing', 'scenario'] }, async () => {
    vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([sample({ resources: [{ kind: 'checkpoint', name: null, versionId: '288982', weight: null }] })]);
    renderSection();
    fireEvent.click(await screen.findByTestId('browse-sample-use'));
    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1));
    expect(useToasts.getState().toasts[0]!.status).toBe('success');
  });

  it('leaves the form as it is except for what the sample records', { tags: ['scenario'] }, async () => {
    vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([sample({ negativePrompt: null, seed: null, steps: null, cfgScale: null, width: null, height: null, clipSkip: null, sampler: null, resources: [] })]);
    useParams.setState({ negativePrompt: 'mine', steps: 40, shouldRandomizeSeed: true });
    renderSection();
    fireEvent.click(await screen.findByTestId('browse-sample-use'));
    const p = useParams.getState();
    expect([p.positivePrompt, p.negativePrompt, p.steps, p.shouldRandomizeSeed]).toEqual(['a cozy cafe', 'mine', 40, true]);
    expect(useToasts.getState().toasts[0]!.status).toBe('success');
  });

  it('names a sampler it has no setting for', { tags: ['scenario'] }, async () => {
    vi.spyOn(backend, 'civitaiSamples').mockResolvedValue([sample({ sampler: 'DPM++ 3M SDE Exponential', resources: [] })]);
    renderSection();
    fireEvent.click(await screen.findByTestId('browse-sample-use'));
    expect(useToasts.getState().toasts[0]!.description).toContain('DPM++ 3M SDE Exponential');
  });
});
