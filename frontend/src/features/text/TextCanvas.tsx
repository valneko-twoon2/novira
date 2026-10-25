// Main area of the Text tab: the canvas (preview and direct editing) with its toolbar.
import { ArrowClockwise, ArrowCounterClockwise, ArrowsOut, FloppyDisk, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { findImage } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { toast } from '@/state/toasts';
import { Button, IconButton, ImageDropZone } from '@/ui';
import { saveSceneToGallery } from './saveScene';
import { useCanvasEditing } from './useCanvasEditing';
import { useScenePreview } from './useScenePreview';
import './text.css';

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function TextCanvas() {
  const scene = useTextEditor((s) => s.scene);
  const selectedId = useTextEditor((s) => s.selectedId);
  const canUndo = useTextEditor((s) => s.past.length > 0);
  const canRedo = useTextEditor((s) => s.future.length > 0);
  const store = useTextEditor;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // CSS pixels per image pixel: fitted to the area unless zoomed by hand.
  const fit = area.width > 0 ? Math.min((area.width - 32) / scene.width, (area.height - 32) / scene.height, 1) : 1;
  const cssScale = Math.max(0.02, zoom ?? fit);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { base, halves } = useScenePreview(scene, selectedId, cssScale, canvas, overlay);
  const pointer = useCanvasEditing(overlay, halves, scene, cssScale);

  const stepZoom = (dir: 1 | -1) => {
    const current = zoom ?? fit;
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
    if (next) setZoom(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSceneToGallery(scene, base);
      toast({ status: 'success', title: t('text.saved') });
    } catch (e) {
      toast({ status: 'error', title: t('text.saveFailed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const cssW = scene.width * cssScale;
  const cssH = scene.height * cssScale;
  return (
    <div className="tx-main" data-testid="text-canvas">
      <div className="tx-toolbar">
        <IconButton label={t('text.undo')} icon={<ArrowCounterClockwise />} size="sm" disabled={!canUndo} onClick={() => store.getState().undo()} />
        <IconButton label={t('text.redo')} icon={<ArrowClockwise />} size="sm" disabled={!canRedo} onClick={() => store.getState().redo()} />
        <span className="tx-toolbar__sep" />
        <IconButton label={t('text.zoom.out')} icon={<MagnifyingGlassMinus />} size="sm" onClick={() => stepZoom(-1)} />
        <span className="tx-toolbar__zoom">{Math.round(cssScale * 100)}%</span>
        <IconButton label={t('text.zoom.in')} icon={<MagnifyingGlassPlus />} size="sm" onClick={() => stepZoom(1)} />
        <IconButton label={t('text.zoom.fit')} icon={<ArrowsOut />} size="sm" onClick={() => setZoom(null)} />
        <span className="tx-toolbar__size">
          {scene.width} × {scene.height}
        </span>
        <span className="tx-toolbar__spacer" />
        <Button variant="solid" scheme="invoke" leftIcon={<FloppyDisk />} isLoading={saving} onClick={() => void save()} data-testid="text-save">
          {t('text.save')}
        </Button>
      </div>
      <ImageDropZone
        className="tx-stage"
        label={t('text.bg.drop')}
        onImages={(names) => {
          const img = findImage(names[0] ?? null);
          if (img) store.getState().setBackground({ kind: 'image', imageName: img.name }, { width: img.width, height: img.height });
        }}
      >
        <div className="tx-scroll" ref={stage}>
          <div className="tx-sheet" style={{ width: cssW, height: cssH }}>
            <canvas ref={canvas} className="tx-canvas" style={{ width: cssW, height: cssH }} />
            <canvas ref={overlay} className="tx-canvas tx-overlay" style={{ width: cssW, height: cssH }} {...pointer} data-testid="text-overlay" />
          </div>
          {scene.layers.length === 0 && <p className="tx-hint">{t('text.hint.empty')}</p>}
        </div>
      </ImageDropZone>
    </div>
  );
}
