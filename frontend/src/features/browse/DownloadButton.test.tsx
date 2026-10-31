// @vitest-environment jsdom
// The download button of a model: its four faces (download, installing, installed, paid and locked) and what a press does.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiFile, type CivitaiModel, type CivitaiVersion } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { DownloadButton } from './DownloadButton';
import { fileSource } from './download';

const initialModels = useModels.getState();
const file: CivitaiFile = { id: 'f1', name: 'a.safetensors', sizeBytes: 1, format: 'SafeTensor', precision: 'fp16' };
const version = (over: Partial<CivitaiVersion> = {}) => ({ id: 'v1', name: 'v1', baseModel: 'sdxl', createdAt: 0, triggerWords: [], files: [file], ...over }) as CivitaiVersion;
const model = (v: CivitaiVersion = version()) => ({ id: 'm1', name: 'M', versions: [v] }) as CivitaiModel;
const mount = (m: CivitaiModel, extra: Partial<Parameters<typeof DownloadButton>[0]> = {}) =>
  render(
    <TooltipProvider>
      <DownloadButton model={m} file={file} {...extra} />
    </TooltipProvider>,
  );

beforeEach(() => useModels.setState(initialModels, true));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DownloadButton', () => {
  it('queues the install on a press without letting the press reach the card', () => {
    const install = vi.spyOn(backend, 'installModel').mockResolvedValue({ id: 'j', source: 's', name: 'n', status: 'waiting', bytes: 0, totalBytes: 0 });
    const onCard = vi.fn();
    const m = model();
    render(
      <div onClick={onCard}>
        <DownloadButton model={m} file={file} />
      </div>,
    );
    fireEvent.click(screen.getByText(t('browse.card.download')));
    expect(install).toHaveBeenCalledWith(fileSource(m, file), 'a.safetensors');
    expect(onCard).not.toHaveBeenCalled();
  });

  it('shows the progress while the install runs, and cannot be pressed', () => {
    const m = model();
    useModels.setState({ installJobs: [{ id: 'j', source: fileSource(m, file), name: 'a.safetensors', status: 'downloading', bytes: 25, totalBytes: 100 }] });
    mount(m);
    const button = screen.getByText(t('browse.card.installing', { percent: 25 })).closest('button')!;
    expect(button.disabled).toBe(true);
    expect(button.style.getPropertyValue('--browse-progress')).toBe('25%');
  });

  it('says installed, disabled, once the file is installed', () => {
    const m = model();
    useModels.setState({ installJobs: [{ id: 'j', source: fileSource(m, file), name: 'a.safetensors', status: 'completed', bytes: 1, totalBytes: 1 }] });
    mount(m);
    const button = screen.getByText(t('browse.card.installed')).closest('button')!;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('is-installed');
  });

  it('is locked for a paid version, with no way to start the install', () => {
    const install = vi.spyOn(backend, 'installModel');
    mount(model(version({ paid: true })));
    const button = screen.getByTestId('browse-paid-locked') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(t('browse.paid.locked'));
    fireEvent.click(button);
    expect(install).not.toHaveBeenCalled();
  });

  it('judges the version it is given, not the first one', () => {
    const m = { ...model(version({ paid: true })), versions: [version({ paid: true }), version({ id: 'v2' })] } as CivitaiModel;
    mount(m, { version: m.versions[1] });
    expect(screen.queryByTestId('browse-paid-locked')).toBeNull();
    expect(screen.getByText(t('browse.card.download'))).toBeTruthy();
  });

  it('is open for an early access that has ended', () => {
    mount(model(version({ paid: true, paidUntil: Date.now() - 1000 })));
    expect(screen.queryByTestId('browse-paid-locked')).toBeNull();
  });
});
