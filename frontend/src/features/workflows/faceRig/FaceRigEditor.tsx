// The Face Rig editor: the portrait with handles on the face (brows, eyelids, mouth corners, jaw), a gaze pad and a
// head pad in the corner, ready-made expressions, and live rendering while a handle moves. Writes the pose into the
// node's `rig` text when applied.
import { ArrowCounterClockwise, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { backend, type FaceRigLibrary } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { Button, Modal, Spinner, Switch, cx } from '@/ui';
import {
  HANDLES,
  UNIT_PX,
  adjustedCount,
  dragHandle,
  gazeOf,
  headOf,
  parseRig,
  rangesOf,
  serializeRig,
  setGaze,
  setHead,
  togglePreset,
  type HandleId,
  type RigState,
} from './rig';
import { RigAnimation } from './RigAnimation';
import { useFaceRigPreview } from './useFaceRigPreview';

const PRESETS = ['happy', 'surprised', 'sad', 'angry', 'afraid', 'disgusted'] as const;
const labelKey = (l: string) => `workflows.faceRig.handle.${l}` as MessageKey;
const presetKey = (p: string) => `workflows.faceRig.preset.${p}` as MessageKey;

/** A round pad whose dot is a point in the unit disc; dragging moves it. */
function Pad({ label, value, onChange, onCommit }: { label: string; value: [number, number]; onChange: (x: number, y: number) => void; onCommit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const at = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1] as const;
  };
  return (
    <div className="rig-pad">
      <span className="rig-pad__label">{label}</span>
      <div
        ref={ref}
        className="rig-pad__disc nodrag"
        role="slider"
        aria-label={label}
        aria-valuetext={`${value[0].toFixed(2)}, ${value[1].toFixed(2)}`}
        aria-valuenow={0}
        tabIndex={0}
        data-testid={`rig-pad-${label}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange(...at(e));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) onChange(...at(e));
        }}
        onPointerUp={onCommit}
        onDoubleClick={() => {
          onChange(0, 0);
          onCommit();
        }}
      >
        <span className="rig-pad__dot" style={{ left: `${(value[0] + 1) * 50}%`, top: `${(value[1] + 1) * 50}%` }} />
      </div>
    </div>
  );
}

export function FaceRigEditor({ open, onOpenChange, imageName, rig, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; imageName: string | null; rig: string; onApply: (rig: string) => void }) {
  const [state, setState] = useState<RigState>(() => parseRig(rig));
  const [mirror, setMirror] = useState(true);
  const [library, setLibrary] = useState<FaceRigLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const { view, request } = useFaceRigPreview(open ? imageName : null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const drag = useRef<{ id: HandleId; x: number; y: number; base: RigState } | null>(null);
  const [active, setActive] = useState<HandleId | null>(null);
  const ranges = useMemo(() => rangesOf(library?.axes ?? []), [library]);

  // Start from the node's pose each time the editor opens, and draw it once.
  useEffect(() => {
    if (!open) return;
    const start = parseRig(rig);
    setState(start);
    request(serializeRig(start), 'final');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || library) return;
    backend.faceRigLibrary().then(setLibrary, (e: unknown) => setLibraryError(e instanceof Error ? e.message : String(e)));
  }, [open, library]);

  const update = (next: RigState, quality: 'drag' | 'final' = 'drag') => {
    setState(next);
    request(serializeRig(next), quality);
  };
  const commit = () => request(serializeRig(stateRef.current), 'final');

  const onHandleDown = (id: HandleId) => (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, x: e.clientX, y: e.clientY, base: stateRef.current };
    setActive(id);
  };
  const onHandleMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    update(dragHandle(d.base, d.id, e.clientX - d.x, e.clientY - d.y, mirror, ranges));
  };
  const onHandleUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setActive(null);
    commit();
  };

  const error = libraryError ?? view.error;
  const count = adjustedCount(state);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      closeLabel={t('common.close')}
      title={t('workflows.faceRig.title')}
      footer={
        <>
          <Button variant="ghost" leftIcon={<ArrowCounterClockwise size={14} />} disabled={count === 0} onClick={() => update({ w: {}, p: {}, rot: [0, 0, 0] }, 'final')} data-testid="rig-reset">
            {t('common.reset')}
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="solid"
            scheme="invoke"
            onClick={() => {
              onApply(serializeRig(state));
              onOpenChange(false);
            }}
            data-testid="rig-apply"
          >
            {t('common.apply')}
          </Button>
        </>
      }
    >
      <div className="rig">
        <div className="rig__stage" data-testid="rig-stage">
          {view.image ? <img className="rig__img" src={view.image} alt="" draggable={false} /> : <div className="rig__empty">{error ? null : <Spinner size={20} />}</div>}
          {view.image &&
            HANDLES.map((h) => {
              const a = view.anchors[h.id];
              if (!a) return null;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={cx('rig__handle nodrag', `rig__handle--${h.side}`, active === h.id && 'is-active')}
                  style={{ left: `${a[0] * 100}%`, top: `${a[1] * 100}%` } as CSSProperties}
                  aria-label={`${t(labelKey(h.label))}${h.side === 'C' ? '' : ` ${h.side}`}`}
                  title={t(labelKey(h.label))}
                  data-testid={`rig-handle-${h.id}`}
                  onPointerDown={onHandleDown(h.id)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                />
              );
            })}
          {view.busy && <span className="rig__busy" aria-hidden />}
          {error && (
            <p className="rig__error" role="alert">
              <WarningCircle size={14} /> {error}
            </p>
          )}
          {view.warning !== null && !error && (
            <p className="rig__warn" role="status">
              <WarningCircle size={14} /> {t('workflows.faceRig.noFace')}
            </p>
          )}
        </div>
        <aside className="rig__side">
          <p className="rig__hint">{t('workflows.faceRig.hint', { px: UNIT_PX })}</p>
          <div className="rig__pads">
            <Pad label={t('workflows.faceRig.gaze')} value={gazeOf(state)} onChange={(x, y) => update(setGaze(stateRef.current, x, y))} onCommit={commit} />
            <Pad label={t('workflows.faceRig.head')} value={headOf(state)} onChange={(x, y) => update(setHead(stateRef.current, x, y))} onCommit={commit} />
          </div>
          <div className="rig__group">
            <span className="rig__group-title">{t('workflows.faceRig.presets')}</span>
            <div className="rig__chips">
              {PRESETS.map((p) => (
                <button key={p} type="button" className={cx('rig__chip', (state.p[p] ?? 0) > 0 && 'is-on')} onClick={() => update(togglePreset(state, p), 'final')} data-testid={`rig-preset-${p}`}>
                  {t(presetKey(p))}
                </button>
              ))}
            </div>
          </div>
          <label className="rig__mirror">
            <Switch checked={mirror} onChange={setMirror} aria-label={t('workflows.faceRig.mirror')} />
            <span>{t('workflows.faceRig.mirror')}</span>
          </label>
          <span className="rig__count">{t('workflows.faceRig.adjusted', { count })}</span>
          <RigAnimation imageName={imageName} current={state} thumb={view.image} onPick={(rig) => update(structuredClone(rig), 'final')} />
        </aside>
      </div>
    </Modal>
  );
}
