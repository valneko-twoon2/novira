// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useHardware } from '@/state/hardware';
import { usePacks } from '@/state/media/packs';
import { TooltipProvider } from '@/ui';
import { PackChoice } from './PackChoice';

const GIB = 1024 ** 3;
const OPTIONS = [
  { kind: 'video' as const, name: 'Standard', note: 'standard' },
  { kind: 'turbo' as const, name: 'Fast', note: 'fast' },
];
const initialPacks = usePacks.getState().packs;
const missing = { state: 'missing', totalBytes: 10_000_000_000 } as const;

function show(selected: 'video' | 'turbo' = 'video', onSelect = vi.fn()) {
  render(
    <TooltipProvider>
      <PackChoice title="Pick" testId="video-pack" options={OPTIONS} selected={selected} onSelect={onSelect} />
    </TooltipProvider>,
  );
  return onSelect;
}

beforeEach(() => {
  usePacks.setState({ packs: { ...initialPacks, video: missing, turbo: missing } });
  useHardware.setState({ info: { gpuName: 'Test GPU', vramBytes: 16 * GIB } });
  vi.spyOn(backend, 'hardwareInfo').mockResolvedValue({ gpuName: 'Test GPU', vramBytes: 16 * GIB });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  usePacks.setState({ packs: initialPacks });
});

describe('video model choice', () => {
  it('lists both models with how they fit this PC, and recommends the first that fits comfortably', () => {
    show();
    expect(screen.getByTestId('choice-gpu').textContent).toBe(t('media.choice.gpu', { gpu: 'Test GPU', size: '16 GB' }));
    expect(screen.getAllByText(t('media.choice.fit.comfortable'))).toHaveLength(2);
    expect(screen.getAllByText(t('media.choice.recommended'))).toHaveLength(1);
    expect(screen.getByTestId('video-pack-video').textContent).toContain(t('media.choice.recommended'));
  });

  it('marks a small card as too little and recommends nothing', () => {
    useHardware.setState({ info: { gpuName: 'Small GPU', vramBytes: 4 * GIB } });
    show();
    expect(screen.getAllByText(t('media.choice.fit.short'))).toHaveLength(2);
    expect(screen.queryByText(t('media.choice.recommended'))).toBeNull();
  });

  it('says so when the memory is unknown', () => {
    useHardware.setState({ info: { gpuName: '', vramBytes: null } });
    show();
    expect(screen.getByTestId('choice-gpu').textContent).toBe(t('media.choice.gpuUnknown'));
    expect(screen.getAllByText(t('media.choice.fit.unknown'))).toHaveLength(2);
  });

  it('selects the model of a row and starts its download from the button', () => {
    const install = vi.spyOn(backend, 'installPack').mockResolvedValue();
    const onSelect = show();
    fireEvent.click(screen.getByTestId('video-pack-turbo'));
    expect(onSelect).toHaveBeenLastCalledWith('turbo');
    fireEvent.click(screen.getByTestId('turbo-pack-install'));
    expect(install).toHaveBeenCalledWith('turbo');
  });

  it('shows nothing once the model in use is installed', () => {
    usePacks.setState({ packs: { ...initialPacks, video: { state: 'ready' }, turbo: missing } });
    show('video');
    expect(screen.queryByTestId('video-pack')).toBeNull();
  });
});
