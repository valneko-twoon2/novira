// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { freeWildcardName, isWildcardName, useWildcards, wildcardEntries, wildcardMap } from './wildcards';

const initial = useWildcards.getState();
beforeEach(() => useWildcards.setState(initial, true));
const w = () => useWildcards.getState();

describe('wildcard lists', () => {
  it('starts with small starter lists that are valid and in use as entries', () => {
    expect(w().lists.map((l) => l.name)).toEqual(['hair-color', 'expression', 'time-of-day']);
    for (const l of w().lists) {
      expect(isWildcardName(l.name)).toBe(true);
      expect(wildcardEntries(l.text).length).toBeGreaterThan(2);
    }
  });

  it('reads one entry per line, without blank lines and # comments', () => {
    expect(wildcardEntries('  a \r\n\n# note\nb, c\n')).toEqual(['a', 'b, c']);
    expect(wildcardMap([{ id: '1', name: 'x', text: 'p\nq' }])).toEqual({ x: ['p', 'q'] });
  });

  it('accepts names of letters, digits, - and _ that start and end with a letter or digit', () => {
    for (const ok of ['hair', 'hair-color', 'hair_color', 'a', '髪色', 'x2']) expect(isWildcardName(ok)).toBe(true);
    for (const bad of ['', '_hair', 'hair_', '-a', 'a b', 'a/b', '{a}']) expect(isWildcardName(bad)).toBe(false);
  });

  it('adds lists under free valid names and edits their text', () => {
    const id = w().add('hair-color');
    const added = w().lists.find((l) => l.id === id)!;
    expect(added.name).toBe('hair-color-2');
    w().setText(id, 'one\ntwo');
    expect(w().lists.find((l) => l.id === id)!.text).toBe('one\ntwo');
    expect(freeWildcardName('My list (v2).txt', [])).toBe('My-list-v2-txt');
    expect(freeWildcardName('***', [])).toBe('list');
  });

  it('renames only to a valid name that no other list has', () => {
    const [first, second] = w().lists;
    expect(w().rename(first!.id, 'bad name')).toBe('invalid');
    expect(w().rename(first!.id, second!.name)).toBe('taken');
    expect(w().rename(first!.id, first!.name)).toBe('ok');
    expect(w().rename(first!.id, 'hair')).toBe('ok');
    expect(w().lists[0]!.name).toBe('hair');
  });

  it('opens on a list, and selects another when the selected one is deleted', () => {
    w().openEditor();
    expect([w().open, w().selectedId]).toEqual([true, w().lists[0]!.id]);
    const [first, second] = w().lists;
    w().remove(first!.id);
    expect(w().selectedId).toBe(second!.id);
    w().closeEditor();
    expect(w().open).toBe(false);
  });

  it('saves only the lists, under a novira.* key', () => {
    w().add('saved', 'one');
    w().openEditor();
    const stored = JSON.parse(localStorage.getItem('novira.wildcards')!) as { state: Record<string, unknown> };
    expect(Object.keys(stored.state)).toEqual(['lists']);
    expect(stored.state.lists).toEqual(w().lists);
  });
});
