// Property tests for wildcard list parsing and naming: arbitrary text never throws, entries
// are clean, names that come out are always valid and unused. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { freeWildcardName, isWildcardName, wildcardEntries, wildcardMap, type WildcardList } from './wildcards';

const list = (name: string, text = ''): WildcardList => ({ id: name, name, text });
const used = fc.array(fc.stringMatching(/^[a-z0-9]{1,4}(-[2-5])?$/), { maxLength: 6 }).map((names) => names.map((n) => list(n)));

describe('wildcard lists (properties)', () => {
  it('wildcardEntries returns trimmed, non-empty lines that are not comments, for any text', () => {
    check(
      fc.property(fc.oneof(junkText, fc.string({ maxLength: 200 })), (text) => {
        for (const e of wildcardEntries(text)) {
          expect(e).toBe(e.trim());
          expect(e).not.toBe('');
          expect(e.startsWith('#')).toBe(false);
          // a lone CR is not a line end for this parser (textareas and importListFiles turn it into LF first)
          expect(e.includes('\n')).toBe(false);
        }
      }),
    );
  });

  it('freeWildcardName always returns a valid, unused name', () => {
    check(
      fc.property(fc.oneof(junkText, fc.string({ unit: 'grapheme', maxLength: 30 })), used, (wanted, lists) => {
        const name = freeWildcardName(wanted, lists);
        expect(isWildcardName(name)).toBe(true);
        expect(lists.some((l) => l.name === name)).toBe(false);
      }),
    );
  });

  it('wildcardMap has one entry per list name', () => {
    check(
      fc.property(used, (lists) => {
        const map = wildcardMap(lists);
        for (const l of lists) expect(map[l.name]).toEqual(wildcardEntries(l.text));
      }),
    );
  });
});
