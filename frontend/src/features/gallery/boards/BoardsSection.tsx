// Collapsible, height-resizable boards list at the top of the gallery panel.
import { CaretDown, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { BoardDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery, type BoardId } from '@/state/gallery';
import { cx, IconButton, TextInput } from '@/ui';
import { boardName } from '../actions';
import { createBoard } from './boardActions';
import { BoardRow } from './BoardRow';
import { DeleteBoardModal } from './DeleteBoardModal';
import { useBoardStats } from './useBoardStats';

const MIN_LIST = 64;

export function BoardsSection() {
  const open = useGallery((s) => s.settings.boardsListOpen);
  const boards = useGallery((s) => s.boards);
  const selectedBoardId = useGallery((s) => s.selectedBoardId);
  const boardSearch = useGallery((s) => s.boardSearch);
  const showArchived = useGallery((s) => s.settings.showArchivedBoards);
  const stats = useBoardStats();
  const [searchOpen, setSearchOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BoardDTO | null>(null);
  const [listHeight, setListHeight] = useState(176);
  const drag = useRef<{ y: number; h: number } | null>(null);

  const visible = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return boards
      .filter((b) => (showArchived || !b.archived) && (!q || b.name.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [boards, boardSearch, showArchived]);
  const showNone = !boardSearch.trim() || t('gallery.boards.uncategorized').toLowerCase().includes(boardSearch.trim().toLowerCase());

  const g = useGallery.getState;
  const toggle = () => g().setSettings({ boardsListOpen: !open });
  const add = async () => {
    const board = await createBoard();
    if (!open) g().setSettings({ boardsListOpen: true });
    g().selectBoard(board.id);
    setRenamingId(board.id);
  };

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: listHeight };
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setListHeight(Math.max(MIN_LIST, drag.current.h + e.clientY - drag.current.y));
  };

  const row = (id: BoardId, board: BoardDTO | null) => (
    <BoardRow
      key={id}
      id={id}
      board={board}
      stats={stats.get(id)}
      renaming={renamingId === id}
      onRename={() => setRenamingId(id)}
      onRenameDone={() => setRenamingId(null)}
      onDelete={() => board && setDeleting(board)}
    />
  );

  return (
    <div className={cx('gboards', open && 'is-open')}>
      <div className="gboards__header">
        <button type="button" className="gboards__toggle" aria-expanded={open} onClick={toggle} data-testid="boards-toggle">
          <CaretDown size={12} className="gboards__caret" />
          <span className="gboards__label">{t('gallery.boards.title')}</span>
          <span className="gboards__current">{boardName(selectedBoardId)}</span>
        </button>
        <IconButton
          label={t('gallery.boards.search')}
          icon={searchOpen ? <X /> : <MagnifyingGlass />}
          size="xs"
          isActive={searchOpen}
          onClick={() => {
            if (searchOpen) g().setBoardSearch('');
            setSearchOpen(!searchOpen);
            if (!open) g().setSettings({ boardsListOpen: true });
          }}
        />
        <IconButton label={t('gallery.boards.add')} icon={<Plus />} size="xs" onClick={() => void add()} data-testid="add-board" />
      </div>
      {open && (
        <>
          {searchOpen && (
            <div className="gboards__search">
              <TextInput
                autoFocus
                value={boardSearch}
                placeholder={t('gallery.boards.searchPlaceholder')}
                aria-label={t('gallery.boards.search')}
                onChange={(e) => g().setBoardSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (g().setBoardSearch(''), setSearchOpen(false))}
              />
            </div>
          )}
          <div className="gboards__list" role="listbox" aria-label={t('gallery.boards.title')} style={{ '--gboards-h': `${listHeight}px` } as CSSProperties}>
            {showNone && row('none', null)}
            {visible.map((b) => row(b.id, b))}
            {!visible.length && !showNone && <div className="gboards__empty">{t('gallery.boards.noMatch')}</div>}
          </div>
          <div
            className="gboards__resize"
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('gallery.boards.resize')}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={() => (drag.current = null)}
          />
        </>
      )}
      <DeleteBoardModal
        board={deleting}
        imageCount={deleting ? (stats.get(deleting.id)?.images ?? 0) + (stats.get(deleting.id)?.assets ?? 0) : 0}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
