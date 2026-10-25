// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoseStage } from './PoseStage';
import { POSE_JOINT_NAMES } from '@/state/poseSkeleton';
import { PRESETS, copyPose, type Pose } from './poseModel';

let latest: Pose = [];
const joint = (name: string) => screen.getByTestId(`pose-joint-${name}`);

function Harness() {
  const [pose, setPose] = useState<Pose>(() => copyPose(PRESETS.standing));
  latest = pose;
  return <PoseStage pose={pose} width={800} height={1000} onChange={setPose} />;
}

afterEach(() => cleanup());

describe('the pose stage', () => {
  it('has a handle for each of the 18 joints, named for screen readers', () => {
    render(<Harness />);
    expect(screen.getAllByRole('slider')).toHaveLength(POSE_JOINT_NAMES.length);
    expect(screen.getByTestId('pose-joint-rightWrist').getAttribute('aria-label')).toBeTruthy();
  });

  it('moves a joint with the arrow keys, further with shift, and leaves the other joints alone', () => {
    render(<Harness />);
    const wrist = POSE_JOINT_NAMES.indexOf('rightWrist');
    const before = PRESETS.standing[wrist]!;
    fireEvent.keyDown(screen.getByTestId('pose-joint-rightWrist'), { key: 'ArrowRight' });
    expect(latest[wrist]!.x).toBeCloseTo(before.x + 0.01);
    expect(latest[wrist]!.y).toBeCloseTo(before.y);
    fireEvent.keyDown(screen.getByTestId('pose-joint-rightWrist'), { key: 'ArrowUp', shiftKey: true });
    expect(latest[wrist]!.y).toBeCloseTo(before.y - 0.05);
    expect(latest[POSE_JOINT_NAMES.indexOf('leftWrist')]).toEqual(PRESETS.standing[POSE_JOINT_NAMES.indexOf('leftWrist')]);
  });

  it('ignores other keys', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId('pose-joint-nose'), { key: 'a' });
    expect(latest).toEqual(PRESETS.standing);
  });
});

describe('dragging a joint with the pointer', () => {
  const stubBox = () => {
    const stage = screen.getByTestId('pose-stage') as unknown as SVGSVGElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 500, right: 400, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
    stage.setPointerCapture = vi.fn();
    return stage;
  };
  const point = (x: number, y: number) => ({ clientX: x * 400, clientY: y * 500, pointerId: 1 });

  it('picks up the joint under the press, follows the pointer and lets go on release', () => {
    render(<Harness />);
    const stage = stubBox();
    const nose = POSE_JOINT_NAMES.indexOf('nose');
    const start = PRESETS.standing[nose]!;
    fireEvent.pointerDown(stage, point(start.x, start.y));
    expect(stage.setPointerCapture).toHaveBeenCalledWith(1);
    expect(joint('nose').getAttribute('class')).toContain('is-dragging');
    fireEvent.pointerMove(stage, point(0.7, 0.3));
    expect(latest[nose]).toEqual({ x: 0.7, y: 0.3 });
    fireEvent.pointerUp(stage);
    expect(joint('nose').getAttribute('class')).not.toContain('is-dragging');
    fireEvent.pointerMove(stage, point(0.1, 0.1));
    expect(latest[nose]).toEqual({ x: 0.7, y: 0.3 });
  });

  it('ignores a press that is far from every joint, and a cancelled drag stops', () => {
    render(<Harness />);
    const stage = stubBox();
    fireEvent.pointerDown(stage, point(0.02, 0.98));
    expect(stage.setPointerCapture).not.toHaveBeenCalled();
    expect(latest).toEqual(PRESETS.standing);
    const wrist = PRESETS.standing[POSE_JOINT_NAMES.indexOf('leftWrist')]!;
    fireEvent.pointerDown(stage, point(wrist.x, wrist.y));
    fireEvent.pointerCancel(stage);
    fireEvent.pointerMove(stage, point(0.9, 0.9));
    expect(latest[POSE_JOINT_NAMES.indexOf('leftWrist')]!.x).toBeCloseTo(wrist.x, 1);
  });
});
