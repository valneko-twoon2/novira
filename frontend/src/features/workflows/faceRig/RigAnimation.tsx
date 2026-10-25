// Keyframes for the Face Rig editor: save the current pose as a keyframe, and make a looping GIF that moves through
// them. Each frame is rendered by the pack, so the GIF (or the video, which also plays out in real time) takes a moment.
import { Plus, X } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { t, tCount } from '@/i18n';
import { toast } from '@/state/toasts';
import { Button, ProgressBar, Select, SliderNumber, Switch } from '@/ui';
import { animationPoses, renderGif, renderVideo, videoType, type AnimationOptions } from './animation';
import type { RigState } from './rig';

const MAX_KEYS = 8;
const FPS = ['8', '12', '15', '24'] as const;
type Format = 'gif' | 'video';

interface Keyframe {
  id: number;
  rig: RigState;
  /** The picture at that pose, when the editor had one. */
  thumb: string | null;
}

let nextKey = 1;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function RigAnimation({ imageName, current, thumb, onPick }: { imageName: string | null; current: RigState; thumb: string | null; onPick: (rig: RigState) => void }) {
  const [keys, setKeys] = useState<Keyframe[]>([]);
  const [options, setOptions] = useState<AnimationOptions>({ seconds: 0.8, fps: 12, loop: true });
  const [format, setFormat] = useState<Format>('gif');
  const [done, setDone] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const poses = animationPoses(keys.map((k) => k.rig), options);
  const rendering = done !== null;
  const canVideo = videoType() !== null;

  const make = async () => {
    if (!imageName || poses.length < 2) return;
    const controller = new AbortController();
    abort.current = controller;
    setDone(0);
    try {
      if (format === 'video') download(await renderVideo(imageName, poses, options.fps, setDone, controller.signal), 'face-rig.webm');
      else download(new Blob([(await renderGif(imageName, poses, options.fps, setDone, controller.signal)) as BlobPart], { type: 'image/gif' }), 'face-rig.gif');
      toast({ status: 'success', title: t(format === 'video' ? 'workflows.faceRig.anim.savedVideo' : 'workflows.faceRig.anim.saved') });
    } catch (e) {
      if (!controller.signal.aborted) toast({ status: 'error', title: t(format === 'video' ? 'workflows.faceRig.anim.failedVideo' : 'workflows.faceRig.anim.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      abort.current = null;
      setDone(null);
    }
  };

  return (
    <div className="rig__group rig-anim" data-testid="rig-anim">
      <span className="rig__group-title">{t('workflows.faceRig.anim.title')}</span>
      <p className="rig__hint">{t('workflows.faceRig.anim.hint')}</p>
      <div className="rig-anim__keys">
        {keys.map((k, i) => (
          <span key={k.id} className="rig-anim__key" data-testid="rig-key">
            <button type="button" className="rig-anim__thumb" onClick={() => onPick(k.rig)} aria-label={t('workflows.faceRig.anim.goTo', { n: i + 1 })} title={t('workflows.faceRig.anim.goTo', { n: i + 1 })}>
              {k.thumb ? <img src={k.thumb} alt="" draggable={false} /> : i + 1}
            </button>
            <button type="button" className="rig-anim__remove" onClick={() => setKeys((all) => all.filter((x) => x.id !== k.id))} aria-label={t('workflows.faceRig.anim.remove', { n: i + 1 })}>
              <X size={10} />
            </button>
          </span>
        ))}
        <Button size="sm" variant="outline" leftIcon={<Plus size={12} />} disabled={keys.length >= MAX_KEYS || rendering} onClick={() => setKeys((all) => [...all, { id: nextKey++, rig: structuredClone(current), thumb }])} data-testid="rig-key-add">
          {t('workflows.faceRig.anim.add')}
        </Button>
      </div>
      {keys.length >= 2 && (
        <>
          <label className="rig-anim__row">
            <span>{t('workflows.faceRig.anim.seconds')}</span>
            <SliderNumber value={options.seconds} onChange={(seconds) => setOptions((o) => ({ ...o, seconds }))} min={0.2} max={3} step={0.1} precision={1} disabled={rendering} aria-label={t('workflows.faceRig.anim.seconds')} />
          </label>
          <label className="rig-anim__row">
            <span>{t('workflows.faceRig.anim.fps')}</span>
            <Select value={String(options.fps)} onChange={(v) => setOptions((o) => ({ ...o, fps: Number(v) }))} options={FPS.map((f) => ({ value: f, label: f }))} disabled={rendering} aria-label={t('workflows.faceRig.anim.fps')} />
          </label>
          <label className="rig__mirror">
            <Switch checked={options.loop} onChange={(loop) => setOptions((o) => ({ ...o, loop }))} disabled={rendering} aria-label={t('workflows.faceRig.anim.loop')} />
            <span>{t('workflows.faceRig.anim.loop')}</span>
          </label>
          {canVideo && (
            <label className="rig-anim__row">
              <span>{t('workflows.faceRig.anim.format')}</span>
              <Select
                value={format}
                onChange={(v) => setFormat(v as Format)}
                options={[
                  { value: 'gif', label: t('workflows.faceRig.anim.formatGif') },
                  { value: 'video', label: t('workflows.faceRig.anim.formatVideo') },
                ]}
                disabled={rendering}
                aria-label={t('workflows.faceRig.anim.format')}
              />
            </label>
          )}
          {rendering ? (
            <>
              <ProgressBar value={done / poses.length} />
              <Button size="sm" variant="outline" onClick={() => abort.current?.abort()} data-testid="rig-anim-cancel">
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <>
              <span className="rig__count">{tCount('workflows.faceRig.anim.summary', poses.length, { seconds: (poses.length / options.fps).toFixed(1) })}</span>
              <Button variant="solid" scheme="invoke" disabled={!imageName} onClick={() => void make()} data-testid="rig-anim-make">
                {t(format === 'video' ? 'workflows.faceRig.anim.makeVideo' : 'workflows.faceRig.anim.make')}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
