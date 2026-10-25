// A document-space box (an image) placed on its zoom surface through the current view, over the checkerboard.
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/ui';
import { boxToScreen, type Box, type ViewTransform } from '@/ui/zoomMath';

interface Props {
  view: ViewTransform;
  box: Box;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ZoomFrame({ view, box, className, style, children }: Props) {
  const r = boxToScreen(box, view);
  const placed: CSSProperties = {
    ...style,
    width: Math.round(r.width),
    height: Math.round(r.height),
    transform: `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`,
  };
  return (
    <div className={cx('vimg vzoom__frame', className)} style={placed}>
      {children}
    </div>
  );
}
