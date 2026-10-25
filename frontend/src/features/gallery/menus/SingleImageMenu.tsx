// Context menu items for one image (InvokeAI image context menu).
import {
  ChatCenteredText,
  ArrowSquareOut,
  ArrowsCounterClockwise,
  ArrowsOut,
  FilmSlate,
  Asterisk,
  Copy,
  Crop,
  Crosshair,
  GitFork,
  Scissors,
  Smiley,
  UserFocus,
  DownloadSimple,
  Eye,
  FlowArrow,
  FolderSimple,
  ImageSquare,
  MagnifyingGlass,
  Images,
  PaintBrush,
  PersonSimple,
  Quotes,
  Plant,
  Resize,
  ShareNetwork,
  Star,
  TextAa,
  Trash,
} from '@phosphor-icons/react';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { DERIVE_CHOICES, canDerive, deriveFrom } from '@/state/derive';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { usePoseFromImageDialog } from '@/state/dialogs/poseFromImage';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { trimTransparent } from '@/state/trim';
import { useGallery } from '@/state/gallery';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useCutout } from '@/state/dialogs/cutout';
import { useSegment } from '@/state/dialogs/segment';
import { useShareDialog } from '@/state/dialogs/share';
import { useWatermarkCheckDialog } from '@/state/dialogs/watermark';
import { isScreenShown, showViewer } from '@/state/ui';
import { ContextMenuItem, ContextMenuSeparator, ContextSubMenu } from '@/ui';
import {
  addAsReference,
  copyImage,
  downloadImages,
  canLoadImageWorkflow,
  canOpenInNewTab,
  loadImageWorkflow,
  moveImagesToBoard,
  openInNewTab,
  recall,
  sendToCanvas,
  sendToText,
  sendToUpscale,
  sendToVideo,
  sendToWorkflow,
  setStarred,
} from '../actions';
import { CANVAS_TARGETS } from '../canvasTargets';
import { requestDeleteImages } from '../deleteRequest';
import { BoardMenuItems } from './BoardMenuItems';

/**
 * `phone` leaves out what only switches to a screen the phone layout has not (the viewer, the canvas, workflows, video,
 * text, upscaling, comparing), so every item shown does something there.
 */
export function SingleImageMenu({ image, phone = false }: { image: ImageDTO; phone?: boolean }) {
  const hasMeta = image.metadata !== null;
  const isStill = (image.mediaType ?? 'image') === 'image';
  const g = useGallery.getState;
  return (
    <>
      {!phone && (
        <ContextMenuItem
          icon={<Eye />}
          onSelect={() => {
            g().setSelection([image.name]);
            showViewer();
          }}
        >
          {t('gallery.menu.openInViewer')}
        </ContextMenuItem>
      )}
      {canOpenInNewTab() && (
        <ContextMenuItem icon={<ArrowSquareOut />} onSelect={() => openInNewTab(image)}>
          {t('gallery.menu.openInNewTab')}
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={<DownloadSimple />} onSelect={() => downloadImages([image])}>
        {t('common.download')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ShareNetwork />} disabled={!isStill} onSelect={() => useShareDialog.getState().open([image.name])}>
        {t('share.menu')}
      </ContextMenuItem>
      <ContextMenuItem icon={<MagnifyingGlass />} disabled={!isStill} onSelect={() => useWatermarkCheckDialog.getState().show(image.name)}>
        {t('share.check.title')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy />} onSelect={() => void copyImage(image)} shortcut="Ctrl+C">
        {t('common.copy')}
      </ContextMenuItem>
      {!phone && (
        <ContextMenuItem
          icon={<ImageSquare />}
          disabled={g().viewerImageName === image.name}
          onSelect={() => g().setCompareImage(image.name)}
          shortcut="Alt+Click"
        >
          {t('gallery.menu.compare')}
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      {!phone && (
        <ContextMenuItem icon={<FlowArrow />} disabled={!canLoadImageWorkflow(image)} onSelect={() => loadImageWorkflow(image)} shortcut="W">
          {t('gallery.menu.loadWorkflow')}
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={<ArrowsCounterClockwise />} disabled={!hasMeta} onSelect={() => recall(image, 'remix')} shortcut="R">
        {t('gallery.menu.remix')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Quotes />} disabled={!hasMeta} onSelect={() => recall(image, 'prompt')} shortcut="P">
        {t('gallery.menu.usePrompt')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Plant />} disabled={!hasMeta} onSelect={() => recall(image, 'seed')} shortcut="S">
        {t('gallery.menu.useSeed')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Asterisk />} disabled={!hasMeta} onSelect={() => recall(image, 'all')} shortcut="A">
        {t('gallery.menu.useAll')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Resize />} onSelect={() => recall(image, 'size')}>
        {t('gallery.menu.useSize')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      {!phone && (
        <ContextSubMenu icon={<PaintBrush />} label={t('gallery.menu.sendToCanvas')}>
          {CANVAS_TARGETS.map(({ target, label }) => (
            <ContextMenuItem key={target} onSelect={() => sendToCanvas(image, target)}>
              {t(label)}
            </ContextMenuItem>
          ))}
        </ContextSubMenu>
      )}
      <ContextMenuItem icon={<Images />} onSelect={() => addAsReference(image)}>
        {t('gallery.menu.useAsReference')}
      </ContextMenuItem>
      {!phone && isScreenShown('video') && (
        <ContextMenuItem icon={<FilmSlate />} disabled={!isStill} onSelect={() => sendToVideo(image)}>
          {t('gallery.menu.sendToVideo')}
        </ContextMenuItem>
      )}
      {!phone && (
        <ContextMenuItem icon={<FlowArrow />} disabled={!isStill} onSelect={() => sendToWorkflow(image)}>
          {t('gallery.menu.sendToWorkflow')}
        </ContextMenuItem>
      )}
      {!phone && isScreenShown('text') && (
        <ContextMenuItem icon={<TextAa />} disabled={!isStill} onSelect={() => sendToText(image)}>
          {t('gallery.menu.sendToText')}
        </ContextMenuItem>
      )}
      {!phone && (
        <ContextMenuItem icon={<ArrowsOut />} onSelect={() => sendToUpscale(image)} shortcut="Shift+U">
          {t('gallery.menu.upscale')}
        </ContextMenuItem>
      )}
      {!phone && (
        <ContextMenuItem icon={<Crosshair />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => useSegment.getState().open(image.name)}>
          {t('gallery.menu.segment')}
        </ContextMenuItem>
      )}
      <ContextSubMenu icon={<GitFork />} label={t('gallery.derive.menu')}>
        {DERIVE_CHOICES.map(({ kind, count }) => (
          <ContextMenuItem key={`${kind}-${count}`} disabled={!canDerive(image)} onSelect={() => void deriveFrom(image, kind, count)}>
            {t(`gallery.derive.${kind}`, { count })}
          </ContextMenuItem>
        ))}
        <ContextMenuItem disabled={!canDerive(image)} onSelect={() => useDeriveDialog.getState().open(image.name)}>
          {t('gallery.derive.custom')}
        </ContextMenuItem>
      </ContextSubMenu>
      <ContextMenuItem icon={<Scissors />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => useCutout.getState().open(image.name)}>
        {t('cutout.menu')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Smiley />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => useFaceFixDialog.getState().open(image.name)}>
        {t('facefix.menu')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Crop />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => void trimTransparent(image)}>
        {t('gallery.menu.trim')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ChatCenteredText />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => useCaptionDialog.getState().show(image.name)}>
        {t('caption.menu')}
      </ContextMenuItem>
      {!phone && (
        <ContextMenuItem icon={<PersonSimple />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => usePoseFromImageDialog.getState().show(image.name)}>
          {t('canvas.poseFromImage.menu')}
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={<UserFocus />} disabled={(image.mediaType ?? 'image') !== 'image'} onSelect={() => useCharacterDialog.getState().open({ imageNames: [image.name] })}>
        {t('character.menu')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextSubMenu icon={<FolderSimple />} label={t('gallery.menu.changeBoard')}>
        <BoardMenuItems current={image.boardId ?? 'none'} onPick={(id) => void moveImagesToBoard([image.name], id)} />
      </ContextSubMenu>
      <ContextMenuItem icon={<Star weight={image.starred ? 'fill' : 'regular'} />} onSelect={() => void setStarred([image.name], !image.starred)}>
        {image.starred ? t('gallery.menu.unstar') : t('gallery.menu.star')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Trash />} danger onSelect={() => requestDeleteImages([image.name])} shortcut="Del">
        {t('gallery.menu.delete')}
      </ContextMenuItem>
    </>
  );
}
