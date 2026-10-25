// Vertical writing for canvas text, which has no vertical mode of its own: how each character is placed in its cell.

/** One cell of a vertical column. */
export type VUnit =
  | {
      kind: 'glyph';
      ch: string;
      /** Turned 90 degrees clockwise (long vowel mark, dashes, brackets). */
      rotate: boolean;
      /** Offset inside the cell in em (punctuation sits to the upper right, small kana a little). */
      dx: number;
      dy: number;
    }
  /** Two characters set side by side in one cell: `!!`, `!?`, two-digit numbers. */
  | { kind: 'pair'; text: string };

// Written with escapes, since UI source holds no Japanese text. Rotated: long vowel mark, dashes, wave dash, ellipses,
// brackets, colons.
const ROTATED = new Set([...'\u30FC\uFF0D\u2015\u2014\u2013-\u301C\uFF5E~\u2026\u2025\uFF08\uFF09()\uFF3B\uFF3D[]\u3010\u3011\u3008\u3009\u300A\u300B\uFF5B\uFF5D{}\u300C\u300D\u300E\u300F<>\uFF1C\uFF1E\uFF1A:']);
const PUNCTUATION = new Set([...'\u3001\u3002\uFF0C\uFF0E']);
const SMALL_KANA = new Set([...'\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308E\u3095\u3096\u30A1\u30A3\u30A5\u30A7\u30A9\u30C3\u30E3\u30E5\u30E7\u30EE\u30F5\u30F6']);
const PAIR = /^(?:[!?\uFF01\uFF1F]{2}|\d{2})/u;

/** Characters that may not start a line or column. */
export const NO_LINE_START = new Set([...'\u3001\u3002\uFF0C\uFF0E\uFF09\u300D\u300F\u3011\u3009\u300B\uFF5D\uFF3D!?\uFF01\uFF1F\u3083\u3085\u3087\u3063\u3041\u3043\u3045\u3047\u3049\u308E\u30FC\u2026\u30FB\uFF1A\uFF1B,.)]}:;']);
/** Characters that may not end a line or column. */
export const NO_LINE_END = new Set([...'\uFF08\u300C\u300E\u3010\u3008\u300A\uFF5B\uFF3B([{']);

function normalizePair(text: string): string {
  return text.replace('\uFF01', '!').replace('\uFF1F', '?');
}

export function verticalGlyph(ch: string): Extract<VUnit, { kind: 'glyph' }> {
  if (ROTATED.has(ch)) return { kind: 'glyph', ch, rotate: true, dx: 0, dy: 0 };
  if (PUNCTUATION.has(ch)) return { kind: 'glyph', ch, rotate: false, dx: 0.55, dy: -0.55 };
  if (SMALL_KANA.has(ch)) return { kind: 'glyph', ch, rotate: false, dx: 0.12, dy: -0.12 };
  return { kind: 'glyph', ch, rotate: false, dx: 0, dy: 0 };
}

/** The cells of one line of text written vertically. */
export function verticalUnits(line: string): VUnit[] {
  const out: VUnit[] = [];
  const chars = [...line];
  for (let i = 0; i < chars.length; ) {
    const rest = chars.slice(i).join('');
    const pair = PAIR.exec(rest);
    // Two digits make a pair only when they are the whole number: `10` yes, `100` no.
    if (pair && !(/\d/.test(pair[0]) && /\d/.test(chars[i + 2] ?? '')) && !(/\d/.test(pair[0]) && i > 0 && /\d/.test(chars[i - 1]!))) {
      out.push({ kind: 'pair', text: normalizePair(pair[0]) });
      i += 2;
      continue;
    }
    out.push(verticalGlyph(chars[i]!));
    i += 1;
  }
  return out;
}

export function unitChar(u: VUnit): string {
  return u.kind === 'pair' ? u.text : u.ch;
}
