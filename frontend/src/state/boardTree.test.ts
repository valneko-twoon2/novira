import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BoardDTO } from '@/backend';
import { ancestorsOf, boardLabel, boardTree, canHoldSubfolder, isSubfolder, MAX_BOARD_DEPTH, subfoldersOf, withDescendants } from './boardTree';

const b = (id: string, createdAt: number, parentId: string | null = null, archived = false): BoardDTO => ({ id, name: id.toUpperCase(), archived, createdAt, parentId });

describe('boardTree', () => {
  const boards = [b('a', 1), b('b', 5), b('a1', 2, 'a'), b('a2', 3, 'a'), b('lost', 4, 'gone'), b('deep', 6, 'a1')];

  it('lists boards newest first, each followed by its subfolders newest first', { tags: ['equivalence'] }, () => {
    expect(boardTree(boards).map((x) => [x.board.id, x.depth])).toEqual([
      ['b', 0],
      ['lost', 0],
      ['a', 0],
      ['a2', 1],
      ['a1', 1],
      ['deep', 2],
    ]);
  });

  it('treats a subfolder without its board as a board of its own, and one inside a subfolder as a subfolder', { tags: ['condition'] }, () => {
    expect(isSubfolder(boards, boards[4]!)).toBe(false);
    expect(isSubfolder(boards, boards[5]!)).toBe(true);
    expect(isSubfolder(boards, boards[2]!)).toBe(true);
  });

  it('leaves out what is inside a folded board, and still says the board has subfolders', { tags: ['condition'] }, () => {
    const rows = boardTree(boards, () => true, new Set(['a1']));
    expect(rows.map((x) => x.board.id)).toEqual(['b', 'lost', 'a', 'a2', 'a1']);
    expect(rows.find((x) => x.board.id === 'a1')!.hasChildren).toBe(true);
    expect(rows.find((x) => x.board.id === 'a2')!.hasChildren).toBe(false);
    expect(boardTree(boards, () => true, new Set(['a'])).map((x) => x.board.id)).toEqual(['b', 'lost', 'a']);
  });

  it('keeps every board on the way to a match, however deep', { tags: ['equivalence'] }, () => {
    expect(boardTree(boards, (x) => x.id === 'deep').map((x) => x.board.id)).toEqual(['a', 'a1', 'deep']);
  });

  it('finds what is above and inside a board, and survives a loop in the data', { tags: ['error-guessing'] }, () => {
    expect(ancestorsOf(boards, boards[5]!).map((x) => x.id)).toEqual(['a1', 'a']);
    expect([...withDescendants(boards, 'a')].sort()).toEqual(['a', 'a1', 'a2', 'deep']);
    expect([...withDescendants(boards, 'b')]).toEqual(['b']);
    const loop = [b('x', 1, 'y'), b('y', 2, 'x')];
    expect(ancestorsOf(loop, loop[0]!).map((x) => x.id)).toEqual(['y']);
    expect([...withDescendants(loop, 'x')].sort()).toEqual(['x', 'y']);
  });

  it('allows subfolders down to the last level only', { tags: ['condition'] }, () => {
    const chain = Array.from({ length: MAX_BOARD_DEPTH }, (_, i) => b(`l${i}`, i, i ? `l${i - 1}` : null));
    expect(canHoldSubfolder(chain, chain[MAX_BOARD_DEPTH - 2]!)).toBe(true);
    expect(canHoldSubfolder(chain, chain[MAX_BOARD_DEPTH - 1]!)).toBe(false);
  });

  it('has the same limit as the backend', { tags: ['boundary'] }, () => {
    const rust = readFileSync('../backend/crates/novira-core/src/service/boards.rs', 'utf8');
    expect(/MAX_BOARD_DEPTH: usize = (\d+);/.exec(rust)?.[1]).toBe(String(MAX_BOARD_DEPTH));
  });

  it('keeps a board for a matching subfolder and drops a board that matches nothing', { tags: ['condition'] }, () => {
    const only = boardTree(boards, (x) => x.id === 'a1').map((x) => x.board.id);
    expect(only).toEqual(['a', 'a1']);
    expect(boardTree(boards, () => false)).toEqual([]);
  });

  it('names a subfolder after its board', { tags: ['condition'] }, () => {
    expect(boardLabel(boards, boards[2]!)).toBe('A / A1');
    expect(boardLabel(boards, boards[5]!)).toBe('A / A1 / DEEP');
    expect(boardLabel(boards, boards[0]!)).toBe('A');
    expect(subfoldersOf(boards, 'a').map((x) => x.id)).toEqual(['a2', 'a1']);
  });
});
