// The editing surface of the pose: the skeleton drawn over a black picture of the chosen size, every joint a handle
// that is dragged with the pointer or moved with the arrow keys.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '@/i18n';
import { POSE_COLORS, POSE_JOINT_NAMES, POSE_LIMBS } from '@/state/poseSkeleton';
import { movePoint, nearestJoint, type Pose } from './poseModel';

/** Handles are this big on a picture 512 pixels on its short side (the same scale as the drawn pose). */
const HANDLE = 9;
/** How close (in the short side's unit) a press has to be to a joint to pick it up. */
const PICK_RADIUS = 0.045;
const KEY_STEP = 0.01;

export function PoseStage({ pose, width, height, onChange }: { pose: Pose; width: number; height: number; onChange: (pose: Pose) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const unit = Math.min(width, height) / 512;

  const at = (e: PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    const joint = nearestJoint(pose, at(e), width / height, PICK_RADIUS);
    if (joint === null) return;
    svg.current!.setPointerCapture(e.pointerId);
    setDragging(joint);
    onChange(movePoint(pose, joint, at(e)));
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging !== null) onChange(movePoint(pose, dragging, at(e)));
  };
  const up = () => setDragging(null);

  const key = (index: number) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const point = pose[index]!;
    onChange(movePoint(pose, index, { x: point.x + delta[0]!, y: point.y + delta[1]! }));
  };

  return (
    <svg
      ref={svg}
      className="pose__stage"
      viewBox={`0 0 ${width} ${height}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      role="group"
      aria-label={t('pose.stage')}
      data-testid="pose-stage"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <rect width={width} height={height} className="pose__bg" />
      {POSE_LIMBS.map(([a, b], i) => (
        <line key={i} x1={pose[a]!.x * width} y1={pose[a]!.y * height} x2={pose[b]!.x * width} y2={pose[b]!.y * height} stroke={POSE_COLORS[i]} strokeWidth={HANDLE * unit * 0.7} strokeLinecap="round" opacity={0.7} />
      ))}
      {pose.map((point, i) => (
        <circle
          key={POSE_JOINT_NAMES[i]}
          className={dragging === i ? 'pose__joint is-dragging' : 'pose__joint'}
          cx={point.x * width}
          cy={point.y * height}
          r={HANDLE * unit}
          fill={POSE_COLORS[i]}
          tabIndex={0}
          role="slider"
          aria-label={t(`pose.joint.${POSE_JOINT_NAMES[i]!}`)}
          aria-valuetext={`${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`}
          data-testid={`pose-joint-${POSE_JOINT_NAMES[i]}`}
          onKeyDown={key(i)}
        />
      ))}
    </svg>
  );
}
