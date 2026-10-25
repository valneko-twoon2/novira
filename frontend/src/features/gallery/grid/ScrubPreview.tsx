// Hover preview of a video or audio thumbnail: moving the mouse across it scrubs to that point of the clip
// (a video shows the frame, an audio waveform shows a play-head), with a progress bar and the time.
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ImageDTO } from '@/backend';

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The play position (0..1) of a pointer inside an element. */
export function ratioOf(clientX: number, rect: { left: number; width: number }): number {
  return rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

/** Gives a thumbnail's props for the scrub behaviour, and the overlay to render inside it. */
export function useScrub(image: ImageDTO) {
  const scrubbable = image.mediaType === 'video' || image.mediaType === 'audio';
  const [active, setActive] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const pending = useRef<number | null>(null);
  const latest = useRef(0);

  const seek = useCallback((r: number) => {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration)) return;
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      v.currentTime = r * v.duration;
    });
  }, []);

  useEffect(() => () => void (pending.current !== null && cancelAnimationFrame(pending.current)), []);

  const handlers = scrubbable
    ? {
        onPointerEnter: () => setActive(true),
        onPointerLeave: () => {
          setActive(false);
          setReady(false);
        },
        onPointerMove: (e: PointerEvent<HTMLElement>) => {
          const r = ratioOf(e.clientX, e.currentTarget.getBoundingClientRect());
          setRatio(r);
          latest.current = r;
          seek(r);
        },
      }
    : {};

  const overlay = active ? (
    <>
      {image.mediaType === 'video' && (
        <video
          ref={video}
          className={ready ? 'gthumb__scrub is-ready' : 'gthumb__scrub'}
          src={image.url}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            seek(latest.current);
          }}
          onSeeked={() => setReady(true)}
        />
      )}
      {image.mediaType === 'audio' && <span className="gthumb__playhead" style={{ left: `${ratio * 100}%` }} aria-hidden />}
      <span className="gthumb__progress" aria-hidden>
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      {duration > 0 && <span className="gthumb__time">{formatTime(ratio * duration)}</span>}
    </>
  ) : null;

  return { handlers, overlay };
}
