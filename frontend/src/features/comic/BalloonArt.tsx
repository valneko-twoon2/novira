// A balloon's outline as an SVG, drawn as the saved page draws it (see pageRender): each stroke of its line centred on the
// outline, then the fill over the inner half (so the tail and the body make one shape), then the ink of a flash. The page
// draws it in the balloon's own box, and the balloon list draws it small to show what each balloon looks like.
import type { CSSProperties } from 'react';
import { DASH, lineStrokes, polyPath, type BalloonShape } from '@/state/comic/balloon';
import type { ComicBubble } from '@/state/comic/document';
import { cx } from '@/ui';

interface Props {
  shape: BalloonShape;
  look: Pick<ComicBubble, 'line' | 'dark' | 'lineWidth'>;
  /** The width of one line, as a CSS length: a tenth of the text's size on the page, a pixel or so in the list. */
  unit: string;
  viewBox?: string;
  className?: string;
  style?: CSSProperties;
}

export function BalloonArt({ shape, look, unit, viewBox = '0 0 1 1', className, style }: Props) {
  const outline = polyPath(shape.body ? [...shape.tail, shape.body] : shape.tail);
  const parts = shape.body ? [...shape.tail, shape.body] : shape.tail;
  const dash = look.line === 'dashed' ? DASH.map((d) => `calc(${unit} * ${d})`).join(' ') : undefined;
  return (
    <svg className={cx('comic-balloon', className)} viewBox={viewBox} preserveAspectRatio="none" style={style} aria-hidden="true" focusable="false">
      {outline &&
        lineStrokes(look.line).map((stroke, i) => (
          <path
            key={i}
            d={outline}
            className={cx('comic-balloon__line', !stroke.ink && 'is-paper')}
            style={{ strokeWidth: `calc(${unit} * ${stroke.widths * look.lineWidth})`, strokeDasharray: dash }}
          />
        ))}
      {/* Each part is filled alone, so the tail and the body make one shape where they overlap. */}
      {parts.map((part, i) => (
        <path key={i} d={polyPath([part])} className={cx('comic-balloon__fill', look.dark && 'is-dark')} />
      ))}
      {shape.ink.length > 0 && <path d={polyPath(shape.ink)} className="comic-balloon__ink" />}
    </svg>
  );
}
