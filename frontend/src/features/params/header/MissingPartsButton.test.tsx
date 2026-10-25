// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelPartsReport } from '@/backend';
import { t } from '@/i18n';
import { useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { MissingPartsButton } from './MissingPartsButton';

const initialParts = useModelParts.getState();
const initialModels = useModels.getState();
const part = (id: string, sizeBytes: number) => ({ id, name: id, base: 'any' as const, type: 'text_encoder' as const, description: '', source: `repo::${id}.safetensors`, sizeBytes });
const small: ModelPartsReport = { modelKey: 'k', modelName: 'Anima', missing: [part('te', 1_190_000_000), part('vae', 254_000_000)], unavailable: [] };

beforeEach(() => {
  useModelParts.setState(initialParts, true);
  useModels.setState(initialModels, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MissingPartsButton', () => {
  it('shows the total size and installs exactly the missing parts in place', async () => {
    const install = vi.spyOn(backend, 'installModel').mockImplementation(async (source) => ({ id: source, source, name: source, status: 'waiting', bytes: 0, totalBytes: 1 }));
    render(<MissingPartsButton report={small} />);
    const button = screen.getByTestId('install-model-parts');
    expect(button.textContent).toBe(t('params.readiness.installParts', { size: '1.4 GB' }));
    fireEvent.click(button);
    expect(install.mock.calls.map((c) => c[0])).toEqual(['repo::te.safetensors', 'repo::vae.safetensors']);
  });

  it('asks for confirmation when the download is large', async () => {
    const install = vi.spyOn(backend, 'installModel');
    render(<MissingPartsButton report={{ ...small, missing: [part('big', 9_380_000_000)] }} />);
    fireEvent.click(screen.getByTestId('install-model-parts'));
    expect(install).not.toHaveBeenCalled();
    expect(useModelParts.getState().offer?.missing[0]?.id).toBe('big');
  });

  it('turns into a disabled "installing" label once every part is on its way', () => {
    render(<MissingPartsButton report={small} />);
    act(() =>
      useModels.setState({
        installJobs: small.missing.map((p, i) => ({ id: `j${i}`, source: p.source, name: p.name, status: 'downloading' as const, bytes: 0, totalBytes: 1 })),
      }),
    );
    const button = screen.getByTestId('install-model-parts') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(t('params.readiness.installingParts'));
  });
});
