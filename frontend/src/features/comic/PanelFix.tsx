// Redrawing a part of the selected panel's picture: the toolbar button that starts it, the strip under the toolbar (brush,
// what to draw there, how far it may change, Redraw and Cancel), and the surface over the panel that is painted on. The
// painting stays in fractions of the panel; redrawPart turns it into a mask of the picture and queues the job.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowCounterClockwise, Eraser, PaintBrush } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPanel } from '@/state/comic/document';
import { useComicFix } from '@/state/comic/fixState';
import { redrawPart } from '@/state/comic/generate';
import type { Box } from '@/state/comic/layout';
import { FIX_BRUSH, FIX_STRENGTH, hasFix } from '@/state/comic/panelFix';
import { Button, IconButton, Slider, TextInput, TOOLBAR_BUTTON_SIZE } from '@/ui';

/** The toolbar button that starts (or ends) marking the selected panel's picture. */
export function PanelFixButton({ panel }: { panel: ComicPanel }) {
  const on = useComicFix((s) => s.panelId === panel.id);
  return (
    <IconButton
      size={TOOLBAR_BUTTON_SIZE}
      label={t('comic.fix.start')}
      icon={<PaintBrush />}
      isActive={on}
      onClick={() => (on ? useComicFix.getState().stop() : useComicFix.getState().start(panel.id))}
      data-testid="comic-fix"
    />
  );
}

/** The strip under the toolbar while a panel's picture is marked; it ends the marking when another panel is selected. */
export function PanelFixBar({ selectedPanelId }: { selectedPanelId: string | null }) {
  const fix = useComicFix();
  useEffect(() => {
    if (fix.panelId && fix.panelId !== selectedPanelId) useComicFix.getState().stop();
  }, [fix.panelId, selectedPanelId]);
  if (!fix.panelId || fix.panelId !== selectedPanelId) return null;
  const marked = hasFix({ strokes: fix.strokes, boxes: [] });
  const redraw = async () => {
    const s = useComicFix.getState();
    if (!s.panelId) return;
    const queued = await redrawPart(s.panelId, { strokes: s.strokes, boxes: [] }, { words: s.words, strength: s.strength });
    if (queued) useComicFix.getState().stop();
  };
  return (
    <div className="comic-fixbar" role="group" aria-label={t('comic.fix.title')} data-testid="comic-fix-bar">
      <span className="comic-fixbar__title">{t('comic.fix.title')}</span>
      <label className="comic-fixbar__field">
        <span>{t('comic.fix.brush')}</span>
        <Slider value={fix.brush} onChange={fix.setBrush} min={FIX_BRUSH.min} max={FIX_BRUSH.max} step={FIX_BRUSH.step} aria-label={t('comic.fix.brush')} className="comic-fixbar__slider" />
      </label>
      <IconButton size="sm" label={t('comic.fix.undoStroke')} icon={<ArrowCounterClockwise />} disabled={!fix.strokes.length} onClick={fix.undoStroke} data-testid="comic-fix-undo" />
      <IconButton size="sm" label={t('comic.fix.clear')} icon={<Eraser />} disabled={!fix.strokes.length} onClick={fix.clear} data-testid="comic-fix-clear" />
      <TextInput className="comic-fixbar__words" value={fix.words} placeholder={t('comic.fix.wordsPlaceholder')} aria-label={t('comic.fix.words')} onChange={(e) => fix.setWords(e.target.value)} data-testid="comic-fix-words" />
      <label className="comic-fixbar__field">
        <span>{t('comic.fix.strength')}</span>
        <Slider value={fix.strength} onChange={fix.setStrength} min={FIX_STRENGTH.min} max={FIX_STRENGTH.max} step={FIX_STRENGTH.step} aria-label={t('comic.fix.strength')} className="comic-fixbar__slider" />
      </label>
      <Button size="sm" variant="solid" scheme="invoke" disabled={!marked} onClick={() => void redraw()} data-testid="comic-fix-go">
        {t('comic.fix.go')}
      </Button>
      <Button size="sm" variant="outline" onClick={fix.stop} data-testid="comic-fix-cancel">
        {t('common.cancel')}
      </Button>
    </div>
  );
}

/** The place of a press on the surface, in fractions of it; null outside it. */
function at(e: ReactPointerEvent<HTMLElement>): { x: number; y: number; aspect: number } | null {
  const r = e.currentTarget.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, aspect: r.height / r.width };
}

/** The surface over the marked panel (its box on the page), which takes the brush and shows what is painted. */
export function PanelFixLayer({ panelId, box, aspect }: { panelId: string; box: Box; aspect: number }) {
  const fix = useComicFix();
  const pointer = useRef<number | null>(null);
  if (fix.panelId !== panelId) return null;
  // The panel's height over its width, as the page shows it: the drawing is laid out in panel widths both ways.
  const tall = (box.height * aspect) / box.width;
  return (
    <div
      className="comic-fix"
      role="application"
      aria-label={t('comic.fix.surface')}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
      data-testid="comic-fix-surface"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // The page's own press (choosing or carrying a panel) does not see the brush.
        e.stopPropagation();
        const p = at(e);
        if (!p) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointer.current = e.pointerId;
        useComicFix.getState().begin(p.x, p.y);
      }}
      onPointerMove={(e) => {
        if (pointer.current !== e.pointerId) return;
        const p = at(e);
        if (p) useComicFix.getState().extend(p.x, p.y, p.aspect);
      }}
      onPointerUp={() => (pointer.current = null)}
      onPointerCancel={() => (pointer.current = null)}
    >
      <svg className="comic-fix__paint" viewBox={`0 0 1 ${tall}`} preserveAspectRatio="none" aria-hidden="true">
        {fix.strokes.map((s, i) =>
          s.points.length === 2 ? (
            <circle key={i} cx={s.points[0]} cy={s.points[1]! * tall} r={s.width / 2} />
          ) : (
            <polyline key={i} points={pairs(s.points, tall)} strokeWidth={s.width} />
          ),
        )}
      </svg>
    </div>
  );
}

/** A stroke's points as an SVG polyline's list, with y in panel widths. */
const pairs = (points: number[], tall: number) => {
  const out: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push(`${points[i]},${points[i + 1]! * tall}`);
  return out.join(' ');
};
