// @vitest-environment jsdom
// The cover hint: shown once above the grid only when the Civitai lookup is off and a model with a picture kind has none.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EngineSettings, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { CoverHint } from './CoverHint';

const model = (key: string, over: Partial<ModelConfig> = {}): ModelConfig => ({
  key,
  name: key,
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: `models/${key}.safetensors`,
  size: 1,
  source: 'local',
  ...over,
});

const engine = async (civitaiLookup: boolean): Promise<EngineSettings> => ({ ...(await backend.engineSettings()), civitaiLookup });
const show = (models: ModelConfig[]) =>
  render(
    <TooltipProvider>
      <CoverHint models={models} />
    </TooltipProvider>,
  );

const initialUi = useUi.getState();
beforeEach(() => useUi.setState({ ...initialUi, modal: null }, true));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CoverHint', () => {
  it('shows the note with a button to the engine settings when the lookup is off and a model has no picture', async () => {
    vi.spyOn(backend, 'engineSettings').mockResolvedValue(await engine(false));
    show([model('a'), model('b', { coverImageUrl: 'x.jpg' })]);
    expect(await screen.findByText(t('models.coverHint.text'))).toBeTruthy();
    expect(screen.getAllByTestId('mm-cover-hint')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('mm-cover-hint-open'));
    expect(useUi.getState()).toMatchObject({ modal: 'settings', settingsTab: 'engine' });
  });

  it('stays away when the lookup is on', async () => {
    const spy = vi.spyOn(backend, 'engineSettings').mockResolvedValue(await engine(true));
    show([model('a')]);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByTestId('mm-cover-hint')).toBeNull();
  });

  it('stays away when every model has a picture or its kind shows an icon', async () => {
    const spy = vi.spyOn(backend, 'engineSettings').mockResolvedValue(await engine(false));
    show([model('a', { coverImageUrl: 'x.jpg' }), model('v', { type: 'vae' })]);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByTestId('mm-cover-hint')).toBeNull();
  });

  it('stays away when the settings cannot be read', async () => {
    const spy = vi.spyOn(backend, 'engineSettings').mockRejectedValue(new Error('no'));
    show([model('a')]);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByTestId('mm-cover-hint')).toBeNull();
  });
});
