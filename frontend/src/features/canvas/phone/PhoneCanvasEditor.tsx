// The phone's canvas editor, full screen over the phone layout: the picture on the stage (one finger paints, two zoom and
// pan), three tools at the foot (a mosaic on the picture, painting the part to change, wiping that paint), and what the
// painted part can become (erased or redrawn from an instruction). Results wait at the foot to be taken or discarded, and
// the edited picture is saved to the gallery from the top bar.
import { ArrowArcLeft, ArrowArcRight, Broom, CaretLeft, CaretRight, Check, Eraser, Eye, EyeSlash, FloppyDisk, GridFour, MagicWand, PaintBrushBroad, Trash, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { stagedPage, stagedPageCount, useCanvas } from '@/state/canvas';
import { Button, cx, SliderNumber, Textarea } from '@/ui';
import { discardCurrentStaged, saveCanvasToGallery } from '../actions';
import { TOOL_LABEL } from '../names';
import { eraseMaskedPart, redrawMaskedPart } from '../partFix';
import { CanvasStage } from '../stage/CanvasStage';
import { fitBbox } from '../view';
import { acceptOnPhone, closePhoneEdit, phoneMask, phoneToolOf, PHONE_TOOLS, takePhoneTool, type PhoneTool } from './phoneEdit';
import '../canvas.css';
import './phoneCanvas.css';

/** Room around the picture when it is fitted to the stage. */
const FIT_PADDING = 8;

const TOOL_ICONS: Record<PhoneTool, ReactNode> = {
  mosaic: <GridFour size={22} />,
  mask: <PaintBrushBroad size={22} />,
  unmask: <Eraser size={22} />,
};

const toolLabel = (tool: PhoneTool) => (tool === 'mosaic' ? t(TOOL_LABEL.mosaic) : tool === 'mask' ? t('canvas.phone.mask') : t(TOOL_LABEL.eraser));

export function PhoneCanvasEditor({ onClose }: { onClose: () => void }) {
  const tool = useCanvas((s) => phoneToolOf(s.tool));
  const staging = useCanvas((s) => s.stagedImageNames.length > 0 || s.stagingGenerating);
  const canUndo = useCanvas((s) => s.past.length > 0);
  const canRedo = useCanvas((s) => s.future.length > 0);
  const footRef = useRef<HTMLDivElement>(null);
  // The stage has measured itself by now (its effect runs first): the picture fills it.
  useEffect(() => fitBbox(useCanvas, FIT_PADDING), []);
  // However the editor goes away (closed, or its error boundary took it down), the size link comes back.
  useEffect(() => () => closePhoneEdit(), []);
  useFootForNotices(footRef);
  return (
    <div className="phone-canvas" role="dialog" aria-modal="true" aria-label={t('canvas.phone.edit')} data-testid="phone-canvas">
      <div className="phone-canvas__top">
        <button type="button" className="phone-canvas__icon" aria-label={t('phone.close')} data-testid="phone-canvas-close" onClick={onClose}>
          <X size={22} weight="bold" />
        </button>
        <span className="phone-canvas__spacer" />
        <button type="button" className="phone-canvas__icon" aria-label={t('canvas.toolbar.undo')} disabled={!canUndo} data-testid="phone-canvas-undo" onClick={() => useCanvas.getState().undo()}>
          <ArrowArcLeft size={22} />
        </button>
        <button type="button" className="phone-canvas__icon" aria-label={t('canvas.toolbar.redo')} disabled={!canRedo} data-testid="phone-canvas-redo" onClick={() => useCanvas.getState().redo()}>
          <ArrowArcRight size={22} />
        </button>
        {/* A result still waiting is not part of the picture yet: it is taken or discarded first. */}
        <Button size="md" leftIcon={<FloppyDisk size={18} />} disabled={staging} data-testid="phone-canvas-save" onClick={() => void saveCanvasToGallery(useCanvas)}>
          {t('canvas.staging.saveToGallery')}
        </Button>
      </div>
      <div className="phone-canvas__stage">
        <CanvasStage />
      </div>
      <div className="phone-canvas__foot" ref={footRef}>
        {staging ? (
          <Staging />
        ) : (
          <>
            {tool && <ToolOptions tool={tool} />}
            <div className="phone-canvas__bar" role="toolbar" aria-label={t('canvas.toolbar.tools')}>
              {PHONE_TOOLS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={cx('phone-canvas__action', x === tool && 'is-on')}
                  aria-pressed={x === tool}
                  data-testid={`phone-canvas-tool-${x}`}
                  onClick={() => takePhoneTool(x)}
                >
                  {TOOL_ICONS[x]}
                  <span>{toolLabel(x)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Keeps the notices above the editor's foot, whose height changes with the tool (phone.css reads it). */
function useFootForNotices(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.body.style.setProperty('--phone-canvas-foot', `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.removeProperty('--phone-canvas-foot');
    };
  }, [ref]);
}

/** The width of the tool in hand (and the mosaic's block size); with the mask's tools, what the painted part becomes. */
function ToolOptions({ tool }: { tool: PhoneTool }) {
  const width = useCanvas((s) => (tool === 'mosaic' ? s.mosaicWidth : tool === 'mask' ? s.brushWidth : s.eraserWidth));
  const block = useCanvas((s) => s.mosaicBlock);
  const setWidth = (v: number) => {
    const s = useCanvas.getState();
    if (tool === 'mosaic') s.setMosaicWidth(v);
    else if (tool === 'mask') s.setBrushWidth(v);
    else s.setEraserWidth(v);
  };
  const widthLabel = tool === 'mosaic' ? t('canvas.toolbar.mosaicWidth') : tool === 'mask' ? t('canvas.toolbar.brushWidth') : t('canvas.toolbar.eraserWidth');
  return (
    <div className="phone-canvas__options">
      <div className="phone-canvas__row">
        <span className="phone-canvas__label">{widthLabel}</span>
        <SliderNumber value={width} onChange={setWidth} min={1} max={600} aria-label={widthLabel} />
      </div>
      {tool === 'mosaic' && (
        <div className="phone-canvas__row">
          <span className="phone-canvas__label">{t('canvas.toolbar.mosaicBlock')}</span>
          <SliderNumber value={block} onChange={(v) => useCanvas.getState().setMosaicBlock(v)} min={2} max={128} aria-label={t('canvas.toolbar.mosaicBlock')} />
        </div>
      )}
      {tool !== 'mosaic' && <PartActions />}
    </div>
  );
}

/** Erase the painted part, or redraw it from a written instruction; both results come back to the foot. */
function PartActions() {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState<'erase' | 'redraw' | null>(null);
  const run = (what: 'erase' | 'redraw') => {
    const id = phoneMask(useCanvas.getState().entities)?.id;
    if (!id) return;
    setBusy(what);
    void (what === 'erase' ? eraseMaskedPart(id) : redrawMaskedPart(id, instruction)).finally(() => setBusy(null));
  };
  return (
    <>
      <Textarea
        className="phone-canvas__instruction"
        value={instruction}
        rows={2}
        placeholder={t('canvas.partFix.instructionPlaceholder')}
        aria-label={t('canvas.partFix.instruction')}
        data-testid="phone-canvas-instruction"
        onChange={(e) => setInstruction(e.target.value)}
      />
      <div className="phone-canvas__part">
        <Button size="md" fullWidth leftIcon={<Broom size={18} />} isLoading={busy === 'erase'} disabled={busy !== null} data-testid="phone-canvas-erase" onClick={() => run('erase')}>
          {t('canvas.phone.erase')}
        </Button>
        <Button
          size="md"
          fullWidth
          scheme="invoke"
          leftIcon={<MagicWand size={18} />}
          isLoading={busy === 'redraw'}
          disabled={busy !== null}
          data-testid="phone-canvas-redraw"
          onClick={() => run('redraw')}
        >
          {t('canvas.phone.redraw')}
        </Button>
      </div>
    </>
  );
}

/** The results waiting on the stage: step through them, hide them to compare, discard one or take it. */
function Staging() {
  const index = useCanvas((x) => stagedPage(x).index);
  const generating = useCanvas((x) => stagedPage(x).generating);
  const pages = useCanvas(stagedPageCount);
  const show = useCanvas((s) => s.stagingShowResults);
  const s = useCanvas.getState;
  return (
    <div className="phone-canvas__bar" role="toolbar" aria-label={t('canvas.staging.title')} data-testid="phone-canvas-staging">
      <button type="button" className="phone-canvas__action" aria-label={t('canvas.staging.prev')} disabled={pages < 2} onClick={() => s().setStagedIndex(index - 1)}>
        <CaretLeft size={22} />
      </button>
      <span className="phone-canvas__count" data-testid="phone-canvas-staging-count">
        {index + 1}/{pages}
      </span>
      <button type="button" className="phone-canvas__action" aria-label={t('canvas.staging.next')} disabled={pages < 2} onClick={() => s().setStagedIndex(index + 1)}>
        <CaretRight size={22} />
      </button>
      <button
        type="button"
        className="phone-canvas__action"
        aria-label={show ? t('canvas.staging.hideResults') : t('canvas.staging.showResults')}
        aria-pressed={!show}
        data-testid="phone-canvas-staging-show"
        onClick={() => s().setStagingShowResults(!show)}
      >
        {show ? <Eye size={22} /> : <EyeSlash size={22} />}
      </button>
      <button type="button" className="phone-canvas__action is-danger" disabled={generating} data-testid="phone-canvas-discard" onClick={() => discardCurrentStaged(useCanvas)}>
        <Trash size={22} />
        <span>{t('canvas.phone.discard')}</span>
      </button>
      <button type="button" className="phone-canvas__action is-accept" disabled={generating} data-testid="phone-canvas-accept" onClick={() => acceptOnPhone(useCanvas)}>
        <Check size={22} weight="bold" />
        <span>{t('canvas.staging.accept')}</span>
      </button>
    </div>
  );
}
