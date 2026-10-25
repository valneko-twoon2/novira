import { beforeEach, describe, expect, it } from 'vitest';
import { useWildcards } from '@/state/prompts/wildcards';
import { importListFiles, listFileText, listNameForFile } from './wildcardFiles';

beforeEach(() => useWildcards.setState({ lists: [{ id: 'a', name: 'hair', text: 'x' }] }));

describe('wildcard list files', () => {
  it('names a list after its file, made valid and unused', () => {
    expect(listNameForFile('poses.txt', [])).toBe('poses');
    expect(listNameForFile('hair.txt', useWildcards.getState().lists)).toBe('hair-2');
    expect(listNameForFile('my list.v2.txt', [])).toBe('my-list-v2');
  });

  it('writes one entry per line with Windows line ends, without trailing blank lines', () => {
    expect(listFileText({ id: '1', name: 'n', text: 'a\nb\n\n' })).toBe('a\r\nb\r\n');
    expect(listFileText({ id: '1', name: 'n', text: '' })).toBe('');
  });

  it('imports each file as a new list, dropping a byte-order mark and normalising line ends', async () => {
    const files = [new File([`${String.fromCharCode(0xfeff)}red\r\nblue\r\n`], 'colors.txt'), new File(['x'], 'hair.txt')];
    expect(await importListFiles(files)).toEqual(['colors', 'hair-2']);
    const lists = useWildcards.getState().lists;
    expect(lists.find((l) => l.name === 'colors')!.text).toBe('red\nblue\n');
  });
});
