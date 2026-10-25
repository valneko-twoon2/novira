// Viewer toolbar (InvokeAI v6): metadata toggle, recall actions, send-to targets, compare, star, download, delete.
import {
  ChatCenteredText,
  ArrowSquareOut,
  ArrowsCounterClockwise,
  ArrowsOut,
  Asterisk,
  Crosshair,
  DotsNine,
  Scissors,
  Smiley,
  UserFocus,
  DownloadSimple,
  FlowArrow,
  GitFork,
  ImageSquare,
  Images,
  Info,
  PaintBrush,
  Plant,
  Quotes,
  ShareNetwork,
  Star,
  Trash,
} from '@phosphor-icons/react';
import type { ImageDTO } from '@/backend';
import {
  addAsReference,
  downloadImages,
  canLoadImageWorkflow,
  canOpenInNewTab,
  loadImageWorkflow,
  openInNewTab,
  recall,
  sendToCanvas,
  sendToUpscale,
  setStarred,
} from '@/features/gallery/actions';
import { CANVAS_TARGETS } from '@/features/gallery/canvasTargets';
import { requestDeleteImages } from '@/features/gallery/deleteRequest';
import { t } from '@/i18n';
import { DERIVE_CHOICES, canDerive, deriveFrom } from '@/state/derive';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { useGallery } from '@/state/gallery';
import { useMangaDialog } from '@/state/dialogs/manga';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useCutout } from '@/state/dialogs/cutout';
import { useSegment } from '@/state/dialogs/segment';
import { useShareDialog } from '@/state/dialogs/share';
import { Divider, IconButton, Menu, MenuContent, MenuItem, MenuTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { toggleCompare } from './useViewerHotkeys';

function tip(label: string, key: string) {
  return t('gallery.viewer.withShortcut', { label, key });
}

export function ViewerToolbar({ image }: { image: ImageDTO | undefined }) {
  const showMetadata = useGallery((s) => s.showMetadata);
  const comparing = useGallery((s) => s.compareImageName !== null);
  const none = !image;
  const noMeta = !image?.metadata;
  const act = (fn: (img: ImageDTO) => void) => () => image && fn(image);
  return (
    <div className="vtoolbar" data-testid="viewer-toolbar">
      <div className="vtoolbar__group">
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={t('gallery.viewer.toggleMetadata')}
          tooltip={tip(t('gallery.viewer.toggleMetadata'), 'I')}
          icon={<Info />}
          isActive={showMetadata}
          disabled={none}
          onClick={() => useGallery.getState().toggleMetadata()}
          data-testid="toggle-metadata"
          data-metadata-toggle=""
        />
      </div>
      <Divider vertical />
      <div className="vtoolbar__group">
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.remix')} tooltip={tip(t('gallery.menu.remix'), 'R')} icon={<ArrowsCounterClockwise />} disabled={noMeta} onClick={act((i) => recall(i, 'remix'))} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.usePrompt')} tooltip={tip(t('gallery.menu.usePrompt'), 'P')} icon={<Quotes />} disabled={noMeta} onClick={act((i) => recall(i, 'prompt'))} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.useSeed')} tooltip={tip(t('gallery.menu.useSeed'), 'S')} icon={<Plant />} disabled={noMeta} onClick={act((i) => recall(i, 'seed'))} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.useAll')} tooltip={tip(t('gallery.menu.useAll'), 'A')} icon={<Asterisk />} disabled={noMeta} onClick={act((i) => recall(i, 'all'))} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.loadWorkflow')} tooltip={tip(t('gallery.menu.loadWorkflow'), 'W')} icon={<FlowArrow />} disabled={!image || !canLoadImageWorkflow(image)} onClick={act(loadImageWorkflow)} />
        <Menu>
          <MenuTrigger asChild>
            <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.derive.menu')} icon={<GitFork />} disabled={!canDerive(image)} data-testid="viewer-derive" />
          </MenuTrigger>
          <MenuContent align="center">
            {DERIVE_CHOICES.map(({ kind, count }) => (
              <MenuItem key={`${kind}-${count}`} onSelect={act((i) => void deriveFrom(i, kind, count))}>
                {t(`gallery.derive.${kind}`, { count })}
              </MenuItem>
            ))}
            <MenuItem onSelect={act((i) => useDeriveDialog.getState().open(i.name))}>{t('gallery.derive.custom')}</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <Divider vertical />
      <div className="vtoolbar__group">
        <Menu>
          <MenuTrigger asChild>
            <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.sendToCanvas')} icon={<PaintBrush />} disabled={none} />
          </MenuTrigger>
          <MenuContent align="center">
            {CANVAS_TARGETS.map(({ target, label }) => (
              <MenuItem key={target} onSelect={act((i) => sendToCanvas(i, target))}>
                {t(label)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.useAsReference')} icon={<Images />} disabled={none} onClick={act(addAsReference)} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.upscale')} tooltip={tip(t('gallery.menu.upscale'), 'Shift+U')} icon={<ArrowsOut />} disabled={none} onClick={act(sendToUpscale)} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.segment')} icon={<Crosshair />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useSegment.getState().open(i.name))} data-testid="viewer-segment" />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('cutout.menu')} icon={<Scissors />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useCutout.getState().open(i.name))} data-testid="viewer-cutout" />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('facefix.menu')} icon={<Smiley />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useFaceFixDialog.getState().open(i.name))} data-testid="viewer-facefix" />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.manga.menu')} icon={<DotsNine />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useMangaDialog.getState().open(i.name))} data-testid="viewer-manga" />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('caption.menu')} icon={<ChatCenteredText />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useCaptionDialog.getState().show(i.name))} data-testid="viewer-caption" />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('character.menu')} icon={<UserFocus />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useCharacterDialog.getState().open({ imageNames: [i.name] }))} data-testid="viewer-character" />
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={t('gallery.compare.toggle')}
          tooltip={tip(t('gallery.compare.toggle'), 'C')}
          icon={<ImageSquare />}
          isActive={comparing}
          disabled={none}
          onClick={toggleCompare}
        />
      </div>
      <Divider vertical />
      <div className="vtoolbar__group">
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={image?.starred ? t('gallery.menu.unstar') : t('gallery.menu.star')}
          icon={<Star weight={image?.starred ? 'fill' : 'regular'} />}
          isActive={image?.starred}
          disabled={none}
          onClick={act((i) => void setStarred([i.name], !i.starred))}
        />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('common.download')} icon={<DownloadSimple />} disabled={none} onClick={act((i) => downloadImages([i]))} />
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('share.menu')} icon={<ShareNetwork />} disabled={none || (image.mediaType ?? 'image') !== 'image'} onClick={act((i) => useShareDialog.getState().open([i.name]))} data-testid="viewer-share" />
        {canOpenInNewTab() && <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('gallery.menu.openInNewTab')} icon={<ArrowSquareOut />} disabled={none} onClick={act(openInNewTab)} />}
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={t('gallery.menu.delete')}
          tooltip={tip(t('gallery.menu.delete'), 'Del')}
          icon={<Trash />}
          scheme="danger"
          disabled={none}
          onClick={act((i) => requestDeleteImages([i.name]))}
        />
      </div>
    </div>
  );
}
