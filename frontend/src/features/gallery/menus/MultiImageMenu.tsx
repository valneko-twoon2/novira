// Context menu items when several images are selected.
import { DownloadSimple, FolderSimple, ShareNetwork, Stack, Star, Trash } from '@phosphor-icons/react';
import { t, tCount } from '@/i18n';
import { useBatch } from '@/state/dialogs/batch';
import { useShareDialog } from '@/state/dialogs/share';
import { useGallery } from '@/state/gallery';
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextSubMenu } from '@/ui';
import { downloadImages, moveImagesToBoard, setStarred } from '../actions';
import { requestDeleteImages } from '../deleteRequest';
import { BoardMenuItems } from './BoardMenuItems';

export function MultiImageMenu({ names }: { names: string[] }) {
  const images = () => useGallery.getState().images.filter((i) => names.includes(i.name));
  return (
    <>
      <ContextMenuLabel>{tCount('gallery.menu.selectedCount', names.length)}</ContextMenuLabel>
      <ContextSubMenu icon={<FolderSimple />} label={t('gallery.menu.changeBoard')}>
        <BoardMenuItems current={null} onPick={(id) => void moveImagesToBoard(names, id)} />
      </ContextSubMenu>
      <ContextMenuItem icon={<Star weight="fill" />} onSelect={() => void setStarred(names, true)}>
        {t('gallery.menu.starAll')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Star />} onSelect={() => void setStarred(names, false)}>
        {t('gallery.menu.unstarAll')}
      </ContextMenuItem>
      <ContextMenuItem icon={<DownloadSimple />} onSelect={() => downloadImages(images())}>
        {t('common.download')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ShareNetwork />} onSelect={() => useShareDialog.getState().open(names)}>
        {t('share.menu')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Stack />} onSelect={() => useBatch.getState().open(names)}>
        {t('gallery.menu.batch')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Trash />} danger onSelect={() => requestDeleteImages(names)}>
        {tCount('gallery.menu.deleteCount', names.length)}
      </ContextMenuItem>
    </>
  );
}
