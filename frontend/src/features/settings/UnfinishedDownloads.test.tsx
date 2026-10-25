// @vitest-environment jsdom
// Settings → Data: the list of unfinished downloads, deleting one or all of them (all after a confirmation), and the
// toasts for a file that is in use, a failed delete and a failed list.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type UnfinishedDownload } from '@/backend';
import { t } from '@/i18n';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { UnfinishedDownloads } from './UnfinishedDownloads';

const part: UnfinishedDownload = { path: 'comfyui/.downloads/comfyui.part', name: 'comfyui.part', bytes: 1_048_576 };
const model: UnfinishedDownload = { path: 'models/.downloads/turbo.safetensors.part', name: 'turbo.safetensors.part', bytes: 3_221_225_472 };

const mount = () =>
  render(
    <TooltipProvider>
      <UnfinishedDownloads />
    </TooltipProvider>,
  );
const rows = () => screen.queryAllByTestId(/^settings-unfinished-row-/);
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('unfinished downloads', () => {
  it('says there is nothing unfinished, and offers no delete', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([]);
    mount();
    expect(await screen.findByText(t('settings.unfinished.empty'))).toBeTruthy();
    expect(screen.queryByTestId('settings-unfinished-delete-all')).toBeNull();
  });

  it('lists each file with its folder and its size', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([part, model]);
    mount();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(within(rows()[0]!).getByText('comfyui.part')).toBeTruthy();
    expect(within(rows()[0]!).getByText('comfyui/.downloads')).toBeTruthy();
    expect(within(rows()[0]!).getByText('1 MB')).toBeTruthy();
    expect(within(rows()[1]!).getByText('models/.downloads')).toBeTruthy();
    expect(within(rows()[1]!).getByText('3.2 GB')).toBeTruthy();
  });

  it('shows a small partial file in kilobytes, not as a whole megabyte', async () => {
    const small: UnfinishedDownload = { path: 'models/.downloads/small.part', name: 'small.part', bytes: 2_500 };
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([small]);
    mount();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]!).getByText('3 KB')).toBeTruthy();
  });

  it('deletes one file and shows what is left', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([part, model]);
    const del = vi.spyOn(backend, 'deleteUnfinishedDownloads').mockResolvedValue([model]);
    mount();
    fireEvent.click(await screen.findByTestId('settings-unfinished-delete-0'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(del).toHaveBeenCalledWith([part.path]);
    expect(within(rows()[0]!).getByText('turbo.safetensors.part')).toBeTruthy();
    expect(lastToast()).toMatchObject({ status: 'success', title: t('settings.unfinished.deleted') });
  });

  it('asks before deleting all, and deletes all after the confirmation', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([part, model]);
    const del = vi.spyOn(backend, 'deleteUnfinishedDownloads').mockResolvedValue([]);
    mount();
    fireEvent.click(await screen.findByTestId('settings-unfinished-delete-all'));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(screen.queryByTestId('settings-unfinished-confirm')).toBeNull();
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('settings-unfinished-delete-all'));
    fireEvent.click(screen.getByTestId('settings-unfinished-confirm'));
    await waitFor(() => expect(del).toHaveBeenCalledWith([part.path, model.path]));
    expect(await screen.findByText(t('settings.unfinished.empty'))).toBeTruthy();
    expect(lastToast()).toMatchObject({ status: 'success', title: t('settings.unfinished.deleted') });
  });

  it('warns with the name of the file that is in use and was kept', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([part, model]);
    vi.spyOn(backend, 'deleteUnfinishedDownloads').mockResolvedValue([model]);
    mount();
    fireEvent.click(await screen.findByTestId('settings-unfinished-delete-all'));
    fireEvent.click(screen.getByTestId('settings-unfinished-confirm'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'warning', title: t('settings.unfinished.keptInUse'), description: model.name }));
    expect(rows()).toHaveLength(1);
  });

  it('reports a failed delete and keeps the file listed', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockResolvedValue([part]);
    vi.spyOn(backend, 'deleteUnfinishedDownloads').mockRejectedValue(new Error('locked'));
    mount();
    fireEvent.click(await screen.findByTestId('settings-unfinished-delete-0'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', title: t('settings.unfinished.deleteFailed'), description: 'locked' }));
    expect(rows()).toHaveLength(1);
    expect((screen.getByTestId('settings-unfinished-delete-0') as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports a failed list', async () => {
    vi.spyOn(backend, 'listUnfinishedDownloads').mockRejectedValue(new Error('disk gone'));
    mount();
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', title: t('settings.unfinished.loadFailed'), description: 'disk gone' }));
    expect(rows()).toHaveLength(0);
    expect(screen.queryByText(t('settings.unfinished.empty'))).toBeNull();
  });
});
