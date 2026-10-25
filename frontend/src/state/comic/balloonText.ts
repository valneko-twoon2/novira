// The words of a balloon with their marks: **bold** and 《《emphasis dots》》 (the dots Japanese sets beside each character
// to stress it, bouten). The marks stay in the text the user edits, as web novels write them; the screen and the saved page
// read them here, so both draw the same runs. The two may nest; a mark left open runs to the end of the text.

export interface TextRun {
  text: string;
  bold: boolean;
  dots: boolean;
}

export const BOLD_MARK = { open: '**', close: '**' } as const;
export const DOTS_MARK = { open: '《《', close: '》》' } as const;

export type TextMark = 'bold' | 'dots';

const MARKS = { bold: BOLD_MARK, dots: DOTS_MARK } as const;

/** The text as runs of the same marks, the marks themselves taken out. Empty runs are left out. */
export function textRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let bold = false;
  let dots = false;
  let current = '';
  const flush = () => {
    if (current) runs.push({ text: current, bold, dots });
    current = '';
  };
  for (let i = 0; i < text.length; ) {
    if (text.startsWith(BOLD_MARK.open, i)) {
      flush();
      bold = !bold;
      i += BOLD_MARK.open.length;
    } else if (!dots && text.startsWith(DOTS_MARK.open, i)) {
      flush();
      dots = true;
      i += DOTS_MARK.open.length;
    } else if (dots && text.startsWith(DOTS_MARK.close, i)) {
      flush();
      dots = false;
      i += DOTS_MARK.close.length;
    } else {
      current += text[i];
      i++;
    }
  }
  flush();
  return runs;
}

/** The words without their marks. */
export function plainText(text: string): string {
  return textRuns(text)
    .map((r) => r.text)
    .join('');
}

/** The marks of each character of the plain text, in order (one entry per UTF-16 unit, as the plain text indexes). */
export function charMarks(text: string): { bold: boolean; dots: boolean }[] {
  return textRuns(text).flatMap((r) => Array.from({ length: r.text.length }, () => ({ bold: r.bold, dots: r.dots })));
}

/**
 * Puts a mark round the selected part of the text (`start` to `end`, as a text field gives them), or takes it off when
 * the part is already wrapped in it. Returns the new text and the selection that keeps the same words selected.
 */
export function toggleMark(text: string, start: number, end: number, mark: TextMark): { text: string; start: number; end: number } {
  const { open, close } = MARKS[mark];
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(start, end, 0));
  const wrapped = text.slice(from - open.length, from) === open && text.slice(to, to + close.length) === close;
  if (wrapped && from - open.length >= 0) {
    return { text: text.slice(0, from - open.length) + text.slice(from, to) + text.slice(to + close.length), start: from - open.length, end: to - open.length };
  }
  return { text: text.slice(0, from) + open + text.slice(from, to) + close + text.slice(to), start: from + open.length, end: to + open.length };
}
