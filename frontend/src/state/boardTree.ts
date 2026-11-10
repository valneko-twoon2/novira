// Boards and their subfolders: a subfolder is a board whose `parentId` is another board, and it can hold subfolders too.
import type { BoardDTO } from '@/backend';
import { ancestorsOf } from '@/backend/boardNesting';

export { ancestorsOf, canHoldSubfolder, MAX_BOARD_DEPTH, withDescendants } from '@/backend/boardNesting';

export interface BoardTreeRow {
  board: BoardDTO;
  /** 0 for a top board. */
  depth: number;
  /** It has subfolders a list would show (folded or not). */
  hasChildren: boolean;
}

/** The subfolders of a board, newest first. */
export function subfoldersOf(boards: BoardDTO[], id: string): BoardDTO[] {
  return boards.filter((b) => b.parentId === id).sort((a, b) => b.createdAt - a.createdAt);
}

/** A board whose parent is gone counts as a board of its own. */
export function isSubfolder(boards: BoardDTO[], board: BoardDTO): boolean {
  return !!board.parentId && boards.some((b) => b.id === board.parentId);
}

/**
 * The boards in the order a list shows them: each board (newest first) followed by its subfolders. `keep` drops boards; a
 * board stays while something inside it stays. The subfolders of a board in `folded` are left out.
 */
export function boardTree(boards: BoardDTO[], keep: (b: BoardDTO) => boolean = () => true, folded: ReadonlySet<string> = new Set()): BoardTreeRow[] {
  const walk = (board: BoardDTO, depth: number): BoardTreeRow[] => {
    const inside = subfoldersOf(boards, board.id).flatMap((sub) => walk(sub, depth + 1));
    if (!keep(board) && !inside.length) return [];
    return [{ board, depth, hasChildren: inside.length > 0 }, ...(folded.has(board.id) ? [] : inside)];
  };
  return boards
    .filter((b) => !isSubfolder(boards, b))
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((top) => walk(top, 0));
}

/** `Board / Subfolder / ...` for a subfolder, the plain name for a board. */
export function boardLabel(boards: BoardDTO[], board: BoardDTO): string {
  return [...ancestorsOf(boards, board).reverse(), board].map((b) => b.name).join(' / ');
}
