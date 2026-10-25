// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { MOCK_FACE_RIG_LIBRARY } from '@/backend/mock/faceRigData';
import { TooltipProvider } from '@/ui';
import { renderGif } from './animation';
import { FaceRigEditor } from './FaceRigEditor';
import { EMPTY_RIG, UNIT_PX, adjustedCount, dragHandle, gazeOf, headOf, parseRig, rangesOf, serializeRig, setGaze, setHead, togglePreset } from './rig';

vi.mock('./animation', async (original) => ({ ...(await original<typeof import('./animation')>()), renderGif: vi.fn() }));

const ranges = rangesOf(MOCK_FACE_RIG_LIBRARY.axes);

describe('face rig pose', () => {
  it('writes only what differs from the photo and reads it back', () => {
    expect(serializeRig(EMPTY_RIG)).toBe('');
    const pose = { w: { au12: 0.5, au26: 0 }, p: { happy: 0.7 }, rot: [0, 10, 0] as [number, number, number] };
    const text = serializeRig(pose);
    expect(JSON.parse(text)).toEqual({ v: 1, w: { au12: 0.5 }, p: { happy: 0.7 }, rot: [0, 10, 0] });
    expect(parseRig(text)).toEqual({ w: { au12: 0.5 }, p: { happy: 0.7 }, rot: [0, 10, 0] });
    expect(parseRig('not json')).toEqual(EMPTY_RIG);
    expect(parseRig('{"w":{"a":"x"}}').w.a).toBe(0);
    expect(adjustedCount(pose)).toBe(3);
  });

  it('moves a brow up to raise it and toward the nose to furrow it, both sides together when mirrored', () => {
    const lifted = dragHandle(EMPTY_RIG, 'brow_L', UNIT_PX / 2, -UNIT_PX / 2, true, ranges);
    expect(lifted.w).toMatchObject({ au1_2_L: 0.5, au4_L: 0.5, au1_2_R: 0.5, au4_R: 0.5 });
    const alone = dragHandle(EMPTY_RIG, 'brow_L', 0, -UNIT_PX / 2, false, ranges);
    expect(alone.w.au1_2_L).toBe(0.5);
    expect(alone.w.au1_2_R).toBeUndefined();
  });

  it('keeps every weight inside the range the pack allows', () => {
    const smile = dragHandle(EMPTY_RIG, 'corner_R', 0, -UNIT_PX * 5, false, ranges);
    expect(smile.w.au12).toBe(1);
    const frown = dragHandle(EMPTY_RIG, 'corner_R', 0, UNIT_PX * 5, false, ranges);
    expect(frown.w.au12).toBe(-0.23);
    const eye = dragHandle(EMPTY_RIG, 'lid_L', 0, -UNIT_PX * 5, false, ranges);
    expect(eye.w.au45_L).toBe(-0.25);
  });

  it('turns a point on the gaze and head discs into axes and degrees, and back', () => {
    const looking = setGaze(EMPTY_RIG, 0.5, -0.5);
    expect(looking.w).toMatchObject({ au61: 0.5, au62: 0, au63: 0.5, au64: 0 });
    expect(gazeOf(looking)).toEqual([0.5, -0.5]);
    const far = setGaze(EMPTY_RIG, 3, 0);
    expect(far.w.au61).toBe(1);
    const turned = setHead(EMPTY_RIG, 1, 0);
    expect(turned.rot[1]).toBe(25);
    expect(headOf(turned)).toEqual([1, 0]);
    expect(togglePreset(togglePreset(EMPTY_RIG, 'happy'), 'happy').p.happy).toBe(0);
  });
});

describe('face rig editor', () => {
  beforeAll(() => {
    backend.setStepDelay(0);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(cleanup);

  it('draws the portrait with handles, follows a drag and hands the pose back when applied', async () => {
    const name = 'portrait.png';
    const onApply = vi.fn();
    render(
      <TooltipProvider>
        <FaceRigEditor open onOpenChange={() => {}} imageName={name} rig="" onApply={onApply} />
      </TooltipProvider>,
    );
    const jaw = await screen.findByTestId('rig-handle-jaw', undefined, { timeout: 3000 });
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('data-testid')?.startsWith('rig-handle-'))).toHaveLength(7);
    await waitFor(() => expect(MOCK_FACE_RIG_LIBRARY.axes.length).toBeGreaterThan(0));
    // The library loads asynchronously; wait until the clamp ranges are known before dragging.
    await new Promise((r) => setTimeout(r, 120));
    fireEvent.pointerDown(jaw, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(jaw, { pointerId: 1, clientX: 100, clientY: 100 + UNIT_PX / 2 });
    fireEvent.pointerUp(jaw, { pointerId: 1 });
    fireEvent.click(screen.getByTestId('rig-preset-happy'));
    fireEvent.click(screen.getByTestId('rig-apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(JSON.parse(onApply.mock.calls[0]![0] as string)).toEqual({ v: 1, w: { au26: 0.5 }, p: { happy: 0.7 } });
  });

  it('keeps expressions as keyframes, goes back to one, and makes a GIF from two or more', async () => {
    const gif = vi.mocked(renderGif).mockResolvedValue(new Uint8Array([71, 73, 70]));
    URL.createObjectURL = vi.fn(() => 'blob:gif');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <TooltipProvider>
        <FaceRigEditor open onOpenChange={() => {}} imageName="portrait.png" rig="" onApply={() => {}} />
      </TooltipProvider>,
    );
    await screen.findByTestId('rig-handle-jaw', undefined, { timeout: 3000 });
    expect(screen.queryByTestId('rig-anim-make')).toBeNull();
    fireEvent.click(screen.getByTestId('rig-key-add'));
    fireEvent.click(screen.getByTestId('rig-preset-happy'));
    fireEvent.click(screen.getByTestId('rig-key-add'));
    expect(screen.getAllByTestId('rig-key')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('rig-anim-make'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const [name, poses, fps] = gif.mock.calls[0]!;
    expect(name).toBe('portrait.png');
    expect(poses.length).toBeGreaterThan(2);
    expect(fps).toBe(12);
    // The first keyframe is the photo's own face and the second has the smile on.
    expect(poses[0]!.p.happy ?? 0).toBe(0);
    expect(poses.some((p) => (p.p.happy ?? 0) > 0.6)).toBe(true);
    click.mockRestore();
    gif.mockReset();
  });
});
