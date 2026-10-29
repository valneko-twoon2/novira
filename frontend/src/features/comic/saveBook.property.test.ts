// Whatever a comic is called, the file name made from it is one the system accepts: never empty, none of the characters
// Windows forbids, no control character, no trailing dot or space, and the format's ending after it. Making the name safe
// twice changes nothing more (for names of ordinary characters).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check, junkText } from '@/propertyTest.testkit';
import { bookFileName, fileBase, type BookFormat } from './saveBook';

blockExternalNetwork();

const FORBIDDEN = /[\\/:*?"<>|]/;
const noControl = (s: string) => [...s].every((ch) => ch.charCodeAt(0) >= 32);
const format = fc.constantFrom<BookFormat>('pdf', 'cbz', 'psd');
/** Names built from the characters that matter: forbidden ones, dots, spaces, controls and ordinary text. */
const name = fc.oneof(
  junkText,
  fc.stringMatching(/^[a-zA-Z0-9 ._\\/:*?"<>|\t\n-]{0,24}$/),
  fc.array(fc.constantFrom('.', ' ', 'a', '\\', ':', '|', '\u0000', '\t'), { maxLength: 12 }).map((a) => a.join('')),
);

describe('fileBase', () => {
  it('is never empty and has no forbidden character, control character, or trailing dot or space', () => {
    check(
      fc.property(name, (n) => {
        const base = fileBase(n);
        expect(base.length).toBeGreaterThan(0);
        expect(FORBIDDEN.test(base)).toBe(false);
        expect(noControl(base)).toBe(true);
        expect(/[. ]$/.test(base)).toBe(false);
      }),
    );
  });

  it('is idempotent on ASCII names and keeps a name that is already safe as it is', () => {
    check(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9 ._\\/:*?"<>|-]{0,24}$/), (n) => {
        const once = fileBase(n);
        expect(fileBase(once)).toBe(once);
      }),
    );
    check(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9_-][a-zA-Z0-9 _.-]{0,20}[a-zA-Z0-9_-]$/), (n) => {
        expect(fileBase(n)).toBe(n);
      }),
    );
  });
});

describe('bookFileName', () => {
  it('is the safe base followed by the ending of the format, and the ending differs per format', () => {
    check(
      fc.property(name, format, (n, f) => {
        const file = bookFileName(n, f);
        expect(file.startsWith(fileBase(n))).toBe(true);
        expect(file.slice(fileBase(n).length)).toBe({ pdf: '.pdf', cbz: '.cbz', psd: '-psd.zip' }[f]);
        expect(FORBIDDEN.test(file)).toBe(false);
      }),
    );
    expect(new Set((['pdf', 'cbz', 'psd'] as const).map((f) => bookFileName('x', f))).size).toBe(3);
  });
});
