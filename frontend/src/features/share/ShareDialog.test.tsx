// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useShareDialog } from '@/state/dialogs/share';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { ShareDialog } from './ShareDialog';

const item = (name: string, mediaType: ImageDTO['mediaType'] = 'image'): ImageDTO => ({
  name,
  mediaType,
  url: `blob:${name}`,
  thumbnailUrl: `blob:${name}`,
  width: 64,
  height: 48,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
});

const mount = () =>
  render(
    <TooltipProvider>
      <ShareDialog />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.getState().setImages([item('a.png'), item('b.png'), item('c.mp4', 'video')]);
  useShareDialog.setState({ names: null });
});
afterEach(() => {
  cleanup();
  useShareDialog.getState().close();
  vi.restoreAllMocks();
});

describe('export for sharing dialog', () => {
  it('exports the pictures only, keeping the generation info and adding no watermark by default', async () => {
    const run = vi.spyOn(backend, 'exportImages').mockResolvedValue({ count: 2, skipped: 0, watermarked: 0, folder: 'D:/shared' });
    const reveal = vi.spyOn(backend, 'revealExportFolder').mockResolvedValue();
    mount();
    useShareDialog.getState().open(['a.png', 'b.png', 'c.mp4']);
    expect(await screen.findByTestId('share')).toBeTruthy();
    fireEvent.click(screen.getByTestId('share-run'));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0]).toEqual([['a.png', 'b.png'], { format: 'png', quality: 90, maxSide: null, removeInfo: false, watermark: false }]);
    const done = await screen.findByTestId('share-done');
    expect(done.textContent).toContain('D:/shared');
    fireEvent.click(screen.getByTestId('share-open-folder'));
    expect(reveal).toHaveBeenCalled();
  });

  it('shows the quality only for JPEG and sends it', async () => {
    const run = vi.spyOn(backend, 'exportImages').mockResolvedValue({ count: 1, skipped: 0, watermarked: 0, folder: '' });
    mount();
    useShareDialog.getState().open(['a.png']);
    await screen.findByTestId('share');
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByTestId('share-format-jpeg'));
    expect(screen.getByRole('slider')).toBeTruthy();
    fireEvent.click(screen.getByTestId('share-format-webp'));
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByTestId('share-format-jpeg'));
    fireEvent.click(screen.getByTestId('share-run'));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0]![1]).toMatchObject({ format: 'jpeg', quality: 90 });
    // The browser downloaded the files: no folder to open.
    await screen.findByTestId('share-done');
    expect(screen.queryByTestId('share-open-folder')).toBeNull();
  });

  it('keeps the form open when the folder dialog is cancelled', async () => {
    const run = vi.spyOn(backend, 'exportImages').mockResolvedValue(null);
    mount();
    useShareDialog.getState().open(['a.png']);
    fireEvent.click(await screen.findByTestId('share-run'));
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(screen.getByTestId('share')).toBeTruthy();
    expect(screen.queryByTestId('share-done')).toBeNull();
  });

  it('cannot run without a picture', async () => {
    mount();
    useShareDialog.getState().open(['c.mp4']);
    expect(((await screen.findByTestId('share-run')) as HTMLButtonElement).disabled).toBe(true);
  });

  // The form is remembered between openings, so these come last and turn the watermark off again.
  it('waits for the watermark files, then exports with the watermark and counts the marked copies', async () => {
    const status = vi
      .spyOn(backend, 'watermarkStatus')
      .mockResolvedValueOnce({ state: 'downloading', done: 50, total: 200 })
      .mockResolvedValue({ state: 'ready' });
    const run = vi.spyOn(backend, 'exportImages').mockResolvedValue({ count: 1, skipped: 0, watermarked: 1, folder: 'D:/shared' });
    mount();
    useShareDialog.getState().open(['a.png']);
    await screen.findByTestId('share');
    expect(status).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('switch', { name: t('share.watermark') }));
    expect((await screen.findByTestId('share-watermark-state')).textContent).toContain('25%');
    expect((screen.getByTestId('share-run') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((screen.getByTestId('share-run') as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    expect(screen.queryByTestId('share-watermark-state')).toBeNull();
    fireEvent.click(screen.getByTestId('share-run'));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0]![1]).toMatchObject({ watermark: true });
    expect((await screen.findByTestId('share-done')).textContent).toContain(tCount('share.doneWatermarked', 1));
  });

  it('offers a retry when the watermark files could not be fetched', async () => {
    vi.spyOn(backend, 'watermarkStatus').mockResolvedValue({ state: 'failed', message: 'download answered 404' });
    const retry = vi.spyOn(backend, 'prepareWatermark').mockResolvedValue();
    mount();
    useShareDialog.getState().open(['a.png']);
    await screen.findByTestId('share');
    // The previous test left the switch on.
    expect(screen.getByRole('switch', { name: t('share.watermark') }).getAttribute('aria-checked')).toBe('true');
    expect((await screen.findByTestId('share-watermark-state')).textContent).toContain('download answered 404');
    expect((screen.getByTestId('share-run') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('share-watermark-retry'));
    await waitFor(() => expect(retry).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('switch', { name: t('share.watermark') }));
    expect(screen.queryByTestId('share-watermark-state')).toBeNull();
    expect((screen.getByTestId('share-run') as HTMLButtonElement).disabled).toBe(false);
  });
});
