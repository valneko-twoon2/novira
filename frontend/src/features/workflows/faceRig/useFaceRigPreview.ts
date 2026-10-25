// The Face Rig editor's connection to the pack: one request in flight at a time, the newest pose waits its turn. That
// settles at whatever rate the machine can render, so there is no delay to tune. The portrait goes along with the
// first request (and when the pack asks for it again); handle positions are taken from the first answer and from each
// `final` one, so the handles stay under the pointer during a drag.
import { useCallback, useEffect, useRef, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';

export interface FaceRigView {
  image: string | null;
  anchors: Record<string, [number, number]>;
  warning: string | null;
  error: string | null;
  busy: boolean;
}

const EMPTY: FaceRigView = { image: null, anchors: {}, warning: null, error: null, busy: false };

export function useFaceRigPreview(imageName: string | null) {
  const [view, setView] = useState<FaceRigView>(EMPTY);
  const key = useRef(`rig-${Math.random().toString(36).slice(2)}`);
  const alive = useRef(true);
  const inflight = useRef(false);
  const pending = useRef<{ rig: string; quality: 'drag' | 'final' } | null>(null);
  const needsFrame = useRef(true);
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const pump = useCallback(async () => {
    if (inflight.current || !pending.current || !imageName) return;
    inflight.current = true;
    const job = pending.current;
    pending.current = null;
    setView((v) => ({ ...v, busy: true }));
    try {
      if (sentFor.current !== imageName) needsFrame.current = true;
      const withFrame = needsFrame.current;
      const res = await backend.faceRigPreview({ nodeKey: key.current, image: withFrame ? imageName : null, rig: job.rig, quality: job.quality });
      if (!alive.current) return;
      if ('needsFrame' in res) {
        // The pack lost the prepared face (it restarted): send the picture again with the same pose. If it asks again
        // for a picture that was just sent, something is wrong; stop instead of looping.
        needsFrame.current = true;
        if (withFrame) setView((v) => ({ ...v, error: t('workflows.faceRig.notAccepted'), busy: false }));
        else pending.current ??= job;
      } else if ('error' in res) {
        setView((v) => ({ ...v, error: res.error, busy: false }));
      } else {
        needsFrame.current = false;
        sentFor.current = imageName;
        setView((v) => ({
          image: res.image,
          anchors: job.quality === 'final' || !Object.keys(v.anchors).length ? res.anchors : v.anchors,
          warning: res.settled ? null : (res.warning ?? ''),
          error: null,
          busy: false,
        }));
      }
    } catch (e) {
      if (alive.current) setView((v) => ({ ...v, error: e instanceof Error ? e.message : String(e), busy: false }));
      pending.current = null;
    } finally {
      inflight.current = false;
      if (alive.current && pending.current) void pump();
      else if (alive.current) setView((v) => (v.busy ? { ...v, busy: false } : v));
    }
  }, [imageName]);

  /** Ask for the pose; while another request runs this replaces any older waiting one. */
  const request = useCallback(
    (rig: string, quality: 'drag' | 'final') => {
      // A final request is never replaced by a drag one that comes after it.
      if (pending.current?.quality === 'final' && quality === 'drag') return;
      pending.current = { rig, quality };
      void pump();
    },
    [pump],
  );

  return { view, request };
}
