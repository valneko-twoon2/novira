// Boards and their subfolders (one level): a subfolder is a board whose `parentId` is another board.
import type { BoardDTO } from '@/backend';

/** The subfolders of a board, newest first. */
export function subfoldersOf(boards: BoardDTO[], id: string): BoardDTO[] {
  return boards.filter((b) => b.parentId === id).sort((a, b) => b.createdAt - a.createdAt);
}

/** A board whose parent is gone counts as a board of its own. */
export function isSubfolder(boards: BoardDTO[], board: BoardDTO): boolean {
  return !!board.parentId && boards.some((b) => b.id === board.parentId && !b.parentId);
}

/** The boards in the order a list shows them: each board (newest first) followed by its subfolders. `keep` drops boards. */
export function boardTree(boards: BoardDTO[], keep: (b: BoardDTO) => boolean = () => true): { board: BoardDTO; depth: 0 | 1 }[] {
  const out: { board: BoardDTO; depth: 0 | 1 }[] = [];
  const tops = boards.filter((b) => !isSubfolder(boards, b)).sort((a, b) => b.createdAt - a.createdAt);
  for (const top of tops) {
    const subs = subfoldersOf(boards, top.id).filter(keep);
    if (keep(top) || subs.length) out.push({ board: top, depth: 0 });
    for (const sub of subs) out.push({ board: sub, depth: 1 });
  }
  return out;
}

/** `Board / Subfolder` for a subfolder, the plain name for a board. */
export function boardLabel(boards: BoardDTO[], board: BoardDTO): string {
  const parent = isSubfolder(boards, board) ? boards.find((b) => b.id === board.parentId) : undefined;
  return parent ? `${parent.name} / ${board.name}` : board.name;
}
