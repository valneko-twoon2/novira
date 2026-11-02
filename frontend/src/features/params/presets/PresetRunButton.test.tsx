// @vitest-environment jsdom
// The random preset run button: shown on the Generate tab only, ticks presets and queues with the chosen count.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useImagePresets } from '@/state/presets/imagePresets';
import { usePresetRun } from '@/state/presets/presetRun';
import { TooltipProvider } from '@/ui';
import { GenerationPresetBar } from './GenerationPresetBar';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useImagePresets.setState({ presets: [{ id: 'a', name: 'Alpha', data: { steps: 12 } }, { id: 'b', name: 'Beta', data: { steps: 30 } }], selectedId: null });
  usePresetRun.setState({ ids: [], count: 2 });
  useModels.getState().setModels([{ key: 'xl', name: 'xl', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' } as ModelConfig]);
  useParams.setState({ modelKey: 'xl', loras: [], refImages: [], positivePrompt: 'kept' });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = (random: boolean) =>
  render(
    <TooltipProvider>
      <GenerationPresetBar random={random} />
    </TooltipProvider>,
  );

describe('PresetRunButton', () => {
  it('is only on the bar of the Generate tab', () => {
    mount(false);
    expect(screen.queryByTestId('preset-run-open')).toBeNull();
    cleanup();
    mount(true);
    expect(screen.getByTestId('preset-run-open')).toBeTruthy();
  });

  it('queues only once a preset is ticked', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([{ id: 1 } as QueueItem]);
    mount(true);
    fireEvent.click(screen.getByTestId('preset-run-open'));
    const queue = screen.getByTestId('preset-run-queue') as HTMLButtonElement;
    expect(queue.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(usePresetRun.getState().ids).toEqual(['b']);
    expect(queue.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(t('presets.run.count')), { target: { value: '3' } });
    fireEvent.blur(screen.getByLabelText(t('presets.run.count')));
    expect(usePresetRun.getState().count).toBe(3);
    fireEvent.click(queue);
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledTimes(3));
    expect(enqueue.mock.calls.every(([r]) => r.params.steps === 30)).toBe(true);
    expect(useParams.getState().positivePrompt).toBe('kept');
  });
});
