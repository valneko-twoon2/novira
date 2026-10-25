// The 3D pose editor: the pose of the selected control layer (or a standing figure) as a 3D figure to drag joints on and
// turn round; "Apply" puts the figure as seen back on the canvas as a flat pose that remembers its depth. The 3D view
// (three.js) is loaded only when the editor opens.
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { usePose3dDialog } from '@/state/dialogs/pose3d';
import { toast } from '@/state/toasts';
import { Button, Modal, Spinner } from '@/ui';
import { bakeView, length3, liftPose, type Lifted } from '@/state/pose/math3d';
import { applyPose3d, pose3dSource, type Pose3dSource } from './pose3dActions';
import type { PoseScene } from './scene';
import './pose3d.css';

/** The views the buttons turn to: yaw and pitch in radians. */
const VIEWS = [
  { id: 'front', label: 'canvas.pose3d.front', yaw: 0, pitch: 0 },
  { id: 'side', label: 'canvas.pose3d.side', yaw: Math.PI / 2, pitch: 0 },
  { id: 'back', label: 'canvas.pose3d.back', yaw: Math.PI, pitch: 0 },
  { id: 'top', label: 'canvas.pose3d.top', yaw: 0, pitch: Math.PI / 2 },
] as const;

export function PoseEditor3DDialog() {
  const open = usePose3dDialog((s) => s.open);
  const close = usePose3dDialog((s) => s.close);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const scene = useRef<PoseScene | null>(null);
  const source = useRef<Pose3dSource | null>(null);
  const lifted = useRef<Lifted | null>(null);

  useEffect(() => {
    if (!open || !canvas) return;
    let cancelled = false;
    let made: PoseScene | null = null;
    setState('loading');
    const from = pose3dSource();
    const start = liftPose(from.pose);
    source.current = from;
    lifted.current = start;
    const radius = Math.max(60, ...start.joints.map(length3));
    void import('./scene')
      .then(({ createPoseScene }) => {
        if (cancelled) return;
        made = createPoseScene(canvas, start.joints, from.pose.hidden, radius, () => undefined);
        scene.current = made;
        setState('ready');
      })
      .catch(() => !cancelled && setState('failed'));
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scene.current?.resize());
    watch?.observe(canvas);
    return () => {
      cancelled = true;
      watch?.disconnect();
      made?.dispose();
      scene.current = null;
    };
  }, [open, canvas]);

  const apply = () => {
    const sc = scene.current;
    const from = source.current;
    const base = lifted.current;
    if (!sc || !from || !base) return;
    const view = sc.view();
    applyPose3d(from, bakeView({ joints: sc.joints(), center: base.center }, from.pose.hidden, view.yaw, view.pitch));
    toast({ status: 'success', title: t('canvas.pose3d.applied') });
    close();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} size="lg" closeLabel={t('common.close')} title={t('canvas.pose3d.menu')}>
      <div className="pose3d" data-testid="pose3d-dialog">
        <div className="pose3d__stage">
          <canvas ref={setCanvas} className="pose3d__canvas" data-testid="pose3d-canvas" />
          {state === 'loading' && (
            <span className="pose3d__busy">
              <Spinner size={22} />
            </span>
          )}
          {state === 'failed' && (
            <p className="pose3d__error" role="alert" data-testid="pose3d-failed">
              {t('canvas.pose3d.noWebgl')}
            </p>
          )}
        </div>
        <aside className="pose3d__side">
          <p className="pose3d__text">{t('canvas.pose3d.hint')}</p>
          <div className="pose3d__row">
            {VIEWS.map((v) => (
              <Button key={v.id} variant="outline" disabled={state !== 'ready'} onClick={() => scene.current?.setView(v.yaw, v.pitch)} data-testid={`pose3d-view-${v.id}`}>
                {t(v.label)}
              </Button>
            ))}
          </div>
          <Button variant="ghost" disabled={state !== 'ready'} onClick={() => scene.current?.reset()} data-testid="pose3d-reset">
            {t('canvas.pose3d.reset')}
          </Button>
          <div className="pose3d__row pose3d__row--end">
            <Button variant="outline" onClick={close} data-testid="pose3d-cancel">
              {t('common.cancel')}
            </Button>
            <Button variant="solid" scheme="invoke" disabled={state !== 'ready'} onClick={apply} data-testid="pose3d-apply">
              {t('canvas.pose3d.apply')}
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
