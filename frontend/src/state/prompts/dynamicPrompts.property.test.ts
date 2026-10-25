// Property and fuzz tests for the dynamic prompt syntax ({a|b} groups, __wildcards__): arbitrary text and arbitrary
// (even cyclic) wildcard lists never throw or run away, results respect the limit, and the random pick is one of the
// combinations. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText, blockExternalNetwork } from '@/propertyTest.testkit';
import { expandPrompt, hasDynamicSyntax, hasProblems, MAX_DYNAMIC_PROMPTS, randomPrompt, usesWildcards, wildcardProblems, type WildcardLists } from './dynamicPrompts';

blockExternalNetwork();

const word = fc.stringMatching(/^[a-z]{1,5}$/);
const name = fc.constantFrom('a', 'b', 'c', 'hair', 'eyes');
/** Lists whose entries may use groups and other wildcards, so cycles and long chains occur. */
const entry = fc.oneof(word, name.map((n) => `__${n}__`), fc.tuple(word, word).map(([x, y]) => `{${x}|${y}}`), junkText);
const lists: fc.Arbitrary<WildcardLists> = fc.dictionary(name, fc.array(entry, { maxLength: 4 }), { maxKeys: 5 });
/** A template made of plain words, groups and wildcards. */
const template = fc
  .array(fc.oneof(word, name.map((n) => `__${n}__`), fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => `{${w.join('|')}}`)), { maxLength: 6 })
  .map((parts) => parts.join(' '));

const tidy = (s: string) => s === s.replace(/\s+/g, ' ').trim();

describe('dynamic prompts (properties)', () => {
  it('expandPrompt never throws, respects the limit and returns tidy, unique prompts', () => {
    check(
      fc.property(fc.oneof(junkText, template), lists, fc.integer({ min: 1, max: 50 }), (text, l, limit) => {
        const out = expandPrompt(text, limit, l);
        expect(out.length).toBeLessThanOrEqual(limit);
        expect(new Set(out).size).toBe(out.length);
        expect(out.every(tidy)).toBe(true);
      }),
    );
  });

  it('expandPrompt of plain words is the tidied text itself', () => {
    check(fc.property(fc.array(word, { maxLength: 6 }), (words) => expandPrompt(words.join('   ')).join('|') === words.join(' ')));
  });

  it('a group expands to each of its options', () => {
    check(
      fc.property(fc.uniqueArray(word, { minLength: 1, maxLength: 8 }), (options) => {
        expect(expandPrompt(`{${options.join('|')}}`)).toEqual(options);
      }),
    );
  });

  it('the default cap holds for explosive templates', () => {
    const big = Array.from({ length: 12 }, () => '{a|b|c|d}').join(' ');
    expect(expandPrompt(big).length).toBeLessThanOrEqual(MAX_DYNAMIC_PROMPTS);
  });

  it('randomPrompt never throws, is deterministic per seed and is one of the combinations', () => {
    check(
      fc.property(template, lists, fc.integer({ min: -(2 ** 31), max: 2 ** 32 }), (text, l, seed) => {
        const first = randomPrompt(text, l, seed);
        expect(randomPrompt(text, l, seed)).toBe(first);
        expect(tidy(first)).toBe(true);
        if (!hasProblems(wildcardProblems(text, l))) expect(expandPrompt(text, 5000, l)).toContain(first);
      }),
    );
  });

  it('randomPrompt copes with arbitrary text and arbitrary lists', () => {
    check(fc.property(junkText, lists, fc.integer(), (text, l, seed) => typeof randomPrompt(text, l, seed) === 'string'));
  });

  it('wildcardProblems terminates on cyclic lists and agrees with expansion when it finds none', () => {
    check(
      fc.property(template, lists, (text, l) => {
        const p = wildcardProblems(text, l);
        expect(p.unknown.every((n) => !(n in l))).toBe(true);
        if (!hasProblems(p)) expect(expandPrompt(text, 200, l).every((x) => !/__(a|b|c|hair|eyes)__/.test(x))).toBe(true);
      }),
    );
  });

  it('hasDynamicSyntax and usesWildcards never throw; wildcards imply dynamic syntax', () => {
    check(
      fc.property(junkText, (text) => {
        const w = usesWildcards(text);
        const d = hasDynamicSyntax(text);
        if (w) expect(d).toBe(true);
      }),
    );
  });
});
