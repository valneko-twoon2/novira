// The manual's language tools: the pending list (scripts/manual-pending.mjs) and the pre-commit check (scripts/check-manual-sync.mjs).
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { manualProblems } from '../scripts/check-manual-sync.mjs';
// @ts-expect-error -- plain ESM script without types
import { clearPending, markPending } from '../scripts/manual-pending.mjs';

const followers = ['ko', 'fr'];

describe('markPending', () => {
  it('lists a changed chapter as behind in every other language that did not change it itself', () => {
    expect(markPending({}, ['12-comic.md'], followers, { fr: ['12-comic.md'] })).toEqual({ ko: ['12-comic.md'] });
  });

  it('keeps what was pending, once, in order', () => {
    expect(markPending({ ko: ['09-x.md', '12-comic.md'] }, ['12-comic.md', '03-a.md'], followers)).toEqual({
      fr: ['03-a.md', '12-comic.md'],
      ko: ['03-a.md', '09-x.md', '12-comic.md'],
    });
  });
});

describe('clearPending', () => {
  it('drops the chapters a language has caught up with, and a language with none left', () => {
    expect(clearPending({ ko: ['a.md', 'b.md'], fr: ['a.md'] }, 'ko', ['a.md'])).toEqual({ ko: ['b.md'], fr: ['a.md'] });
    expect(clearPending({ ko: ['a.md'], fr: ['a.md'] }, 'all', ['a.md'])).toEqual({});
  });
});

describe('manualProblems', () => {
  it('wants ja and en to change a chapter together', () => {
    expect(manualProblems({ ja: ['12-comic.md'] }, { ko: ['12-comic.md'] }, ['ko'])).toEqual(['en/12-comic.md: ja and en must change together']);
  });

  it('wants every other language to translate the chapter or list it as pending', () => {
    const staged = { ja: ['12-comic.md'], en: ['12-comic.md'], fr: ['12-comic.md'] };
    expect(manualProblems(staged, { ko: ['12-comic.md'] }, ['ko', 'fr'])).toEqual([]);
    expect(manualProblems(staged, {}, ['ko', 'fr'])).toEqual([expect.stringContaining('ko/12-comic.md')]);
  });

  it('has nothing to say about a commit that touches no ja or en chapter', () => {
    expect(manualProblems({ ko: ['12-comic.md'] }, {}, ['ko'])).toEqual([]);
  });
});
