// How boards nest: shared by the screens (state/boardTree) and the mock backend, which keeps the same rule as the real one.
import type { BoardDTO } from './types';

/** How many levels boards can nest, a top board being the first. The backend's `MAX_BOARD_DEPTH` is the same number (a test compares them). */
export const MAX_BOARD_DEPTH = 8;

/** The boards above this one, nearest first. */
export function ancestorsOf(boards: BoardDTO[], board: BoardDTO): BoardDTO[] {
  const out: BoardDTO[] = [];
  const seen = new Set([board.id]);
  let parent = boards.find((b) => b.id === board.parentId);
  while (parent && !seen.has(parent.id)) {
    out.push(parent);
    seen.add(parent.id);
    const above: string | null | undefined = parent.parentId;
    parent = boards.find((b) => b.id === above);
  }
  return out;
}

/** Whether a subfolder can still be made inside this board. */
export function canHoldSubfolder(boards: BoardDTO[], board: BoardDTO): boolean {
  return ancestorsOf(boards, board).length + 1 < MAX_BOARD_DEPTH;
}

/** The ids of a board and of everything inside it, however deep. */
export function withDescendants(boards: BoardDTO[], id: string): Set<string> {
  const out = new Set([id]);
  for (const current of out) for (const b of boards) if (b.parentId === current) out.add(b.id);
  return out;
}
