// A pose as the OpenPose picture shows it (coloured sticks on black), inside a frame the shape of the generation box,
// so a card of the ready-made poses shows the figure and where it stands. Parts outside the frame are cut off.
import { useId } from 'react';
import type { PoseObject } from '@/state/canvas';
import { POSE_COLORS, POSE_LIMBS } from '@/state/poseSkeleton';
import { pt } from '@/state/pose/pose';

export function PosePreview({ poses, width, height }: { poses: readonly PoseObject[]; width: number; height: number }) {
  const clip = useId();
  const side = Math.min(width, height);
  return (
    <svg className="pose-preview" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clip}>
          <rect width={width} height={height} />
        </clipPath>
      </defs>
      <rect width={width} height={height} fill="#000" />
      <g clipPath={`url(#${clip})`} strokeLinecap="round">
        {poses.map((o) => (
          <g key={o.id}>
            {POSE_LIMBS.map(([a, b], i) => {
              if (o.hidden.includes(a) || o.hidden.includes(b)) return null;
              const [p, q] = [pt(o.points, a), pt(o.points, b)];
              return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={POSE_COLORS[i]} strokeWidth={side * 0.02} />;
            })}
            {POSE_COLORS.map((color, j) => {
              if (o.hidden.includes(j)) return null;
              const p = pt(o.points, j);
              return <circle key={j} cx={p.x} cy={p.y} r={side * 0.014} fill={color} />;
            })}
          </g>
        ))}
      </g>
      <rect width={width} height={height} fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth={side * 0.006} />
    </svg>
  );
}
