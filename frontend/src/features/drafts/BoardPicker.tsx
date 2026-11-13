// Where ✓ puts the pictures: the board selected in the gallery, changed here as there. The list shows the boards as the
// gallery does, as a tree with each board's cover and counts, so a board is found by its pictures, not only its name.
import { CaretDown, Check, FolderSimple, Tray } from '@phosphor-icons/react';
import { useMemo, type CSSProperties } from 'react';
import type { BoardDTO } from '@/backend';
import { t } from '@/i18n';
import { useBoardStats, type BoardStats } from '@/state/boardStats';
import { ancestorsOf, boardLabel, boardTree } from '@/state/boardTree';
import { useGallery, type BoardId } from '@/state/gallery';
import { cx, SearchPicker } from '@/ui';

interface Row {
  id: BoardId;
  board: BoardDTO | null;
  depth: number;
  /** Shown by its whole path, outside the tree: the selected board inside an archived board. */
  alone?: boolean;
}

export function BoardPicker() {
  const boards = useGallery((s) => s.boards);
  const selected = useGallery((s) => s.selectedBoardId);
  const stats = useBoardStats();
  const value: BoardId = selected !== 'none' && boards.some((b) => b.id === selected) ? selected : 'none';
  const current = boards.find((b) => b.id === value) ?? null;
  // Every board unfolded (the gallery's folding is for its own list). An archived board, or one inside it, only while
  // selected: an archived board in its place in the tree, a board inside one alone by its path, so the archived board
  // around it is not listed (the tree would bring it along, and it could be chosen).
  const rows = useMemo<Row[]>(() => {
    const inArchived = (b: BoardDTO) => ancestorsOf(boards, b).some((x) => x.archived);
    const shown = (b: BoardDTO) => !inArchived(b) && (!b.archived || b.id === value);
    const tree: Row[] = boardTree(boards, shown).map(({ board, depth }) => ({ id: board.id, board, depth }));
    const alone: Row[] = current && inArchived(current) ? [{ id: current.id, board: current, depth: 0, alone: true }] : [];
    return [{ id: 'none', board: null, depth: 0 }, ...alone, ...tree];
  }, [boards, value, current]);
  const nameOf = (board: BoardDTO | null) => (board ? boardLabel(boards, board) : t('gallery.boards.uncategorized'));

  return (
    <span className="dv-target">
      <span className="dv-target__label">{t('gallery.boards.title')}</span>
      <SearchPicker
        trigger={
          <button type="button" className="ui-select dv-target__trigger" aria-label={`${t('drafts.target')}: ${nameOf(current)}`} title={nameOf(current)} data-testid="drafts-target">
            <Cover board={current} stats={stats.get(value)} />
            <span className="ui-select__value">{nameOf(current)}</span>
            <CaretDown size={12} />
          </button>
        }
        items={rows}
        itemKey={(r) => r.id}
        textOf={(r) => nameOf(r.board)}
        searchLabel={t('gallery.boards.searchPlaceholder')}
        emptyText={t('gallery.boards.noMatch')}
        noMatchText={t('gallery.boards.noMatch')}
        className="dv-boards"
        listTestId="drafts-target-list"
        renderItem={(r, close) => {
          const s = stats.get(r.id);
          return (
            <button
              type="button"
              className={cx('pp-picker__item dv-board', r.id === value && 'is-current', r.board?.archived && 'is-archived')}
              style={r.depth > 0 ? ({ '--dv-board-depth': r.depth } as CSSProperties) : undefined}
              title={nameOf(r.board)}
              aria-current={r.id === value || undefined}
              data-testid="drafts-target-item"
              data-board-id={r.id}
              onClick={() => {
                useGallery.getState().selectBoard(r.id);
                close();
              }}
            >
              <Cover board={r.board} stats={s} />
              <span className="dv-board__body">
                <span className="pp-picker__name">{r.alone ? nameOf(r.board) : (r.board?.name ?? t('gallery.boards.uncategorized'))}</span>
                <span className="dv-board__meta">{t('gallery.boards.counts', { images: s?.images ?? 0, assets: s?.assets ?? 0 })}</span>
              </span>
              {r.id === value && <Check size={12} />}
            </button>
          );
        }}
      />
    </span>
  );
}

/** The board's latest picture, as on the gallery's board rows; a folder (a tray for Uncategorized) while it has none. */
function Cover({ board, stats }: { board: BoardDTO | null; stats: BoardStats | undefined }) {
  return (
    <span className="dv-board__cover" aria-hidden>
      {stats?.cover ? <img src={stats.cover.thumbnailUrl} alt="" draggable={false} /> : board ? <FolderSimple size={16} /> : <Tray size={16} />}
    </span>
  );
}
