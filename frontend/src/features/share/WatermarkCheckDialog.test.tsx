// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type WatermarkCheck } from '@/backend';
import { asBrowserServer } from '@/backend/browserServer.testkit';
import { t } from '@/i18n';
import { useWatermarkCheckDialog } from '@/state/dialogs/watermark';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { WatermarkCheckDialog } from './WatermarkCheckDialog';

const nothing: WatermarkCheck = {
  fileName: 'plain.png',
  watermarkChecked: true,
  watermarkFound: false,
  noviraMarker: false,
  watermarkId: null,
  originalName: null,
  originalInGallery: false,
  exportedAt: null,
  credentialsPresent: false,
  credentialsValid: false,
  credentialsTrusted: false,
  credentialsAi: false,
  credentialsSigner: null,
  credentialsThisApp: false,
  iptcAi: false,
};

const marked: WatermarkCheck = {
  ...nothing,
  fileName: 'shared.jpg',
  watermarkFound: true,
  noviraMarker: true,
  watermarkId: '0308ad2be03e',
  originalName: 'a.png',
  originalInGallery: true,
  exportedAt: 1_791_653_354_461,
  credentialsPresent: true,
  credentialsValid: true,
  credentialsAi: true,
  credentialsSigner: 'novira',
  credentialsThisApp: true,
  iptcAi: true,
};

const mount = () =>
  render(
    <TooltipProvider>
      <WatermarkCheckDialog />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useWatermarkCheckDialog.setState({ open: false, name: null });
});
afterEach(() => {
  cleanup();
  useWatermarkCheckDialog.getState().close();
  vi.restoreAllMocks();
});

describe('check for a watermark dialog', () => {
  it('checks a picked file and leads to the gallery original', async () => {
    const pick = vi.spyOn(backend, 'checkWatermarkFile').mockResolvedValue(marked);
    const select = vi.spyOn(useGallery.getState(), 'setSelection');
    mount();
    useWatermarkCheckDialog.getState().show();
    fireEvent.click(await screen.findByTestId('wm-check-pick'));
    await waitFor(() => expect(pick).toHaveBeenCalledTimes(1));
    expect((await screen.findByTestId('wm-check-watermark')).textContent).toContain(t('share.check.watermarkNovira', { id: '0308ad2be03e' }));
    expect(screen.getByTestId('wm-check-credentials').textContent).toContain(t('share.check.signerThisApp'));
    expect(screen.getByTestId('wm-check-credentials').textContent).toContain(t('share.check.signerUntrusted'));
    expect(screen.getByTestId('wm-check-iptc').textContent).toContain(t('share.check.yes'));
    fireEvent.click(screen.getByTestId('wm-check-show-original'));
    expect(select).toHaveBeenCalledWith(['a.png']);
    expect(useWatermarkCheckDialog.getState().open).toBe(false);
  });

  it('checks a gallery picture at once and says when nothing is there', async () => {
    const check = vi.spyOn(backend, 'checkWatermarkImage').mockResolvedValue({ ...nothing, fileName: 'b.png' });
    mount();
    useWatermarkCheckDialog.getState().show('b.png');
    await waitFor(() => expect(check).toHaveBeenCalledWith('b.png'));
    expect((await screen.findByTestId('wm-check-watermark')).textContent).toContain(t('share.check.watermarkNone'));
    expect(screen.queryByTestId('wm-check-original')).toBeNull();
    expect(screen.getByTestId('wm-check-credentials').textContent).toContain(t('share.check.no'));
  });

  it('says what it could not check and keeps the last result when the file dialog is cancelled', async () => {
    const pick = vi
      .spyOn(backend, 'checkWatermarkFile')
      .mockResolvedValueOnce({ ...nothing, watermarkChecked: false, credentialsPresent: true, credentialsValid: false, originalName: 'gone.png' })
      .mockResolvedValueOnce(null);
    mount();
    useWatermarkCheckDialog.getState().show();
    fireEvent.click(await screen.findByTestId('wm-check-pick'));
    expect((await screen.findByTestId('wm-check-watermark')).textContent).toContain(t('share.check.watermarkUnchecked'));
    expect(screen.getByTestId('wm-check-credentials').textContent).toContain(t('share.check.credentialsBroken'));
    fireEvent.click(screen.getByTestId('wm-check-pick'));
    await waitFor(() => expect(pick).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('wm-check-result')).toBeTruthy();
  });

  it('names a deleted original and an id this app does not know', async () => {
    const pick = vi.spyOn(backend, 'checkWatermarkFile');
    mount();
    useWatermarkCheckDialog.getState().show();
    pick.mockResolvedValueOnce({ ...marked, originalInGallery: false });
    fireEvent.click(await screen.findByTestId('wm-check-pick'));
    expect((await screen.findByTestId('wm-check-original')).textContent).toContain(t('share.check.originalDeleted'));
    pick.mockResolvedValueOnce({ ...marked, originalName: null, originalInGallery: false, exportedAt: null });
    fireEvent.click(screen.getByTestId('wm-check-pick'));
    await waitFor(() => expect(screen.getByTestId('wm-check-original').textContent).toContain(t('share.check.originalUnknown')));
  });

  it('checks the gallery picture on the browser server but offers no file of this PC there', async () => {
    asBrowserServer();
    const check = vi.spyOn(backend, 'checkWatermarkImage').mockResolvedValue({ ...nothing, fileName: 'b.png' });
    const pick = vi.spyOn(backend, 'checkWatermarkFile');
    mount();
    useWatermarkCheckDialog.getState().show('b.png');
    await waitFor(() => expect(check).toHaveBeenCalledWith('b.png'));
    expect(await screen.findByTestId('wm-check-result')).toBeTruthy();
    expect(screen.getByTestId('wm-check-desktop-only').textContent).toBe(t('common.desktopOnly'));
    expect(screen.queryByTestId('wm-check-pick')).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });
});
