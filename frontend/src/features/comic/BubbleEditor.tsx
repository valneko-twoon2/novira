// The editor of the selected balloon, docked at the side of the page view (towards the board) so it does not cover the
// page: its shape, its words (with bold and emphasis-dot marks), the font and the text size, vertical writing and the tail; then its look (the line, black or white, how
// thick and how shaky the line is, its width and height, its spikes or bumps, the tail's width and bend); then its outline,
// which can be shaped freely by its points on the page; and removing it. A double click on a balloon opens it; Escape, the
// close button or choosing no balloon closes it.
import { TextB, Trash, X } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { baseOutline } from '@/state/comic/balloon';
import { toggleMark, type TextMark } from '@/state/comic/balloonText';
import {
  BUBBLE_DEPTH_RANGE,
  BUBBLE_KIND_DEFAULTS,
  BUBBLE_KINDS,
  BUBBLE_LINE_WIDTH_RANGE,
  BUBBLE_LINES,
  BUBBLE_ROTATION_RANGE,
  BUBBLE_ROUGH_RANGE,
  BUBBLE_SCALE_RANGE,
  BUBBLE_SPIKES_RANGE,
  BUBBLE_STRETCH_RANGE,
  BUBBLE_TAIL_CURVE_RANGE,
  BUBBLE_TAIL_WIDTH_RANGE,
  DEFAULT_TAIL,
  kindLook,
  LETTERING_KINDS,
  type BubbleKind,
  type BubbleLine,
  type ComicBubble,
} from '@/state/comic/document';
import { DEFAULT_STAMP_ID, stampById } from '@/state/comic/stamps';
import { useComic } from '@/state/comic/store';
import { Button, Field, FontPicker, IconButton, Select, SliderNumber, Textarea } from '@/ui';
import { BalloonPreview } from './BalloonPreview';
import { StampPicker } from './StampPicker';

/** A slider of the balloon's look, with its label above it. */
function LookSlider({
  label,
  value,
  range,
  precision = 2,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  precision?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} orientation="vertical">
      <SliderNumber value={value} onChange={onChange} min={range.min} max={range.max} step={range.step} precision={precision} aria-label={label} />
    </Field>
  );
}

/** The look a balloon takes when its shape changes: the new shape's spikes, its line when one of the two has none, a tail if it had none to have. */
function changeKind(bubble: ComicBubble, kind: BubbleKind): Partial<ComicBubble> {
  const from = BUBBLE_KIND_DEFAULTS[bubble.kind];
  const to = BUBBLE_KIND_DEFAULTS[kind];
  const look = kindLook(kind);
  // A stamp's words are the id of its picture: one is chosen when the balloon becomes a stamp, and dropped when it stops being one.
  const words = kind === 'stamp' ? (stampById(bubble.text) ? {} : { text: DEFAULT_STAMP_ID }) : bubble.kind === 'stamp' ? { text: '' } : {};
  return {
    ...words,
    kind,
    spikes: look.spikes,
    depth: look.depth,
    ...(from.line === 'none' || to.line === 'none' ? { line: look.line } : {}),
    ...(to.tail && !from.tail && !bubble.tail ? { tail: { ...DEFAULT_TAIL } } : {}),
  };
}

export function BubbleEditor({ panelId, bubble }: { panelId: string; bubble: ComicBubble }) {
  const text = useRef<HTMLTextAreaElement>(null);
  const stamp = bubble.kind === 'stamp';
  const shaping = useComic((s) => s.bubbleShaping);
  const update = (patch: Partial<ComicBubble>) => useComic.getState().updateBubble(panelId, bubble.id, patch);
  const kindOptions = BUBBLE_KINDS.map((kind) => ({ value: kind, label: t(`comic.bubble.kind.${kind}`), icon: <BalloonPreview kind={kind} small /> }));
  const lineOptions: { value: BubbleLine; label: string }[] = BUBBLE_LINES.map((line) => ({ value: line, label: t(`comic.bubble.line.${line}`) }));
  const start = BUBBLE_KIND_DEFAULTS[bubble.kind];
  const lettering = LETTERING_KINDS.includes(bubble.kind);
  const hasTail = start.tail && bubble.tail !== null;
  // A balloon opened for editing takes the typing at once: its words are what is usually changed.
  useEffect(() => {
    text.current?.focus();
  }, [bubble.id]);
  // A mark goes round the words selected in the field (or is taken off them), and the same words stay selected.
  const mark = (which: TextMark) => {
    const field = text.current;
    if (!field) return;
    const next = toggleMark(bubble.text, field.selectionStart, field.selectionEnd, which);
    update({ text: next.text });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(next.start, next.end);
    });
  };
  // The mark buttons keep the field's selection: a press on them does not take the focus.
  const keepSelection = (e: { preventDefault: () => void }) => e.preventDefault();
  const shapeFreely = () => {
    if (shaping) {
      useComic.getState().setBubbleShaping(false);
      return;
    }
    if (!bubble.outline) update({ outline: baseOutline(bubble) });
    useComic.getState().setBubbleShaping(true);
  };
  return (
    <aside className="comic-bubble-editor" aria-label={t('comic.bubble.editor')} data-testid="comic-bubble-editor">
      <div className="comic-bubble-editor__head">
        <h3 className="comic-settings__title">{t('comic.bubble.editor')}</h3>
        <IconButton size="xs" label={t('common.close')} icon={<X />} onClick={() => useComic.getState().closeBubbleEditor()} data-testid="comic-bubble-editor-close" />
      </div>
      <Select<BubbleKind> value={bubble.kind} onChange={(kind) => update(changeKind(bubble, kind))} options={kindOptions} aria-label={t('comic.bubble.kindLabel')} />
      {stamp ? (
        <StampPicker value={bubble.text} onChange={(id) => update({ text: id })} />
      ) : (
        <>
        <Textarea
          ref={text}
          rows={3}
          value={bubble.text}
          placeholder={t('comic.bubble.textPlaceholder')}
          aria-label={t('comic.bubble.text')}
          onChange={(e) => update({ text: e.target.value })}
          // Escape leaves the words and closes the editor; the page's own keys (Delete, arrows) stay with the field while typing.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') useComic.getState().closeBubbleEditor();
          }}
        />
        <div className="comic-detail__row">
          <Button variant="outline" size="sm" leftIcon={<TextB />} onMouseDown={keepSelection} onClick={() => mark('bold')} data-testid="comic-bubble-bold">
            {t('comic.bubble.bold')}
          </Button>
          <Button variant="outline" size="sm" onMouseDown={keepSelection} onClick={() => mark('dots')} data-testid="comic-bubble-dots">
            {t('comic.bubble.dots')}
          </Button>
        </div>
        <p className="comic-bubble-editor__hint">{t('comic.bubble.marksHelp')}</p>
        <Field label={t('comic.bubble.font')} orientation="vertical">
          <FontPicker value={bubble.font} onChange={(font) => update({ font })} defaultLabel={t('comic.bubble.fontDefault')} label={t('comic.bubble.font')} testId="comic-bubble-font" />
        </Field>
        </>
      )}
      <LookSlider label={t('comic.bubble.size')} value={bubble.scale} range={BUBBLE_SCALE_RANGE} onChange={(scale) => update({ scale })} />
      <div className="comic-detail__row">
        {!stamp && (
          <Button variant="outline" size="sm" aria-pressed={bubble.vertical} onClick={() => update({ vertical: !bubble.vertical })} data-testid="comic-bubble-vertical">
            {t('comic.bubble.vertical')}
          </Button>
        )}
        {start.tail && (
          <Button
            variant="outline"
            size="sm"
            aria-pressed={bubble.tail !== null}
            onClick={() => update({ tail: bubble.tail ? null : { ...DEFAULT_TAIL } })}
            data-testid="comic-bubble-tail-toggle"
          >
            {t('comic.bubble.tail')}
          </Button>
        )}
        {/* Shrinks the words until they stay inside the balloon and the balloon inside the panel (see fitStep). */}
        <Button variant="outline" size="sm" title={t('comic.bubble.fitHelp')} onClick={() => useComic.getState().fitBubbles([bubble.id])} data-testid="comic-bubble-fit">
          {t('comic.bubble.fit')}
        </Button>
      </div>
      {lettering ? (
        <LookSlider
          label={t('comic.bubble.rotation')}
          value={bubble.rotation}
          range={BUBBLE_ROTATION_RANGE}
          precision={0}
          onChange={(rotation) => update({ rotation })}
        />
      ) : (
        <>
          <h4 className="comic-bubble-editor__section">{t('comic.bubble.look')}</h4>
          <div className="comic-detail__row">
            <Select<BubbleLine> value={bubble.line} onChange={(line) => update({ line })} options={lineOptions} aria-label={t('comic.bubble.lineLabel')} />
            <Button variant="outline" size="sm" aria-pressed={bubble.dark} onClick={() => update({ dark: !bubble.dark })} data-testid="comic-bubble-dark">
              {t('comic.bubble.dark')}
            </Button>
          </div>
          <LookSlider label={t('comic.bubble.lineWidth')} value={bubble.lineWidth} range={BUBBLE_LINE_WIDTH_RANGE} precision={1} onChange={(lineWidth) => update({ lineWidth })} />
          <LookSlider label={t('comic.bubble.rough')} value={bubble.rough} range={BUBBLE_ROUGH_RANGE} onChange={(rough) => update({ rough })} />
          <LookSlider label={t('comic.bubble.width')} value={bubble.width} range={BUBBLE_STRETCH_RANGE} onChange={(width) => update({ width })} />
          <LookSlider label={t('comic.bubble.height')} value={bubble.height} range={BUBBLE_STRETCH_RANGE} onChange={(height) => update({ height })} />
          {start.spikes > 0 && (
            <LookSlider label={t('comic.bubble.spikes')} value={bubble.spikes} range={BUBBLE_SPIKES_RANGE} precision={0} onChange={(spikes) => update({ spikes })} />
          )}
          {start.depth > 0 && <LookSlider label={t('comic.bubble.depth')} value={bubble.depth} range={BUBBLE_DEPTH_RANGE} onChange={(depth) => update({ depth })} />}
          {hasTail && (
            <>
              <LookSlider label={t('comic.bubble.tailWidth')} value={bubble.tailWidth} range={BUBBLE_TAIL_WIDTH_RANGE} onChange={(tailWidth) => update({ tailWidth })} />
              <LookSlider label={t('comic.bubble.tailCurve')} value={bubble.tailCurve} range={BUBBLE_TAIL_CURVE_RANGE} onChange={(tailCurve) => update({ tailCurve })} />
            </>
          )}
          <h4 className="comic-bubble-editor__section">{t('comic.bubble.outline')}</h4>
          <div className="comic-detail__row">
            <Button variant="outline" size="sm" aria-pressed={shaping} onClick={shapeFreely} data-testid="comic-bubble-shape">
              {t('comic.bubble.shapeFreely')}
            </Button>
            {bubble.outline && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={bubble.outline.smooth}
                  onClick={() => update({ outline: { ...bubble.outline!, smooth: !bubble.outline!.smooth } })}
                  data-testid="comic-bubble-smooth"
                >
                  {t('comic.bubble.smooth')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    update({ outline: null });
                    useComic.getState().setBubbleShaping(false);
                  }}
                  data-testid="comic-bubble-shape-reset"
                >
                  {t('comic.bubble.shapeReset')}
                </Button>
              </>
            )}
          </div>
          {shaping && <p className="comic-hint">{t('comic.bubble.shapeHint')}</p>}
        </>
      )}
      <div className="comic-detail__row comic-bubble-editor__foot">
        <Button
          variant="outline"
          size="sm"
          scheme="danger"
          leftIcon={<Trash />}
          onClick={() => useComic.getState().removeBubble(panelId, bubble.id)}
          data-testid="comic-bubble-remove"
        >
          {t('comic.bubble.remove')}
        </Button>
      </div>
    </aside>
  );
}
