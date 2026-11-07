import { describe, expect, it } from 'vitest';
import type { BoardDTO } from '@/backend';
import { boardLabel, boardTree, isSubfolder, subfoldersOf } from './boardTree';

const b = (id: string, createdAt: number, parentId: string | null = null, archived = false): BoardDTO => ({ id, name: id.toUpperCase(), archived, createdAt, parentId });

describe('boardTree', () => {
  const boards = [b('a', 1), b('b', 5), b('a1', 2, 'a'), b('a2', 3, 'a'), b('lost', 4, 'gone'), b('deep', 6, 'a1')];

  it('lists boards newest first, each followed by its subfolders newest first', () => {
    expect(boardTree(boards).map((x) => [x.board.id, x.depth])).toEqual([
      ['deep', 0],
      ['b', 0],
      ['lost', 0],
      ['a', 0],
      ['a2', 1],
      ['a1', 1],
    ]);
  });

  it('treats a subfolder without its board, or of a subfolder, as a board of its own', () => {
    expect(isSubfolder(boards, boards[4]!)).toBe(false);
    expect(isSubfolder(boards, boards[5]!)).toBe(false);
    expect(isSubfolder(boards, boards[2]!)).toBe(true);
  });

  it('keeps a board for a matching subfolder and drops a board that matches nothing', () => {
    const only = boardTree(boards, (x) => x.id === 'a1').map((x) => x.board.id);
    expect(only).toEqual(['a', 'a1']);
    expect(boardTree(boards, () => false)).toEqual([]);
  });

  it('names a subfolder after its board', () => {
    expect(boardLabel(boards, boards[2]!)).toBe('A / A1');
    expect(boardLabel(boards, boards[0]!)).toBe('A');
    expect(subfoldersOf(boards, 'a').map((x) => x.id)).toEqual(['a2', 'a1']);
  });
});
