import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig, type ModelPartsReport, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { CONFIRM_BYTES, formatPartsSize, installMissingParts, modelPartsReason, offerPartsFor, partsBytes, partsToInstall, refreshModelParts, useModelParts } from './modelParts';
import { useModels } from './models';

const initialParts = useModelParts.getState();
const initialModels = useModels.getState();

const part = (id: string, sizeBytes?: number): StarterModel => ({ id, name: id, base: 'any', type: 'text_encoder', description: '', source: `repo::${id}.safetensors`, sizeBytes });
const report = (missing: StarterModel[], over: Partial<ModelPartsReport> = {}): ModelPartsReport => ({ modelKey: 'anima-1', modelName: 'Anima', missing, unavailable: [], ...over });
const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'anima-1', name: 'Anima', base: 'anima', type: 'diffusion_model', format: 'checkpoint', description: '', path: 'a', size: 1, source: 'civitai:1', ...over });
const queued = (source: string) => ({ id: `job-${source}`, source, name: source, status: 'downloading' as const, bytes: 0, totalBytes: 1 });
const accept = async (source: string) => ({ id: source, source, name: source, status: 'waiting' as const, bytes: 0, totalBytes: 1 });

beforeEach(() => {
  useModelParts.setState(initialParts, true);
  useModels.setState(initialModels, true);
});
afterEach(() => vi.restoreAllMocks());

describe('modelPartsReason', () => {
  it('is null until a report says something is missing', () => {
    expect(modelPartsReason('anima-1')).toBeNull();
    useModelParts.getState().setReport(report([]));
    expect(modelPartsReason('anima-1')).toBeNull();
    expect(modelPartsReason(null)).toBeNull();
  });

  it('names the model and the missing parts', () => {
    useModelParts.getState().setReport(report([part('te'), part('vae')]));
    expect(modelPartsReason('anima-1')).toBe(t('params.readiness.modelNeedsParts', { model: 'Anima', parts: 'te, vae' }));
  });
});

describe('sizes', () => {
  it('sums the known sizes and writes them in decimal units', () => {
    expect(partsBytes([part('a', 1_000_000), part('b'), part('c', 2_500_000)])).toBe(3_500_000);
    expect(formatPartsSize(254_000_000)).toBe('254 MB');
    expect(formatPartsSize(1_190_000_000)).toBe('1.2 GB');
    expect(formatPartsSize(10)).toBe('1 MB');
  });
});

describe('partsToInstall', () => {
  it('leaves out parts that are installed or on their way', () => {
    useModels.setState({ models: [model({ key: 'te', source: 'repo::te.safetensors' })], installJobs: [queued('repo::vae.safetensors')] });
    expect(partsToInstall(report([part('te'), part('vae'), part('other')])).map((p) => p.id)).toEqual(['other']);
  });
});

describe('installMissingParts', () => {
  it('starts every missing part at once when the download is small', async () => {
    const install = vi.spyOn(backend, 'installModel').mockImplementation(accept);
    await installMissingParts(report([part('te', 1_000_000_000), part('vae', 254_000_000)]));
    expect(install.mock.calls.map((c) => c[0])).toEqual(['repo::te.safetensors', 'repo::vae.safetensors']);
    expect(useModelParts.getState().offer).toBeNull();
  });

  it('asks first when the download is above the limit, and installs nothing yet', async () => {
    const install = vi.spyOn(backend, 'installModel');
    const big = report([part('te', CONFIRM_BYTES + 1)]);
    await installMissingParts(big);
    expect(install).not.toHaveBeenCalled();
    expect(useModelParts.getState().offer).toBe(big);
  });

  it('does not ask at exactly the limit', async () => {
    const install = vi.spyOn(backend, 'installModel').mockImplementation(accept);
    await installMissingParts(report([part('te', CONFIRM_BYTES)]));
    expect(install).toHaveBeenCalledTimes(1);
    expect(useModelParts.getState().offer).toBeNull();
  });

  it('does nothing when every part is already being installed', async () => {
    const install = vi.spyOn(backend, 'installModel');
    useModels.setState({ installJobs: [queued('repo::te.safetensors')] });
    await installMissingParts(report([part('te')]));
    expect(install).not.toHaveBeenCalled();
  });
});

describe('offerPartsFor', () => {
  it('offers the install of what an added model lacks', async () => {
    const r = report([part('te', 1000)]);
    vi.spyOn(backend, 'modelParts').mockResolvedValue(r);
    await offerPartsFor(model({}));
    expect(useModelParts.getState().offer).toEqual(r);
    expect(useModelParts.getState().reports['anima-1']).toEqual(r);
  });

  it('offers nothing when nothing is missing', async () => {
    vi.spyOn(backend, 'modelParts').mockResolvedValue(report([]));
    await offerPartsFor(model({}));
    expect(useModelParts.getState().offer).toBeNull();
  });

  it('offers nothing when the missing parts are already being installed', async () => {
    vi.spyOn(backend, 'modelParts').mockResolvedValue(report([part('te')]));
    useModels.setState({ installJobs: [queued('repo::te.safetensors')] });
    await offerPartsFor(model({}));
    expect(useModelParts.getState().offer).toBeNull();
  });

  it('does not ask the backend about a file that is not a main or diffusion model', async () => {
    const ask = vi.spyOn(backend, 'modelParts');
    await offerPartsFor(model({ type: 'lora' }));
    await offerPartsFor(model({ type: 'vae' }));
    expect(ask).not.toHaveBeenCalled();
  });

  it('stays quiet when the check fails', async () => {
    vi.spyOn(backend, 'modelParts').mockRejectedValue(new Error('gone'));
    await offerPartsFor(model({}));
    expect(useModelParts.getState().offer).toBeNull();
    expect(await refreshModelParts('anima-1')).toBeNull();
  });
});
