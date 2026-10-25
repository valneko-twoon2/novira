// @vitest-environment jsdom
// The pose dialog opened for a target (a comic panel): it starts from the target's pose, and hands the pose and its
// picture back, instead of putting a control layer on the canvas.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvas, recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { usePoseDialog } from '@/state/dialogs/pose';
import { TooltipProvider } from '@/ui';
import { PoseDialog } from './PoseDialog';
import { PRESETS } from './poseModel';

const initialCanvas = useCanvas.getState();
let restoreCanvas = () => {};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initialCanvas, true);
  restoreCanvas = installRecordingCanvas(recordingContext());
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
});

afterEach(() => {
  cleanup();
  usePoseDialog.getState().close();
  useCanvas.setState(initialCanvas, true);
  restoreCanvas();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mount = () =>
  render(
    <TooltipProvider>
      <PoseDialog />
    </TooltipProvider>,
  );

describe('the pose dialog for a target', () => {
  it('starts from the target pose, has the target title, and hands the pose and its picture back without touching the canvas', async () => {
    mount();
    const onUse = vi.fn(async () => undefined);
    usePoseDialog.getState().open({ width: 512, height: 768, initial: PRESETS.armsUp, onUse });
    await screen.findByTestId('pose-dialog');
    expect(screen.getByText(t('comic.pose.title'))).toBeTruthy();
    expect(screen.queryByLabelText(t('pose.size'))).toBeNull();

    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(onUse).toHaveBeenCalledOnce());
    const [pose, picture] = onUse.mock.calls[0] as unknown as [{ x: number; y: number }[], Blob];
    expect(pose).toEqual(PRESETS.armsUp);
    expect(picture).toBeInstanceOf(Blob);
    await waitFor(() => expect(usePoseDialog.getState().isOpen).toBe(false));
    expect(useCanvas.getState().entities).toHaveLength(initialCanvas.entities.length);
  });

  it('starts from the standing preset when the target has no pose yet', async () => {
    mount();
    const onUse = vi.fn(async () => undefined);
    usePoseDialog.getState().open({ width: 512, height: 512, initial: null, onUse });
    await screen.findByTestId('pose-dialog');
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(onUse).toHaveBeenCalledOnce());
    expect((onUse.mock.calls[0] as unknown as [{ x: number; y: number }[], Blob])[0]).toEqual(PRESETS.standing);
  });
});
