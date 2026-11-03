// Floating staging toolbar shown while canvas results wait to be accepted or discarded; while more are being made, the
// last page is the generating one.
import { CaretLeft, CaretRight, Check, DotsSixVertical, Eye, EyeSlash, FloppyDisk, Trash, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { stagedPage, stagedPageCount } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { setDeferredDrag } from '@/state/dnd';
import { IconButton, TOOLBAR_BUTTON_SIZE, Tooltip } from '@/ui';
import { acceptStaged, discardAllStaged, discardCurrentStaged, saveStagedToGallery } from '../actions';
import { CANVAS_STAGED_DRAG } from '../dragSources';

/** The staged results of the surrounding store; `inline` puts the bar in a toolbar of the host instead of floating over the stage. */
export function StagingToolbar({ inline = false }: { inline?: boolean } = {}) {
  const names = useCanvasStore((s) => s.stagedImageNames);
  const index = useCanvasStore((s) => stagedPage(s).index);
  // On the generating page there is no result yet to accept, save or discard.
  const generating = useCanvasStore((s) => stagedPage(s).generating);
  const pages = useCanvasStore(stagedPageCount);
  const show = useCanvasStore((s) => s.stagingShowResults);
  const setIndex = useCanvasStore((s) => s.setStagedIndex);
  const setShow = useCanvasStore((s) => s.setStagingShowResults);
  const store = useCanvasStoreApi();
  if (!names.length) return null;
  return (
    <div className={inline ? 'canvas-staging canvas-staging--inline' : 'canvas-staging'} role="toolbar" aria-label={t('canvas.staging.title')} data-testid="canvas-staging">
      <Tooltip content={t('canvas.staging.dragHint')}>
        <span
          className="canvas-staging__grip"
          draggable
          role="img"
          aria-label={t('canvas.staging.dragHint')}
          data-testid="canvas-staging-drag"
          onDragStart={(e) => setDeferredDrag(e, CANVAS_STAGED_DRAG, names[index] ?? '')}
        >
          <DotsSixVertical size={18} />
        </span>
      </Tooltip>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={`${t('canvas.staging.prev')} (←)`} icon={<CaretLeft />} onClick={() => setIndex(index - 1)} disabled={pages < 2} />
      <span className="canvas-staging__count" data-testid="canvas-staging-count">
        {index + 1}/{pages}
      </span>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={`${t('canvas.staging.next')} (→)`} icon={<CaretRight />} onClick={() => setIndex(index + 1)} disabled={pages < 2} data-testid="canvas-staging-next" />
      <span className="canvas-staging__sep" />
      <IconButton
        size={TOOLBAR_BUTTON_SIZE}
        label={`${t('canvas.staging.accept')} (Enter)`}
        icon={<Check />}
        scheme="invoke"
        variant="solid"
        onClick={() => acceptStaged(store)}
        disabled={generating}
        data-testid="canvas-staging-accept"
      />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={show ? t('canvas.staging.hideResults') : t('canvas.staging.showResults')} icon={show ? <Eye /> : <EyeSlash />} onClick={() => setShow(!show)} />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.staging.saveToGallery')} icon={<FloppyDisk />} onClick={() => void saveStagedToGallery(store)} disabled={generating} />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.staging.discard')} icon={<Trash />} scheme="danger" onClick={() => discardCurrentStaged(store)} disabled={generating} />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={`${t('canvas.staging.discardAll')} (Esc)`} icon={<X />} scheme="danger" onClick={() => discardAllStaged(store)} />
    </div>
  );
}
