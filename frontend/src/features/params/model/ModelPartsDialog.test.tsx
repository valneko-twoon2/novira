// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelPartsReport } from '@/backend';
import { t } from '@/i18n';
import { useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { ModelPartsDialog } from './ModelPartsDialog';

const initialParts = useModelParts.getState();
const initialModels = useModels.getState();
const part = (id: string, sizeBytes: number) => ({ id, name: id, base: 'any' as const, type: 'text_encoder' as const, description: '', source: `repo::${id}.safetensors`, sizeBytes });
const report: ModelPartsReport = { modelKey: 'k', modelName: 'Anima', missing: [part('te', 1_190_000_000), part('vae', 254_000_000)], unavailable: ['the SD3 VAE (sd3_vae.safetensors)'] };

beforeEach(() => {
  useModelParts.setState(initialParts, true);
  useModels.setState(initialModels, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ModelPartsDialog', () => {
  it('renders nothing while there is no offer', () => {
    render(<ModelPartsDialog />);
    expect(screen.queryByTestId('model-parts-dialog')).toBeNull();
  });

  it('lists the parts with their sizes and the total, and installs them on confirm', async () => {
    const install = vi.spyOn(backend, 'installModel').mockImplementation(async (source) => ({ id: source, source, name: source, status: 'waiting', bytes: 0, totalBytes: 1 }));
    useModelParts.getState().openOffer(report);
    render(<ModelPartsDialog />);
    expect(screen.getAllByTestId('model-parts-item').map((li) => li.textContent)).toEqual(['te1.2 GB', 'vae254 MB']);
    expect(screen.getByText(t('params.parts.total', { size: '1.4 GB' }))).toBeTruthy();
    expect(screen.getByText(t('params.parts.unavailable', { list: 'the SD3 VAE (sd3_vae.safetensors)' }))).toBeTruthy();
    expect(screen.queryByText(t('params.parts.large'))).toBeNull();
    fireEvent.click(screen.getByTestId('model-parts-install'));
    expect(install).toHaveBeenCalledTimes(2);
    expect(useModelParts.getState().offer).toBeNull();
  });

  it('warns about a large download, and "not now" closes without installing', async () => {
    const install = vi.spyOn(backend, 'installModel');
    useModelParts.getState().openOffer({ ...report, missing: [part('big', 9_380_000_000)] });
    render(<ModelPartsDialog />);
    expect(screen.getByText(t('params.parts.large'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('model-parts-later'));
    expect(install).not.toHaveBeenCalled();
    expect(useModelParts.getState().offer).toBeNull();
  });
});
