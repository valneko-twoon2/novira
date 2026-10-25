// One board in the boards list: cover, name (double-click to rename), counts, auto-add badge,
// context menu and drop target for gallery images / OS files.
import { Archive, ArrowCounterClockwise, DownloadSimple, FolderSimple, PlusCircle, Trash, Tray } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { backend, type BoardDTO } from '@/backend';
import { t } from '@/i18n';
import { hasDragImages, resolveDropImages } from '@/state/dnd';
import { useGallery, type BoardId } from '@/state/gallery';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, cx, Tooltip } from '@/ui';
import { moveImagesToBoard, uploadFiles } from '../actions';
import { downloadBoard, renameBoard, setBoardArchived } from './boardActions';
import type { BoardStats } from './useBoardStats';

interface Props {
  id: BoardId;
  board: BoardDTO | null;
  stats: BoardStats | undefined;
  renaming: boolean;
  onRenameDone: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function BoardRow({ id, board, stats, renaming, onRenameDone, onRename, onDelete }: Props) {
  const selected = useGallery((s) => s.selectedBoardId === id);
  const isAutoAdd = useGallery((s) => s.autoAddBoardId === id);
  const [over, setOver] = useState(false);
  const name = board?.name ?? t('gallery.boards.uncategorized');
  const count = (stats?.images ?? 0) + (stats?.assets ?? 0);

  const onDragOver = (e: DragEvent) => {
    if (!hasDragImages(e.dataTransfer.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const files = [...e.dataTransfer.files];
    void resolveDropImages(e).then((names) => {
      if (names.length) void moveImagesToBoard(names, id);
      else if (files.length) {
        useGallery.getState().setAutoAddBoard(id);
        void uploadFiles(files);
      }
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cx('gboard', selected && 'is-selected', over && 'is-over', board?.archived && 'is-archived')}
          role="option"
          aria-selected={selected}
          data-testid="board-row"
          data-board-id={id}
          onClick={() => useGallery.getState().selectBoard(id)}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
          }}
          onDrop={onDrop}
        >
          <div className="gboard__cover">
            {stats?.cover ? <img src={stats.cover.thumbnailUrl} alt="" draggable={false} /> : board ? <FolderSimple size={18} /> : <Tray size={18} />}
          </div>
          <div className="gboard__body">
            {renaming && board ? (
              <RenameInput initial={board.name} onDone={(v) => {
                if (v !== null) void renameBoard(board.id, v);
                onRenameDone();
              }} />
            ) : (
              <span className="gboard__name" onDoubleClick={board ? onRename : undefined} title={name}>
                {name}
              </span>
            )}
            <span className="gboard__meta">
              {t('gallery.boards.counts', { images: stats?.images ?? 0, assets: stats?.assets ?? 0 })}
            </span>
          </div>
          {board?.archived && <Archive className="gboard__archived" aria-label={t('gallery.boards.archived')} />}
          {isAutoAdd && (
            <Tooltip content={t('gallery.boards.autoAddTooltip')}>
              <span className="gboard__auto">{t('gallery.boards.autoBadge')}</span>
            </Tooltip>
          )}
          <span className="gboard__count">{count}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem icon={<PlusCircle />} disabled={isAutoAdd} onSelect={() => useGallery.getState().setAutoAddBoard(id)}>
          {t('gallery.boards.setAutoAdd')}
        </ContextMenuItem>
        {/* Downloading a board is not built for the desktop app yet; the mock shows the item and says so. */}
        {backend.kind === 'mock' && (
          <ContextMenuItem icon={<DownloadSimple />} onSelect={downloadBoard}>
            {t('gallery.boards.download')}
          </ContextMenuItem>
        )}
        {board && (
          <>
            <ContextMenuItem icon={<FolderSimple />} onSelect={onRename}>
              {t('common.rename')}
            </ContextMenuItem>
            <ContextMenuItem icon={board.archived ? <ArrowCounterClockwise /> : <Archive />} onSelect={() => void setBoardArchived(board.id, !board.archived)}>
              {board.archived ? t('gallery.boards.unarchive') : t('gallery.boards.archive')}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem icon={<Trash />} danger onSelect={onDelete}>
              {t('gallery.boards.delete')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    // Delayed so a closing context menu does not steal focus back.
    const id = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 30);
    return () => clearTimeout(id);
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      ref={ref}
      className="ui-input gboard__rename"
      value={value}
      aria-label={t('common.rename')}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
    />
  );
}
