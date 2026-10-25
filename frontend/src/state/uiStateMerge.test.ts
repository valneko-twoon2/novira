import { describe, expect, it } from 'vitest';
import { planRemote, sameState, type KeyText } from './uiStateMerge';

const plan = (theirs: KeyText, mine: KeyText, local: KeyText, remote: KeyText, opts: { applyable?: string[]; recent?: string[] } = {}) =>
  planRemote({
    theirs,
    mine,
    local,
    remote,
    canApply: (k) => (opts.applyable ?? ['novira.a', 'novira.b']).includes(k),
    recentlyWritten: (k) => (opts.recent ?? []).includes(k),
  });

describe('planRemote', () => {
  it('takes a key the backend changed and this page did not', () => {
    const p = plan({ 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': '2' });
    expect([...p.apply]).toEqual([['novira.a', '2']]);
    expect(p.later).toEqual([]);
  });

  it('takes a key the backend added and one it dropped', () => {
    const s = { 'novira.a': '1' };
    expect([...plan({}, {}, {}, s).apply]).toEqual([['novira.a', '1']]);
    expect([...plan(s, s, s, {}).apply]).toEqual([['novira.a', null]]);
  });

  it('leaves a key alone that the backend did not change, whatever this page holds', () => {
    const p = plan({ 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': 'typed' }, { 'novira.a': '1' });
    expect(p.apply.size).toBe(0);
    expect(p.later).toEqual([]);
  });

  it('keeps this page\'s own change when both changed (the last writer wins when it sends)', () => {
    const p = plan({ 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': 'typed' }, { 'novira.a': '2' });
    expect(p.apply.size).toBe(0);
    expect(p.same).toEqual([]);
  });

  it('only notes a key where this page already holds the backend\'s text', () => {
    const p = plan({ 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': '2' }, { 'novira.a': '2' });
    expect(p.apply.size).toBe(0);
    expect(p.same).toEqual(['novira.a']);
  });

  it('never applies a key no running store can take', () => {
    const p = plan({ 'novira.settings': 'a' }, { 'novira.settings': 'a' }, { 'novira.settings': 'a' }, { 'novira.settings': 'b' });
    expect(p.apply.size).toBe(0);
  });

  it('holds back a key written a moment ago and does not apply it', () => {
    const p = plan({ 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': '1' }, { 'novira.a': '2' }, { recent: ['novira.a'] });
    expect(p.apply.size).toBe(0);
    expect(p.later).toEqual(['novira.a']);
  });

  it('decides every key by itself', () => {
    const base = { 'novira.a': '1', 'novira.b': '1' };
    const p = plan(base, base, { 'novira.a': 'typed', 'novira.b': '1' }, { 'novira.a': '2', 'novira.b': '2' });
    expect([...p.apply]).toEqual([['novira.b', '2']]);
  });

  it('does nothing when nothing changed', () => {
    const s = { 'novira.a': '1', 'novira.b': '2' };
    const p = plan(s, s, s, { ...s });
    expect(p).toEqual({ apply: new Map(), later: [], same: [] });
  });
});

describe('sameState', () => {
  it('compares keys and texts, not their order', () => {
    expect(sameState({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
    expect(sameState({ a: '1' }, { a: '1', b: '2' })).toBe(false);
    expect(sameState({ a: '1' }, { a: '2' })).toBe(false);
    expect(sameState({}, {})).toBe(true);
  });
});
