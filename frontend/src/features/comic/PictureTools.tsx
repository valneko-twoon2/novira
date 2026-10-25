// The tools of the selected panel's picture in the page's toolbar: put in a picture from a file, fit it to the panel (fill
// it, or show it whole), turn it by a quarter and mirror it (the toolbar's one trash button takes it out, see
// deleteSelection). The keys of the page (Delete, the arrows, Escape) act on what is selected.
import { useRef } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowsHorizontal, ArrowsInSimple, ArrowsOutSimple, ArrowsVertical, CrosshairSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, Trash, UploadSimple } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { normalizeRotation, type ComicImageView } from '@/state/comic/document';
import { clampScale, fitImage, moveImage } from '@/state/comic/imageView';
import type { Box } from '@/state/comic/layout';
import { findPanel, useComic } from '@/state/comic/store';
import { IconButton, TOOLBAR_BUTTON_SIZE, useHotkey } from '@/ui';
import { deleteSelection, deleteTarget } from './deleteSelection';
import { useImageSize } from './useImageSize';

/** How far an arrow key moves the selected picture, as a share of its panel (with Shift, ten times as far). */
const NUDGE = 0.01;

/** How much the picture grows or shrinks with one press of the zoom buttons (or one step of Alt and the mouse wheel). */
export const SCALE_STEP = 1.1;

/**
 * The page's keys: Delete (or Backspace) takes away what is selected, as the toolbar's trash button does (see
 * deleteSelection); the arrows move the selected picture; Escape closes the balloon editor, then lets go of the selected
 * balloon or picture, then of the panel. None of them while `active` is false (the page is painted on).
 */
export function usePageKeys(box: (panelId: string) => Box | null, aspect: number, active = true) {
  const bubble = useComic((s) => s.selectedBubbleId !== null);
  const picture = useComic((s) => s.imageSelected && s.selectedPanelId !== null);
  const backdrop = useComic((s) => s.backdropSelected);
  const panelSelected = useComic((s) => s.selectedPanelId !== null);
  const deletable = useComic((s) => deleteTarget(s) !== null);
  // Delete also matches Backspace (see useHotkey).
  useHotkey('delete', deleteSelection, { enabled: active && deletable });
  useHotkey(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'], (e) => {
    const s = useComic.getState();
    const panel = s.selectedPanelId ? findPanel(s.projects, s.selectedPanelId)?.panel : undefined;
    const b = panel ? box(panel.id) : null;
    if (!panel?.imageName || !s.imageSelected || !b) return;
    const step = (e.shiftKey ? NUDGE * 10 : NUDGE) * b.width;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    // The step is in page widths; the panel box is measured the same way (its height is the page's aspect times its share).
    s.setPanelImageView(panel.id, moveImage(panel.imageView, dx, dy, { width: b.width, height: b.height * aspect }));
  }, { enabled: active && picture });
  useHotkey('escape', () => {
    const s = useComic.getState();
    if (s.backdropSelected) {
      s.selectBackdrop(false);
      return;
    }
    // The first Escape closes the balloon editor and keeps the balloon chosen; the next lets go of it.
    if (s.bubbleEditor) s.closeBubbleEditor();
    else if (s.selectedBubbleId) s.selectBubble(null);
    else if (s.imageSelected && s.selectedPanelId) s.selectPanel(s.selectedPanelId);
    else if (s.selectedPanelId) s.selectPanel(null);
  }, { enabled: active && (bubble || picture || backdrop || panelSelected) });
}

interface PictureToolsProps {
  url: string | undefined;
  view: ComicImageView | null;
  box: Box;
  aspect: number;
  /** Applies a change of the picture's view (the caller also keeps the picture selected). */
  onView: (next: Partial<ComicImageView>) => void;
  /** A file picked to be the picture. */
  onFile: (file: File) => void;
  /** Takes the picture away; without it there is no button for that (the page's toolbar has one trash button). */
  onClear?: () => void;
  /** Test ids are `<idPrefix>-upload`, `-cover`, `-contain`, ... (a panel's picture and the page's backdrop each have tools). */
  idPrefix?: string;
  /** The group's own class: the toolbar's group, or a plain row in a popover. */
  className?: string;
}

export function PictureTools({ url, view, box, aspect, onView, onFile, onClear, idPrefix = 'comic-image', className = 'comic-view__group' }: PictureToolsProps) {
  const files = useRef<HTMLInputElement>(null);
  const image = useImageSize(url);
  const panelSize = { width: box.width, height: box.height * aspect };
  return (
    <div className={className} role="group" aria-label={t('comic.image.tools')} data-testid={`${idPrefix}-tools`}>
      <IconButton
        size={TOOLBAR_BUTTON_SIZE}
        label={t('comic.panel.imageUpload')}
        icon={<UploadSimple />}
        onClick={() => files.current?.click()}
        data-testid={`${idPrefix}-upload`}
      />
      {view && url && (
        <>
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.fitCover')} icon={<ArrowsOutSimple />} onClick={() => onView(fitImage('cover', view, image, panelSize))} data-testid={`${idPrefix}-cover`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.fitContain')} icon={<ArrowsInSimple />} onClick={() => onView(fitImage('contain', view, image, panelSize))} data-testid={`${idPrefix}-contain`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.scaleDown')} icon={<MagnifyingGlassMinus />} onClick={() => onView({ scale: clampScale(view.scale / SCALE_STEP) })} data-testid={`${idPrefix}-scale-down`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.scaleUp')} icon={<MagnifyingGlassPlus />} onClick={() => onView({ scale: clampScale(view.scale * SCALE_STEP) })} data-testid={`${idPrefix}-scale-up`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.center')} icon={<CrosshairSimple />} onClick={() => onView({ cx: 0.5, cy: 0.5 })} data-testid={`${idPrefix}-center`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.rotateLeft')} icon={<ArrowCounterClockwise />} onClick={() => onView({ rotation: normalizeRotation(view.rotation - 90) })} data-testid={`${idPrefix}-rotate-left`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.rotateRight')} icon={<ArrowClockwise />} onClick={() => onView({ rotation: normalizeRotation(view.rotation + 90) })} data-testid={`${idPrefix}-rotate-right`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.flipX')} icon={<ArrowsHorizontal />} isActive={view.flipX} onClick={() => onView({ flipX: !view.flipX })} data-testid={`${idPrefix}-flip-x`} />
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.image.flipY')} icon={<ArrowsVertical />} isActive={view.flipY} onClick={() => onView({ flipY: !view.flipY })} data-testid={`${idPrefix}-flip-y`} />
          {onClear && <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.panel.imageClear')} icon={<Trash />} onClick={onClear} data-testid={`${idPrefix}-clear`} />}
        </>
      )}
      <input
        ref={files}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
