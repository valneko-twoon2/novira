// @vitest-environment jsdom
// The phone canvas editor gives the desktop back its link between the canvas box and the Generate tab's size whenever
// it goes away, not only by its close button: the window widening to the desktop layout unmounts the whole phone layout.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { useCanvas } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { PhoneShell } from './PhoneShell';
import { usePhone } from './phoneStore';

afterEach(cleanup);

it('links the size again and ends the editing when the phone layout goes away with the editor open', { tags: ['state-transition', 'regression'] }, async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const canvases = installRecordingCanvases();
  useGallery.getState().setImages([{ name: 'a.png', url: 'blob:a', thumbnailUrl: 'blob:ta', width: 640, height: 480, createdAt: 1, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null } as never]);
  const view = render(<TooltipProvider><PhoneShell /></TooltipProvider>);
  usePhone.getState().show({ kind: 'image', name: 'a.png' } as never);
  fireEvent.click(await screen.findByTestId('phone-view-menu'));
  fireEvent.click(await screen.findByRole('menuitem', { name: t('canvas.phone.edit') }));
  expect(await screen.findByTestId('phone-canvas')).toBeTruthy();
  expect(useCanvas.getState().sizeSync).toBe(false);
  // The window widens: App renders the desktop layout in place of PhoneShell.
  view.unmount();
  canvases.restore();
  const { bbox, setBbox } = useCanvas.getState();
  setBbox({ ...bbox, width: 1152, height: 768 });
  expect(useParams.getState().width).toBe(1152);
  expect(useCanvas.getState().sizeSync).toBe(true);
  expect(usePhone.getState().editing).toBe(false);
});
