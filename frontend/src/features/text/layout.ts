// Text layout without a canvas: wrapping (with Japanese line-breaking rules), vertical columns and fitting text to a box.
import type { TextStyle } from '@/state/text/textModel';
import { NO_LINE_END, NO_LINE_START, unitChar, verticalUnits, type VUnit } from './vertical';

/** Width of `text` set at `size` pixels in the style's font. */
export type Measure = (text: string, size: number) => number;

export interface HLine {
  text: string;
  width: number;
}

export interface HorizontalBlock {
  kind: 'h';
  lines: HLine[];
  /** Distance between baselines. */
  step: number;
  width: number;
  height: number;
}

export interface VerticalBlock {
  kind: 'v';
  /** Columns in reading order: the first one is rightmost. */
  columns: VUnit[][];
  /** Height of one cell. */
  cell: number;
  /** Distance between column centres. */
  step: number;
  width: number;
  height: number;
}

export type TextBlock = HorizontalBlock | VerticalBlock;

const TOKEN = /[A-Za-z0-9]+['’]?[A-Za-z0-9]*|\s+|./gu;

function lineWidth(text: string, size: number, spacing: number, measure: Measure): number {
  const count = [...text].length;
  return measure(text, size) + spacing * Math.max(0, count - 1);
}

/** Breaks one paragraph into lines no wider than `maxWidth` (null: never break). */
function wrapParagraph(text: string, size: number, spacing: number, maxWidth: number | null, measure: Measure): string[] {
  if (maxWidth === null || text === '') return [text];
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => lineWidth(s, size, spacing, measure) <= maxWidth;
  const push = (token: string) => {
    if (line === '' || fits(line + token)) {
      line += token;
      return;
    }
    if (/^\s+$/.test(token)) return;
    const first = [...token][0]!;
    const last = [...line].at(-1)!;
    if (NO_LINE_START.has(first)) {
      line += token;
      return;
    }
    if (NO_LINE_END.has(last)) {
      // An opening bracket may not end a line: it travels to the next one.
      const chars = [...line];
      chars.pop();
      lines.push(chars.join('').trimEnd());
      line = last + token;
      return;
    }
    lines.push(line.trimEnd());
    line = token;
  };
  for (const token of text.match(TOKEN) ?? []) {
    if (!/^\s+$/.test(token) && [...token].length > 1 && lineWidth(token, size, spacing, measure) > maxWidth) {
      // A single word wider than the box, wherever it stands in the line: break it between characters.
      for (const ch of token) push(ch);
    } else {
      push(token);
    }
  }
  lines.push(line.trimEnd());
  return lines;
}

export function layoutHorizontal(text: string, style: TextStyle, maxWidth: number | null, measure: Measure): HorizontalBlock {
  const size = style.fontSize;
  const lines = text
    .split('\n')
    .flatMap((p) => wrapParagraph(p, size, style.letterSpacing, maxWidth, measure))
    .map((t) => ({ text: t, width: lineWidth(t, size, style.letterSpacing, measure) }));
  const step = size * style.lineHeight;
  return {
    kind: 'h',
    lines,
    step,
    width: Math.max(0, ...lines.map((l) => l.width)),
    height: lines.length === 0 ? 0 : size + step * (lines.length - 1),
  };
}

/** Breaks one vertical paragraph into columns of at most `maxRows` cells. */
function wrapColumn(units: VUnit[], maxRows: number | null): VUnit[][] {
  if (maxRows === null || units.length <= maxRows) return [units];
  const columns: VUnit[][] = [];
  let col: VUnit[] = [];
  for (const u of units) {
    if (col.length >= maxRows) {
      const ch = unitChar(u);
      const lastCh = unitChar(col.at(-1)!);
      if (NO_LINE_START.has([...ch][0]!)) {
        col.push(u);
        continue;
      }
      if (NO_LINE_END.has([...lastCh][0]!) && col.length > 1) {
        const moved = col.pop()!;
        columns.push(col);
        col = [moved, u];
        continue;
      }
      columns.push(col);
      col = [];
    }
    col.push(u);
  }
  columns.push(col);
  return columns;
}

export function layoutVertical(text: string, style: TextStyle, maxHeight: number | null): VerticalBlock {
  const size = style.fontSize;
  const cell = size + style.letterSpacing;
  const maxRows = maxHeight === null ? null : Math.max(1, Math.floor(maxHeight / cell));
  const columns = text.split('\n').flatMap((p) => wrapColumn(verticalUnits(p), maxRows));
  const step = size * style.lineHeight;
  return {
    kind: 'v',
    columns,
    cell,
    step,
    width: columns.length === 0 ? 0 : size + step * (columns.length - 1),
    height: Math.max(0, ...columns.map((c) => c.length)) * cell,
  };
}

/** Lays text out; `maxExtent` is the box width (horizontal) or height (vertical) to wrap to, null for no wrapping. */
export function layoutText(text: string, style: TextStyle, maxExtent: number | null, measure: Measure): TextBlock {
  return style.vertical ? layoutVertical(text, style, maxExtent) : layoutHorizontal(text, style, maxExtent, measure);
}

/** The largest font size (down to `min`) at which the text fits the box, wrapped inside it. */
export function fitFontSize(text: string, style: TextStyle, box: { width: number; height: number }, measure: Measure, min = 6): number {
  const fits = (size: number) => {
    // Letter spacing scales with the size, as it does when the font size changes by hand.
    const scaled = { ...style, fontSize: size, letterSpacing: (style.letterSpacing * size) / style.fontSize };
    const block = layoutText(text, scaled, scaled.vertical ? box.height : box.width, measure);
    return block.width <= box.width + 0.5 && block.height <= box.height + 0.5;
  };
  let lo = min;
  let hi = Math.max(min, Math.round(style.fontSize));
  if (fits(hi)) return hi;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
