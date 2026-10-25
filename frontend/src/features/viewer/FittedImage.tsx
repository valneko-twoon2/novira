// An image scaled to fit (contain) a box, drawn over a checkerboard limited to the image bounds.
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/ui';

export function fitSize(w: number, h: number, boxW: number, boxH: number): { width: number; height: number } {
  if (w <= 0 || h <= 0 || boxW <= 0 || boxH <= 0) return { width: 0, height: 0 };
  const s = Math.min(boxW / w, boxH / h);
  return { width: Math.floor(w * s), height: Math.floor(h * s) };
}

interface Props {
  src: string;
  width: number;
  height: number;
  boxWidth: number;
  boxHeight: number;
  pixelated?: boolean;
  /** Show `src` as a playing video, with `poster` as the first frame. */
  video?: { poster: string };
  /** `src` is a picture (the waveform) and `audio` is the sound that plays under it. */
  audio?: string;
  className?: string;
  testId?: string;
  children?: ReactNode;
}

export function FittedImage({ src, width, height, boxWidth, boxHeight, pixelated, video, audio, className, testId, children }: Props) {
  const size = fitSize(width, height, boxWidth, boxHeight);
  const style: CSSProperties = { width: size.width, height: size.height };
  return (
    <div className={cx('vimg', className)} style={style}>
      {video ? (
        <video src={src} poster={video.poster} controls loop autoPlay muted playsInline data-testid={testId} />
      ) : (
        <img src={src} alt="" draggable={false} className={cx(pixelated && 'is-pixelated')} data-testid={testId} />
      )}
      {audio && <audio className="vimg__audio" src={audio} controls autoPlay data-testid="viewer-audio" />}
      {children}
    </div>
  );
}
