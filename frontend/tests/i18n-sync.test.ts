// The language-sync check of the pre-commit hook: ja and en change together, and the other languages keep no out-of-date text.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { changedKeys, unsyncedKeys } from '../scripts/check-i18n-sync.mjs';

describe('check-i18n-sync', () => {
  it('finds added, removed and rewritten keys', () => {
    expect(changedKeys({ a: '1', b: '2', c: '3' }, { a: '1', b: 'two', d: '4' }).sort()).toEqual(['b', 'c', 'd']);
    expect(changedKeys({ a: '1' }, { a: '1' })).toEqual([]);
  });

  it('does not count a fix of the capitals in the product name as a change', () => {
    expect(changedKeys({ a: 'novira を開く', b: '2' }, { a: 'novira を開く', b: '2' })).toEqual([]);
    expect(changedKeys({ a: 'novira' }, { a: 'novira to' })).toEqual(['a']);
  });

  it('wants ja and en to change the same keys', () => {
    expect(unsyncedKeys({ ja: ['x', 'y'], en: ['x'] })).toEqual({ en: ['y'] });
    expect(unsyncedKeys({ ja: ['x'], en: ['x'] })).toEqual({});
  });

  it('lets another language leave a new message for later, but not keep an old text of a changed one', () => {
    // ko has nothing for x (new) and never had y: fine. It had z and did not change it: out of date.
    expect(unsyncedKeys({ ja: ['x', 'z'], en: ['x', 'z'], ko: [] }, [], { ko: new Set(['z']) })).toEqual({ ko: ['z'] });
    expect(unsyncedKeys({ ja: ['x'], en: ['x'], ko: [] }, [], { ko: new Set() })).toEqual({});
  });

  it('accepts a translation made on its own, and a text that was updated or removed', () => {
    expect(unsyncedKeys({ ja: [], en: [], ko: ['x', 'y'] })).toEqual({});
    expect(unsyncedKeys({ ja: ['z'], en: ['z'], ko: ['z'] }, [], { ko: new Set(['z']) })).toEqual({});
  });

  it('leaves out a locale added in the same commit', () => {
    expect(unsyncedKeys({ ja: ['x'], en: ['x'], ko: ['x', 'y', 'z'] }, ['ko'])).toEqual({});
    expect(unsyncedKeys({ ja: ['x'], en: [], ko: ['x', 'y'] }, ['ko'])).toEqual({ en: ['x'] });
  });
});
