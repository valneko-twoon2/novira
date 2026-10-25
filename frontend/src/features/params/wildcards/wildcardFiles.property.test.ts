// Property tests for wildcard list files (the text import / export path): any file name gives a valid unused list name and
// the saved text keeps its entries. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { isWildcardName, wildcardEntries, type WildcardList } from '@/state/prompts/wildcards';
import { listFileText, listNameForFile } from './wildcardFiles';

const list = (name: string, text = ''): WildcardList => ({ id: name, name, text });
const used = fc.array(fc.stringMatching(/^[a-z0-9]{1,4}(-[2-5])?$/), { maxLength: 6 }).map((names) => names.map((n) => list(n)));

describe('wildcard list files (properties)', () => {
  it('listNameForFile gives a valid, unused name for any file name', () => {
    check(
      fc.property(junkText, used, (file, lists) => {
        const name = listNameForFile(file, lists);
        expect(isWildcardName(name)).toBe(true);
        expect(lists.some((l) => l.name === name)).toBe(false);
      }),
    );
  });

  it('listFileText uses Windows line ends, ends with one and keeps the entries', () => {
    check(
      fc.property(junkText, (text) => {
        const out = listFileText(list('x', text));
        if (out === '') return;
        expect(out.endsWith('\r\n')).toBe(true);
        expect(/(^|[^\r])\n/.test(out)).toBe(false);
        expect(wildcardEntries(out)).toEqual(wildcardEntries(text));
      }),
    );
  });
});
