// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import * as install from '@/state/modelInstall';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { HuggingFaceBrowse } from './HuggingFaceBrowse';

const files = ['README.md', 'models/ip-adapter_sd15.safetensors', 'sdxl_models/ip-adapter_sdxl.safetensors', 'sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors'].filter((f) => f !== 'README.md');
const show = () =>
  render(
    <TooltipProvider>
      <HuggingFaceBrowse />
    </TooltipProvider>,
  );
const lookup = (text: string) => {
  fireEvent.change(screen.getByTestId('browse-hf-input'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('browse-hf-lookup'));
};

beforeEach(() => {
  vi.spyOn(backend, 'listHuggingFaceFiles').mockResolvedValue(files);
  vi.spyOn(install, 'installModel').mockResolvedValue(undefined as never);
});
afterEach(() => {
  cleanup();
  useModels.setState({ models: [], installJobs: [] });
  vi.restoreAllMocks();
});

describe('HuggingFaceBrowse', () => {
  it('takes an address into a folder, lists that folder first, and installs the files picked', async () => {
    show();
    lookup('https://huggingface.co/h94/IP-Adapter/tree/main/sdxl_models');
    await screen.findByTestId('browse-hf-results');
    expect(backend.listHuggingFaceFiles).toHaveBeenCalledWith('h94/IP-Adapter');
    expect(screen.queryByText('models/ip-adapter_sd15.safetensors')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'sdxl_models/ip-adapter_sdxl.safetensors' }));
    fireEvent.click(screen.getByTestId('browse-hf-install'));
    await waitFor(() => expect(install.installModel).toHaveBeenCalledWith('h94/IP-Adapter::sdxl_models/ip-adapter_sdxl.safetensors'));
    fireEvent.click(screen.getByTestId('browse-hf-scope'));
    expect(screen.getByText('models/ip-adapter_sd15.safetensors')).toBeTruthy();
  });

  it('ticks the file of a file address, and says so for an address that is not a model', async () => {
    show();
    lookup('https://huggingface.co/h94/IP-Adapter/blob/main/models/ip-adapter_sd15.safetensors');
    await screen.findByTestId('browse-hf-results');
    expect((screen.getByRole('checkbox', { name: 'models/ip-adapter_sd15.safetensors' }) as HTMLInputElement).checked).toBe(true);
    lookup('https://example.com/a/b');
    expect(await screen.findByText(t('browse.hf.invalid'))).toBeTruthy();
    expect(screen.queryByTestId('browse-hf-results')).toBeNull();
  });

  it('marks a file that is installed, shows the progress of one being downloaded, and leaves both unticked', async () => {
    useModels.setState({
      models: [{ key: 'm1', name: 'ip-adapter_sdxl.safetensors', source: 'h94/IP-Adapter::sdxl_models/ip-adapter_sdxl.safetensors' } as never],
      installJobs: [
        { id: 'j1', source: 'h94/IP-Adapter::sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors', name: 'plus', status: 'downloading', bytes: 25, totalBytes: 100 },
      ],
    });
    show();
    lookup('https://huggingface.co/h94/IP-Adapter/tree/main/sdxl_models');
    await screen.findByTestId('browse-hf-results');
    const rows = screen.getAllByTestId('browse-hf-file');
    const byState = (state: string) => rows.filter((r) => r.getAttribute('data-state') === state);
    expect(byState('installed')).toHaveLength(1);
    expect(byState('installed')[0]!.textContent).toContain(t('browse.card.installed'));
    expect(byState('queued')[0]!.textContent).toContain(t('browse.card.installing', { percent: 25 }));
    expect((screen.getByRole('checkbox', { name: 'sdxl_models/ip-adapter_sdxl.safetensors' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('shows why a lookup failed', async () => {
    vi.spyOn(backend, 'listHuggingFaceFiles').mockRejectedValue(new Error('nope'));
    show();
    lookup('a/b');
    expect(await screen.findByText(t('models.install.hfLookupFailed', { error: 'nope' }))).toBeTruthy();
  });
});
