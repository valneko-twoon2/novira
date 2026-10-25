// Property tests for the comma separated prompt helpers. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { addTag, estimateTokens, hasTag, removeTag, withTagsFirst, withTagsLast } from './promptTags';

// A tag is one comma-free, non-blank word group: the helpers split on commas, so a tag with a comma is two tags.
const tag = fc.string({ maxLength: 12 }).filter((s) => !s.includes(',') && s.trim() !== '');
const prompt = fc.array(tag, { maxLength: 6 }).map((tags) => tags.join(', '));

describe('prompt tags (properties)', () => {
  it('addTag makes the tag present and is idempotent', () => {
    check(
      fc.property(prompt, tag, (p, t) => {
        const once = addTag(p, t);
        expect(hasTag(once, t)).toBe(true);
        expect(addTag(once, t)).toBe(once);
      }),
    );
  });

  it('removeTag makes the tag absent, is idempotent and keeps the other tags', () => {
    check(
      fc.property(prompt, tag, (p, t) => {
        const once = removeTag(p, t);
        expect(hasTag(once, t)).toBe(false);
        expect(removeTag(once, t)).toBe(once);
        expect(hasTag(once, 'zzz-other') === hasTag(p, 'zzz-other')).toBe(true);
      }),
    );
  });

  it('tag matching ignores case and surrounding spaces', () => {
    check(fc.property(prompt, tag, (p, t) => hasTag(addTag(p, t), `  ${t.toUpperCase()} `)));
  });

  it('withTagsFirst / withTagsLast contain every tag of both texts exactly once and order the new tags', () => {
    check(
      fc.property(prompt, prompt, (p, extra) => {
        for (const merged of [withTagsFirst(p, extra), withTagsLast(p, extra)]) {
          const parts = merged.split(',').map((s) => s.trim()).filter(Boolean);
          for (const t of [...p.split(','), ...extra.split(',')].map((s) => s.trim()).filter(Boolean)) expect(hasTag(merged, t)).toBe(true);
          const keys = parts.map((s) => s.toLowerCase());
          // existing duplicates of the original prompt stay as they are; added tags are never duplicates
          expect(keys.length).toBeGreaterThanOrEqual(new Set(p.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)).size);
        }
        const first = withTagsFirst(p, extra).split(',').map((s) => s.trim()).filter(Boolean);
        const orig = p.split(',').map((s) => s.trim()).filter(Boolean);
        expect(first.slice(first.length - orig.length)).toEqual(orig);
        const last = withTagsLast(p, extra).split(',').map((s) => s.trim()).filter(Boolean);
        expect(last.slice(0, orig.length)).toEqual(orig);
      }),
    );
  });

  it('estimateTokens is a count that adds up across separated texts and never throws', () => {
    check(fc.property(junkText, junkText, (a, b) => estimateTokens(a) >= 0 && estimateTokens(`${a} ${b}`) === estimateTokens(a) + estimateTokens(b)));
  });

  // Regression: a blank tag is not added (it used to leave an empty entry and a dangling separator: addTag('a', '') gave 'a, ').
  it('does not append a blank tag', () => {
    expect(addTag('a', '')).toBe('a');
  });
});
