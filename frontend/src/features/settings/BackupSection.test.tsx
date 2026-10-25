// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { asBrowserServer } from '@/backend/browserServer.testkit';
import { t } from '@/i18n';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { BackupSection } from './BackupSection';

const mount = () =>
  render(
    <TooltipProvider>
      <BackupSection />
    </TooltipProvider>,
  );

const info = { appVersion: '0.1.0', createdAt: 1_760_000_000_000, images: 12, boards: 3, workflows: 2 };

beforeEach(() => {
  localStorage.clear();
  useToasts.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('backup section', () => {
  it('sends the saved screen state with a new backup', async () => {
    localStorage.setItem('novira.characters', '[1]');
    localStorage.setItem('elsewhere', 'x');
    const create = vi.spyOn(backend, 'createBackup').mockResolvedValue({ fileName: 'novira-backup.zip', bytes: 10, info });
    mount();
    fireEvent.click(screen.getByTestId('backup-create'));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(JSON.parse(create.mock.calls[0]![0])).toEqual({ 'novira.characters': '[1]' });
    await waitFor(() => expect(useToasts.getState().toasts[0]?.title).toContain('novira-backup.zip'));
  });

  it('asks before replacing the data, and drops the backup on cancel', async () => {
    vi.spyOn(backend, 'openBackup').mockResolvedValue(info);
    const discard = vi.spyOn(backend, 'discardRestore').mockResolvedValue();
    const confirm = vi.spyOn(backend, 'confirmRestore').mockResolvedValue();
    mount();
    fireEvent.click(screen.getByTestId('backup-restore'));
    const dialog = await screen.findByTestId('restore-confirm');
    expect(dialog.textContent).toContain('12');
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('restore-confirm-cancel'));
    await waitFor(() => expect(discard).toHaveBeenCalled());
    expect(screen.queryByTestId('restore-confirm')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('confirms the restore', async () => {
    vi.spyOn(backend, 'openBackup').mockResolvedValue(info);
    const confirm = vi.spyOn(backend, 'confirmRestore').mockResolvedValue();
    mount();
    fireEvent.click(screen.getByTestId('backup-restore'));
    fireEvent.click(await screen.findByTestId('restore-confirm-run'));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  });

  it('changes nothing when the file dialog is cancelled and reports a bad backup', async () => {
    const open = vi.spyOn(backend, 'openBackup').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('this is not a novira backup'));
    mount();
    fireEvent.click(screen.getByTestId('backup-restore'));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('restore-confirm')).toBeNull();
    await waitFor(() => expect((screen.getByTestId('backup-restore') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('backup-restore'));
    await waitFor(() => expect(useToasts.getState().toasts[0]?.description).toBe('this is not a novira backup'));
    expect(screen.queryByTestId('restore-confirm')).toBeNull();
  });

  it('says a backup needs the desktop app on the browser server, and asks for nothing', () => {
    asBrowserServer();
    const create = vi.spyOn(backend, 'createBackup');
    const open = vi.spyOn(backend, 'openBackup');
    mount();
    expect(screen.getByTestId('backup-desktop-only').textContent).toBe(t('common.desktopOnly'));
    for (const id of ['backup-create', 'backup-restore']) {
      const button = screen.getByTestId(id) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(create).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('shows no such note where the dialog exists', () => {
    mount();
    expect(screen.queryByTestId('backup-desktop-only')).toBeNull();
    expect((screen.getByTestId('backup-create') as HTMLButtonElement).disabled).toBe(false);
  });
});
