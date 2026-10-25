// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useDownloads } from '@/state/downloads';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { PackDock } from './PackDock';

const url = 'https://github.com/1038lab/ComfyUI-RMBG';
const show = () =>
  render(
    <TooltipProvider>
      <PackDock />
    </TooltipProvider>,
  );

beforeEach(() => useDownloads.setState({ entries: [] }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useNodePacks.setState({ packs: null });
});

describe('PackDock', () => {
  it('shows nothing until something downloads', () => {
    show();
    expect(screen.queryByTestId('pack-dock')).toBeNull();
  });

  it('shows the progress of a model pack and cancels it', () => {
    const cancel = vi.spyOn(backend, 'cancelPack').mockResolvedValue(undefined);
    useDownloads.getState().track({ key: 'model:video', kind: 'model', pack: 'video', status: { state: 'downloading', file: 'a.safetensors', index: 2, count: 3, bytes: 4_000_000_000, totalBytes: 10_000_000_000 } });
    show();
    const row = screen.getByTestId('pack-dock-item');
    expect(row.textContent).toContain(t('pack.title.video'));
    expect(row.textContent).toContain(t('pack.downloading', { index: 2, count: 3, done: '4.0 GB', total: '10.0 GB' }));
    fireEvent.click(within(row).getByRole('button', { name: t('browse.dock.cancel') }));
    expect(cancel).toHaveBeenCalledWith('video');
  });

  it('names an extension pack by its folder, shows the step it is in, and cancels by address', () => {
    const cancel = vi.spyOn(useNodePacks.getState(), 'cancel').mockResolvedValue(undefined);
    useDownloads.getState().track({ key: `node:${url}`, kind: 'node', url, status: { state: 'installing', step: 'requirements' } });
    show();
    const row = screen.getByTestId('pack-dock-item');
    expect(row.textContent).toContain('ComfyUI-RMBG');
    expect(row.textContent).toContain(t('media.downloads.step.requirements'));
    fireEvent.click(within(row).getByRole('button', { name: t('browse.dock.cancel') }));
    expect(cancel).toHaveBeenCalledWith(url);
  });

  it('keeps a failed install on screen with its message until it is dismissed', () => {
    useDownloads.getState().track({ key: `node:${url}`, kind: 'node', url, status: { state: 'error', message: 'WinError 123' } });
    show();
    expect(screen.getByText('WinError 123')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(screen.queryByTestId('pack-dock')).toBeNull();
  });

  it('offers the restart once an extension pack is in and the engine has to load it', () => {
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: true } });
    useDownloads.getState().track({ key: `node:${url}`, kind: 'node', url, status: { state: 'ready' } });
    show();
    expect(screen.getByText(t('media.downloads.done'))).toBeTruthy();
    expect(screen.getByTestId('pack-dock-restart')).toBeTruthy();
  });

  it('says how long is left for a download whose size is known, and how long it has been going when it is not', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { track } = useDownloads.getState();
    const file = (bytes: number) => ({ state: 'downloading' as const, file: 'a', index: 1, count: 1, bytes, totalBytes: 1000 });
    track({ key: 'model:video', kind: 'model', pack: 'video', status: file(0) });
    vi.setSystemTime(2000);
    track({ key: 'model:video', kind: 'model', pack: 'video', status: file(100) });
    track({ key: `node:${url}`, kind: 'node', url, status: { state: 'installing', step: 'requirements' } });
    vi.setSystemTime(62_000);
    show();
    const [model, node] = screen.getAllByTestId('pack-dock-item');
    expect(within(model!).getByTestId('pack-dock-time').textContent).toBe(t('splash.engine.eta', { time: t('splash.engine.seconds', { n: 18 }) }));
    expect(within(node!).getByTestId('pack-dock-time').textContent).toBe(t('media.downloads.elapsed', { time: t('splash.engine.minutes', { n: 1, s: 0 }) }));
    vi.useRealTimers();
  });

  it('opens the list of installed extensions from the dock', () => {
    useDownloads.getState().track({ key: `node:${url}`, kind: 'node', url, status: { state: 'ready' } });
    show();
    fireEvent.click(screen.getByTestId('pack-dock-manage'));
    expect(useUi.getState().activeTab).toBe('extensions');
    useUi.getState().setTab('generate');
  });
});
