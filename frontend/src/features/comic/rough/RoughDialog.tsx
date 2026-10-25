// The editor of a panel's 3D rough: the set seen through the panel's camera on the left (three.js, loaded only when the
// editor opens), and on the right the things to add, the chosen one's turn and size, the camera's angle of view, and
// what the ControlNet will get (the people's pose and the depth map, baked as the panel will be). "Use" bakes the rough
// into the panel's pose and depth pictures (roughPanel.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, Cube, Cylinder, PersonSimple, Rectangle, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPanel } from '@/state/comic/document';
import { ROUGH_FOV, ROUGH_PEOPLE_MAX, ROUGH_PROPS_MAX, type ComicRough, type RoughShape } from '@/state/comic/rough';
import { depthBuffer, depthPixels, seenPeople } from '@/state/comic/roughBake';
import { addPerson, addProp, changePerson, changeProp, PERSON_SIZE, personSize, removeThing, resetCamera, resizePerson } from '@/state/comic/roughEdit';
import { applyRough, drawDepth, drawSeenPeople, roughFor } from '@/state/comic/roughPanel';
import { toast } from '@/state/toasts';
import { Button, Checkbox, ErrorBoundary, Field, Modal, SliderNumber, Spinner } from '@/ui';
import type { RoughScene } from './scene';
import './rough.css';

/** The height of the pictures that show what the ControlNet gets, in pixels. */
const PREVIEW_HEIGHT = 120;
const PREVIEW_WIDTH_MAX = 240;
const SHAPES: { shape: RoughShape; icon: typeof Cube }[] = [
  { shape: 'box', icon: Cube },
  { shape: 'plane', icon: Rectangle },
  { shape: 'cylinder', icon: Cylinder },
];

const degrees = (radians: number) => Math.round(((((radians * 180) / Math.PI + 180) % 360) + 360) % 360 - 180);
const radians = (deg: number) => (deg * Math.PI) / 180;

/** The names of the things on the set, as the list shows them: "Person 1", "Box 2". */
function thingNames(rough: ComicRough): { id: string; name: string }[] {
  const count: Partial<Record<string, number>> = {};
  const name = (kind: 'person' | RoughShape) => {
    count[kind] = (count[kind] ?? 0) + 1;
    return t(`comic.rough.name.${kind}`, { number: count[kind] });
  };
  return [...rough.people.map((p) => ({ id: p.id, name: name('person') })), ...rough.props.map((p) => ({ id: p.id, name: name(p.shape) }))];
}

/** The largest box of `aspect` that fits in `width` × `height`. */
function fitted(width: number, height: number, aspect: number): { width: number; height: number } {
  return width / height > aspect ? { width: Math.round(height * aspect), height: Math.round(height) } : { width: Math.round(width), height: Math.round(width / aspect) };
}

interface EditorProps {
  panel: ComicPanel;
  /** The panel's picture size in pixels, which the rough is baked at. */
  width: number;
  height: number;
  onClose: () => void;
}

function RoughEditor({ panel, width, height, onClose }: EditorProps) {
  const aspect = width / height;
  const [rough, setRough] = useState<ComicRough>(() => roughFor(panel, aspect));
  const [chosen, setChosen] = useState<string | null>(() => rough.people[0]?.id ?? null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const stage = useRef<HTMLDivElement | null>(null);
  const scene = useRef<RoughScene | null>(null);
  // The rough the view itself last gave, which it does not need to be shown again.
  const fromScene = useRef<ComicRough | null>(null);
  const latest = useRef({ rough, chosen });
  latest.current = { rough, chosen };
  const posePreview = useRef<HTMLCanvasElement | null>(null);
  const depthPreview = useRef<HTMLCanvasElement | null>(null);

  // The view keeps the panel's shape inside the stage.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setFrame(fitted(Math.max(1, el.clientWidth), Math.max(1, el.clientHeight), aspect));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [aspect]);

  useEffect(() => {
    if (!canvas) return;
    let cancelled = false;
    let made: RoughScene | null = null;
    void import('./scene')
      .then(({ createRoughScene }) => {
        if (cancelled) return;
        made = createRoughScene(canvas, latest.current.rough, aspect, {
          change: (next) => {
            fromScene.current = next;
            setRough(next);
          },
          select: setChosen,
        });
        made.select(latest.current.chosen);
        scene.current = made;
        setState('ready');
      })
      .catch(() => !cancelled && setState('failed'));
    return () => {
      cancelled = true;
      made?.dispose();
      scene.current = null;
    };
  }, [canvas, aspect]);

  useEffect(() => scene.current?.resize(), [frame]);
  useEffect(() => {
    if (rough !== fromScene.current) scene.current?.set(rough);
  }, [rough]);
  useEffect(() => scene.current?.select(chosen), [chosen]);

  // What the ControlNet gets, baked small a moment after the last change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = Math.min(PREVIEW_WIDTH_MAX, Math.max(16, Math.round(PREVIEW_HEIGHT * aspect)));
      const h = Math.max(16, Math.round(w / aspect));
      const buffer = depthBuffer(rough, w, h);
      const pose = posePreview.current;
      const depth = depthPreview.current;
      for (const c of [pose, depth]) {
        if (!c) continue;
        c.width = w;
        c.height = h;
      }
      const poseCtx = pose?.getContext('2d');
      if (poseCtx) drawSeenPeople(poseCtx, seenPeople(rough, buffer), w, h);
      const depthCtx = depth?.getContext('2d');
      if (depthCtx) drawDepth(depthCtx, depthPixels(buffer), w, h);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [rough, aspect]);

  const add = (made: { rough: ComicRough; id: string | null }) => {
    setRough(made.rough);
    if (made.id) setChosen(made.id);
  };
  const remove = (id: string) => {
    setRough(removeThing(rough, id));
    setChosen(null);
  };
  const apply = async () => {
    setBusy(true);
    try {
      const kept = await applyRough(panel.id, rough, width, height);
      toast(kept ? { status: 'success', title: t('comic.rough.applied') } : { status: 'warning', title: t('comic.rough.superseded') });
      onClose();
    } catch (err) {
      toast({ status: 'error', title: t('comic.rough.failed'), description: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };

  const person = rough.people.find((p) => p.id === chosen);
  const prop = rough.props.find((p) => p.id === chosen);
  const names = thingNames(rough);

  return (
    <div className="comic-rough" data-testid="comic-rough">
      <div className="comic-rough__stage" ref={stage}>
        <div className="comic-rough__frame" style={{ width: frame.width, height: frame.height }}>
          <canvas ref={setCanvas} className="comic-rough__canvas" data-testid="comic-rough-canvas" />
        </div>
        {state === 'loading' && (
          <span className="comic-rough__busy">
            <Spinner size={22} />
          </span>
        )}
        {state === 'failed' && (
          <p className="comic-rough__error" role="alert" data-testid="comic-rough-failed">
            {t('canvas.pose3d.noWebgl')}
          </p>
        )}
      </div>
      <aside className="comic-rough__side">
        <p className="comic-hint">{t('comic.rough.hint')}</p>
        <div className="comic-rough__row" role="group" aria-label={t('comic.rough.add')}>
          <Button variant="outline" size="sm" leftIcon={<PersonSimple />} disabled={rough.people.length >= ROUGH_PEOPLE_MAX} onClick={() => add(addPerson(rough))} data-testid="comic-rough-add-person">
            {t('comic.rough.kind.person')}
          </Button>
          {SHAPES.map(({ shape, icon: Icon }) => (
            <Button
              key={shape}
              variant="outline"
              size="sm"
              leftIcon={<Icon />}
              disabled={rough.props.length >= ROUGH_PROPS_MAX}
              onClick={() => add(addProp(rough, shape))}
              data-testid={`comic-rough-add-${shape}`}
            >
              {t(`comic.rough.kind.${shape}`)}
            </Button>
          ))}
        </div>
        <div className="comic-rough__list" role="list" aria-label={t('comic.rough.things')} data-testid="comic-rough-things">
          {names.map(({ id, name }) => (
            <button key={id} type="button" role="listitem" className={`comic-rough__thing${id === chosen ? ' is-chosen' : ''}`} aria-pressed={id === chosen} onClick={() => setChosen(id)}>
              {name}
            </button>
          ))}
        </div>
        {person && (
          <div className="comic-rough__group" data-testid="comic-rough-person">
            <Field label={t('comic.rough.turn')} orientation="vertical">
              <SliderNumber value={degrees(person.yaw)} min={-180} max={180} step={5} onChange={(v) => setRough(changePerson(rough, person.id, { yaw: radians(v) }))} aria-label={t('comic.rough.turn')} />
            </Field>
            <Field label={t('comic.rough.lift')} orientation="vertical">
              <SliderNumber value={Math.max(0, person.y)} min={0} max={3} step={0.05} precision={2} onChange={(v) => setRough(changePerson(rough, person.id, { y: v }))} aria-label={t('comic.rough.lift')} />
            </Field>
            <Field label={t('comic.rough.size')} orientation="vertical">
              <SliderNumber value={personSize(person)} min={PERSON_SIZE.min} max={PERSON_SIZE.max} step={5} onChange={(v) => setRough(resizePerson(rough, person.id, v))} aria-label={t('comic.rough.size')} />
            </Field>
            <Button variant="ghost" size="sm" leftIcon={<Trash />} onClick={() => remove(person.id)} data-testid="comic-rough-remove">
              {t('comic.rough.remove')}
            </Button>
          </div>
        )}
        {prop && (
          <div className="comic-rough__group" data-testid="comic-rough-prop">
            <Field label={t('comic.rough.turn')} orientation="vertical">
              <SliderNumber value={degrees(prop.yaw)} min={-180} max={180} step={5} onChange={(v) => setRough(changeProp(rough, prop.id, { yaw: radians(v) }))} aria-label={t('comic.rough.turn')} />
            </Field>
            <Field label={t('comic.rough.lift')} orientation="vertical">
              <SliderNumber value={prop.y} min={0} max={5} step={0.05} precision={2} onChange={(v) => setRough(changeProp(rough, prop.id, { y: v }))} aria-label={t('comic.rough.lift')} />
            </Field>
            <Field label={prop.shape === 'cylinder' ? t('comic.rough.diameter') : t('comic.rough.width')} orientation="vertical">
              <SliderNumber value={prop.w} min={0.05} max={10} step={0.05} precision={2} onChange={(v) => setRough(changeProp(rough, prop.id, { w: v }))} aria-label={t('comic.rough.width')} />
            </Field>
            <Field label={t('comic.rough.height')} orientation="vertical">
              <SliderNumber value={prop.h} min={0.05} max={10} step={0.05} precision={2} onChange={(v) => setRough(changeProp(rough, prop.id, { h: v }))} aria-label={t('comic.rough.height')} />
            </Field>
            {prop.shape === 'box' && (
              <Field label={t('comic.rough.depth')} orientation="vertical">
                <SliderNumber value={prop.d} min={0.05} max={10} step={0.05} precision={2} onChange={(v) => setRough(changeProp(rough, prop.id, { d: v }))} aria-label={t('comic.rough.depth')} />
              </Field>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Trash />} onClick={() => remove(prop.id)} data-testid="comic-rough-remove">
              {t('comic.rough.remove')}
            </Button>
          </div>
        )}
        {!person && !prop && <p className="comic-hint">{t('comic.rough.nothing')}</p>}
        <div className="comic-rough__group">
          <Field label={t('comic.rough.lens')} info={t('comic.rough.lensHelp')} orientation="vertical">
            <SliderNumber
              value={rough.camera.fov}
              min={ROUGH_FOV.min}
              max={ROUGH_FOV.max}
              step={1}
              onChange={(v) => setRough({ ...rough, camera: { ...rough.camera, fov: v } })}
              aria-label={t('comic.rough.lens')}
            />
          </Field>
          <div className="comic-rough__row">
            <Checkbox checked={rough.floor} onChange={(floor) => setRough({ ...rough, floor })} label={t('comic.rough.floor')} />
            <Button variant="ghost" size="sm" leftIcon={<ArrowCounterClockwise />} onClick={() => setRough(resetCamera(rough))} data-testid="comic-rough-reset-camera">
              {t('comic.rough.resetCamera')}
            </Button>
          </div>
        </div>
        <div className="comic-rough__preview" aria-label={t('comic.rough.preview')} role="group">
          <figure>
            <canvas ref={posePreview} data-testid="comic-rough-preview-pose" />
            <figcaption>{t('comic.rough.previewPose')}</figcaption>
          </figure>
          <figure>
            <canvas ref={depthPreview} data-testid="comic-rough-preview-depth" />
            <figcaption>{t('comic.rough.previewDepth')}</figcaption>
          </figure>
        </div>
        <div className="comic-rough__row comic-rough__row--end">
          <Button variant="outline" onClick={onClose} data-testid="comic-rough-cancel">
            {t('common.cancel')}
          </Button>
          <Button variant="solid" scheme="invoke" isLoading={busy} onClick={() => void apply()} data-testid="comic-rough-apply">
            {t('comic.rough.apply')}
          </Button>
        </div>
      </aside>
    </div>
  );
}

/** The 3D rough's editor for one panel, in a window of its own. */
export function RoughDialog({ open, onClose, ...props }: EditorProps & { open: boolean }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} size="xl" closeLabel={t('common.close')} title={t('comic.rough.title')}>
      <ErrorBoundary area="comic-rough">
        <RoughEditor {...props} onClose={onClose} />
      </ErrorBoundary>
    </Modal>
  );
}
