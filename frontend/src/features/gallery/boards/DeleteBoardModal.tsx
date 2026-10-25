// Board deletion dialog: keep the images (moved to Uncategorized) or delete them too.
import type { BoardDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { Button, Modal } from '@/ui';
import { deleteBoard } from './boardActions';

export function DeleteBoardModal({ board, imageCount, onClose }: { board: BoardDTO | null; imageCount: number; onClose: () => void }) {
  const run = (withImages: boolean) => {
    if (board) void deleteBoard(board.id, withImages);
    onClose();
  };
  return (
    <Modal
      open={board !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('gallery.boards.deleteTitle', { name: board?.name ?? '' })}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" onClick={() => run(false)}>
            {t('gallery.boards.deleteBoardOnly')}
          </Button>
          <Button scheme="danger" onClick={() => run(true)} data-testid="delete-board-and-images">
            {t('gallery.boards.deleteBoardAndImages')}
          </Button>
        </>
      }
    >
      <div className="gal-confirm">
        <p>{tCount('gallery.boards.deleteMessage', imageCount)}</p>
        <p className="gal-confirm__hint">{t('gallery.boards.deleteHint')}</p>
      </div>
    </Modal>
  );
}
