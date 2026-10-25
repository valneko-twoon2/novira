// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { usePose3dDialog } from '@/state/dialogs/pose3d';
import { TooltipProvider } from '@/ui';
import { placePose } from '@/state/pose/poseSpec';
import { v3, type Vec3 } from '@/state/pose/math3d';
import { PoseEditor3DDialog } from './PoseEditor3DDialog';

const fake = vi.hoisted(() => ({
  create: vi.fn(),
  view: { yaw: 0, pitch: 0 },
  joints: [] as { x: number; y: number; z: number }[],
  setView: vi.fn(),
  reset: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('./scene', () => ({
  createPoseScene: (...args: unknown[]) => {
    fake.create(...args);
    return { joints: () => fake.joints, view: () => fake.view, setView: fake.setView, reset: fake.reset, resize: () => undefined, dispose: fake.dispose };
  },
}));

const c = () => useCanvas.getState();
const poses = () => c().entities.flatMap((e) => e.objects.filter((o): o is PoseObject => o.kind === 'pose'));
const mount = () =>
  render(
    <TooltipProvider>
      <PoseEditor3DDialog />
    </TooltipProvider>,
  );

describe('the 3D pose editor dialog', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    c().replaceEntities([]);
    c().select(null);
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    fake.create.mockReset();
    fake.setView.mockReset();
    fake.reset.mockReset();
    fake.dispose.mockReset();
    fake.view = { yaw: 0, pitch: 0 };
  });
  afterEach(() => {
    cleanup();
    usePose3dDialog.getState().close();
  });

  it('opens the 3D view on the pose of the selected control layer, with its hidden joints', async () => {
    const id = c().addEntity('control');
    c().addObject(id, { ...placePose('p1', {}, { x: 0, y: 0, width: 512, height: 512 }, 4), hidden: [16] });
    c().select(id);
    mount();
    usePose3dDialog.getState().show();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    const [, joints, hidden] = fake.create.mock.calls[0] as [unknown, Vec3[], number[]];
    expect(joints).toHaveLength(18);
    expect(hidden).toEqual([16]);
    expect(await screen.findByTestId('pose3d-apply')).toBeTruthy();
  });

  it('turns the view with the view buttons and resets the figure', async () => {
    mount();
    usePose3dDialog.getState().show();
    await waitFor(() => expect((screen.getByTestId('pose3d-view-side') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('pose3d-view-side'));
    expect(fake.setView).toHaveBeenCalledWith(Math.PI / 2, 0);
    fireEvent.click(screen.getByTestId('pose3d-view-top'));
    expect(fake.setView).toHaveBeenCalledWith(0, Math.PI / 2);
    fireEvent.click(screen.getByTestId('pose3d-reset'));
    expect(fake.reset).toHaveBeenCalled();
  });

  it('applies the figure as seen: a new pose layer with the flat joints and their depth, and closes', async () => {
    mount();
    usePose3dDialog.getState().show();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    // The editor hands back the joints it holds; a turn of 180 degrees mirrors x and z around the middle.
    fake.joints = (fake.create.mock.calls[0] as [unknown, Vec3[]])[1].map((p) => v3(p.x, p.y, 5));
    fake.view = { yaw: Math.PI, pitch: 0 };
    await waitFor(() => expect((screen.getByTestId('pose3d-apply') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('pose3d-apply'));
    expect(poses()).toHaveLength(1);
    expect(poses()[0]!.depth).toHaveLength(18);
    expect(poses()[0]!.depth!.every((z) => Math.abs(z + 5) < 0.2)).toBe(true);
    expect(usePose3dDialog.getState().open).toBe(false);
  });

  it('says so when the 3D view cannot start, and does not offer to apply', async () => {
    fake.create.mockImplementation(() => {
      throw new Error('no webgl');
    });
    mount();
    usePose3dDialog.getState().show();
    expect(await screen.findByTestId('pose3d-failed')).toBeTruthy();
    expect((screen.getByTestId('pose3d-apply') as HTMLButtonElement).disabled).toBe(true);
    fake.create.mockReset();
  });

  it('releases the 3D view when the dialog closes', async () => {
    mount();
    usePose3dDialog.getState().show();
    await waitFor(() => expect(fake.create).toHaveBeenCalled());
    usePose3dDialog.getState().close();
    await waitFor(() => expect(fake.dispose).toHaveBeenCalled());
  });
});
