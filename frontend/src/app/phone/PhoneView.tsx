// The picture open over the phone layout, full screen: a job being drawn (until it ends, then the picture it made), or
// a stored picture with the fingers' zoom and swipe, its place in the board, and what can be done with it.
import { CaretLeft, CaretRight, DownloadSimple, Info, Lightning, List, Star, Trash, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { ImageDTO, QueueItem } from '@/backend';
import { downloadImages, recall, setStarred } from '@/features/gallery/actions';
import { SingleImageMenu } from '@/features/gallery/menus/SingleImageMenu';
import { requestDeleteImages } from '@/features/gallery/deleteRequest';
import { useElementSize } from '@/features/gallery/useElementSize';
import { fitSize } from '@/features/viewer/FittedImage';
import { LiveView } from '@/features/viewer/LiveView';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useGeneratingItems } from '@/state/generating';
import { useQueue } from '@/state/queue';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, cx } from '@/ui';
import { usePhone, usePhoneImages, type PhoneView as View } from './phoneStore';
import { usePictureGestures } from './usePictureGestures';

const PAD = 12;

export function PhoneView() {
  const view = usePhone((s) => s.view);
  if (view?.kind === 'live') return <LiveScreen itemId={view.itemId} />;
  if (view?.kind === 'image') return <PictureScreen name={view.name} />;
  return null;
}

const show = (view: View) => usePhone.getState().show(view);

/** The job being drawn, as large as the screen allows. When it ends, the picture it made takes its place. */
function LiveScreen({ itemId }: { itemId: number }) {
  const item = useGeneratingItems().find((i) => i.id === itemId);
  const ended = useQueue((s) => (item ? null : s.items.find((i) => i.id === itemId)));
  const made = useGallery((s) => (ended?.imageName ? s.images.find((i) => i.name === ended.imageName) : undefined));
  useEffect(() => {
    if (item) return;
    show(made ? { kind: 'image', name: made.name } : null);
  }, [item, made]);
  return item ? <LiveStage item={item} /> : null;
}

/** Mounted with its stage, so the stage is measured from the first frame. */
function LiveStage({ item }: { item: QueueItem }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);
  return (
    <div className="phone-view" role="dialog" aria-modal="true" aria-label={t('phone.openLive')} data-testid="phone-view">
      <div className="phone-view__top">
        <CloseButton />
      </div>
      <div className="phone-view__stage" ref={stageRef}>
        <LiveView item={item} boxWidth={Math.max(0, stage.width - 2 * PAD)} boxHeight={Math.max(0, stage.height - 2 * PAD - 48)} />
      </div>
    </div>
  );
}

function CloseButton() {
  return (
    <button type="button" className="phone-view__icon" aria-label={t('phone.close')} data-testid="phone-view-close" onClick={() => show(null)}>
      <X size={22} weight="bold" />
    </button>
  );
}

/** A stored picture of the board. A picture deleted while shown gives way to the one that took its place, or closes. */
function PictureScreen({ name }: { name: string }) {
  const list = usePhoneImages();
  const image = useGallery((s) => s.images.find((i) => i.name === name));
  const index = list.findIndex((i) => i.name === name);
  const lastIndex = useRef(index);
  if (index >= 0) lastIndex.current = index;
  useEffect(() => {
    if (image) return;
    const next = list[Math.min(lastIndex.current, list.length - 1)];
    show(next ? { kind: 'image', name: next.name } : null);
  }, [image, list]);
  if (!image) return null;
  // A picture outside the board's list (a draft) has no neighbours to step to.
  const go = (step: 1 | -1) => {
    if (index < 0) return;
    const next = list[index + step];
    if (next) show({ kind: 'image', name: next.name });
  };
  return <PictureStage image={image} index={index} count={list.length} onStep={go} />;
}

function PictureStage({ image, index, count, onStep }: { image: ImageDTO; index: number; count: number; onStep: (step: 1 | -1) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);
  const [info, setInfo] = useState(false);
  // The picture's menu is the desktop's context menu (the same items, less those that go to screens a phone has not): the
  // button asks the stage for it where the button is, and a long press on the picture opens it too.
  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    stageRef.current?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.right, clientY: box.bottom }));
  };
  const fitted = fitSize(image.width, image.height, Math.max(0, stage.width - 2 * PAD), Math.max(0, stage.height - 2 * PAD));
  const { view, drag, handlers } = usePictureGestures({
    picture: fitted,
    stage,
    resetKey: image.name,
    onSwipe: (direction) => onStep(direction === 'next' ? 1 : -1),
  });
  return (
    <div className="phone-view" role="dialog" aria-modal="true" aria-label={image.name} data-testid="phone-view">
      <div className="phone-view__top">
        <CloseButton />
        <span className="phone-view__place" data-testid="phone-view-place">
          {index >= 0 ? t('phone.place', { index: index + 1, count }) : ''}
        </span>
        <button
          type="button"
          className={cx('phone-view__icon', info && 'is-on')}
          aria-label={t('gallery.viewer.toggleMetadata')}
          aria-pressed={info}
          data-testid="phone-view-info"
          onClick={() => setInfo(!info)}
        >
          <Info size={22} />
        </button>
        <button type="button" className="phone-view__icon" aria-label={t('phone.pictureMenu')} data-testid="phone-view-menu" onClick={openMenu}>
          <List size={22} weight="bold" />
        </button>
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="phone-view__stage phone-view__stage--picture" ref={stageRef} {...handlers} data-testid="phone-view-stage">
            <img
              src={image.url}
              alt=""
              draggable={false}
              className="phone-view__picture"
              data-testid="phone-view-image"
              style={{ width: fitted.width, height: fitted.height, transform: `translate(${view.x + drag}px, ${view.y}px) scale(${view.scale})` }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <SingleImageMenu image={image} phone />
        </ContextMenuContent>
      </ContextMenu>
      {/* Outside the stage: it holds on to the fingers it tracks, which would take a press of these buttons. */}
      {index > 0 && (
        <button type="button" className="phone-view__step is-previous" aria-label={t('gallery.viewer.prev')} onClick={() => onStep(-1)}>
          <CaretLeft size={20} weight="bold" />
        </button>
      )}
      {index >= 0 && index < count - 1 && (
        <button type="button" className="phone-view__step is-next" aria-label={t('gallery.viewer.next')} onClick={() => onStep(1)}>
          <CaretRight size={20} weight="bold" />
        </button>
      )}
      {info && <PictureInfo image={image} />}
      <div className="phone-view__actions">
        <button
          type="button"
          className={cx('phone-view__action', image.starred && 'is-on')}
          aria-pressed={image.starred}
          data-testid="phone-view-star"
          onClick={() => void setStarred([image.name], !image.starred)}
        >
          <Star size={22} weight={image.starred ? 'fill' : 'regular'} />
          <span>{image.starred ? t('gallery.menu.unstar') : t('gallery.menu.star')}</span>
        </button>
        <button type="button" className="phone-view__action" data-testid="phone-view-download" onClick={() => downloadImages([image])}>
          <DownloadSimple size={22} />
          <span>{t('common.download')}</span>
        </button>
        <button
          type="button"
          className="phone-view__action"
          disabled={!image.metadata}
          data-testid="phone-view-use"
          onClick={() => {
            recall(image, 'all');
            usePhone.getState().setTab('generate');
            show(null);
          }}
        >
          <Lightning size={22} />
          <span>{t('phone.useSettings')}</span>
        </button>
        <button type="button" className="phone-view__action is-danger" data-testid="phone-view-delete" onClick={() => requestDeleteImages([image.name])}>
          <Trash size={22} />
          <span>{t('common.delete')}</span>
        </button>
      </div>
    </div>
  );
}

/** What the picture was made with, over the foot of the screen. */
function PictureInfo({ image }: { image: ImageDTO }) {
  const m = image.metadata;
  return (
    <div className="phone-view__info" data-testid="phone-view-meta">
      {m ? (
        <dl>
          <dt>{t('params.prompt.positive')}</dt>
          <dd>{m.positivePrompt || '—'}</dd>
          {m.negativePrompt && (
            <>
              <dt>{t('params.prompt.negative')}</dt>
              <dd>{m.negativePrompt}</dd>
            </>
          )}
          <dt>{t('params.model.label')}</dt>
          <dd>{m.modelName}</dd>
          <dt>{t('params.seed.label')}</dt>
          <dd>{m.seed}</dd>
        </dl>
      ) : (
        <p>{t('gallery.toast.noMetadata')}</p>
      )}
      <p className="phone-view__dims">{t('gallery.viewer.dims', { width: image.width, height: image.height })}</p>
    </div>
  );
}
