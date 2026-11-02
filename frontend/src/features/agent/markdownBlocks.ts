// The Markdown that models write in their answers, read into blocks (paragraphs, headings, lists, quotes, code, tables)
// and inline pieces (bold, italics, strike-through, code, links). Pure data: `ChatMarkdown.tsx` turns it into elements,
// so no text is ever read as HTML.

export type MdInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong' | 'em' | 'del'; children: MdInline[] }
  | { kind: 'link'; children: MdInline[]; href: string };

export type MdBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: MdBlock[][] }
  | { kind: 'quote'; blocks: MdBlock[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'rule' };

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const blank = (line: string) => line.trim() === '';
const indentOf = (line: string) => line.length - line.trimStart().length;
const isOrdered = (marker: string) => /\d/.test(marker);

/** The cells of a table row: split at `|` that is not escaped, the outer pipes dropped. */
function cells(line: string): string[] {
  const row = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return row.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

const isTableStart = (lines: readonly string[], i: number) => lines[i]!.includes('|') && i + 1 < lines.length && lines[i + 1]!.includes('-') && TABLE_RULE.test(lines[i + 1]!);

/** Whether a line opens a block of its own, so it ends the paragraph before it. */
function opensBlock(lines: readonly string[], i: number): boolean {
  const line = lines[i]!;
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || (LIST.test(line) && indentOf(line) <= 3) || isTableStart(lines, i);
}

/** The blocks of a text. */
export function parseBlocks(text: string): MdBlock[] {
  return blocksOf(text.replace(/\r\n?/g, '\n').split('\n'));
}

function blocksOf(lines: readonly string[]): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (blank(line)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const close = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith(close)) body.push(lines[i++]!);
      i++;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) body.push(lines[i++]!.replace(QUOTE, ''));
      blocks.push({ kind: 'quote', blocks: blocksOf(body) });
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && !blank(lines[i]!) && lines[i]!.includes('|')) rows.push(cells(lines[i++]!));
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    const item = LIST.exec(line);
    if (item) {
      const list = listAt(lines, i);
      blocks.push(list.block);
      i = list.next;
      continue;
    }
    const body = [line.trim()];
    i++;
    while (i < lines.length && !blank(lines[i]!) && !opensBlock(lines, i)) body.push(lines[i++]!.trim());
    blocks.push({ kind: 'paragraph', text: body.join('\n') });
  }
  return blocks;
}

/** The list that starts at line `start`: its items (each read as blocks, so a list can hold another) and the line after it. */
function listAt(lines: readonly string[], start: number): { block: MdBlock; next: number } {
  const first = LIST.exec(lines[start]!)!;
  const indent = first[1]!.length;
  const ordered = isOrdered(first[2]!);
  const sibling = (line: string) => {
    const m = LIST.exec(line);
    return !!m && m[1]!.length === indent && isOrdered(m[2]!) === ordered;
  };
  const items: MdBlock[][] = [];
  let i = start;
  while (i < lines.length) {
    if (blank(lines[i]!)) {
      // A blank line goes on with the list only when the next text is another item of it.
      let j = i;
      while (j < lines.length && blank(lines[j]!)) j++;
      if (j < lines.length && sibling(lines[j]!)) {
        i = j;
        continue;
      }
      break;
    }
    if (!sibling(lines[i]!)) break;
    const m = LIST.exec(lines[i]!)!;
    const inner = indent + m[2]!.length + 1;
    const body = [m[3]!];
    i++;
    while (i < lines.length) {
      const line = lines[i]!;
      if (blank(line)) {
        let j = i;
        while (j < lines.length && blank(lines[j]!)) j++;
        if (j < lines.length && indentOf(lines[j]!) > indent && !sibling(lines[j]!)) {
          body.push('');
          i++;
          continue;
        }
        break;
      }
      if (indentOf(line) > indent) body.push(line.slice(Math.min(indentOf(line), inner)));
      else if (sibling(line) || opensBlock(lines, i)) break;
      else body.push(line.trim());
      i++;
    }
    items.push(blocksOf(body));
  }
  return { block: { kind: 'list', ordered, start: ordered ? parseInt(first[2]!, 10) : 1, items }, next: i };
}

// Inline pieces, earliest first; at one place the longer marker wins (`**` before `*`). `_` marks only outside a word, so
// snake_case names stay as they are.
const INLINE =
  /`([^`\n]+)`|\*\*(?=\S)([\s\S]*?\S)\*\*|(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)|~~(?=\S)([\s\S]*?\S)~~|\*(?=[^\s*])([\s\S]*?[^\s*])\*|(?<!\w)_(?=[^\s_])([\s\S]*?[^\s_])_(?!\w)|\[([^\]\n]+)\]\(([^)\s]+)\)|\\([\\`*_[\]()#+\-.!~|>])/g;

/** The inline pieces of a text. */
export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  const pushText = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last?.kind === 'text') last.text += s;
    else out.push({ kind: 'text', text: s });
  };
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    pushText(text.slice(at, m.index));
    at = m.index + m[0].length;
    const [, code, strong, strong2, del, em, em2, label, href, escaped] = m;
    if (code !== undefined) out.push({ kind: 'code', text: code });
    else if (strong !== undefined || strong2 !== undefined) out.push({ kind: 'strong', children: parseInline(strong ?? strong2!) });
    else if (del !== undefined) out.push({ kind: 'del', children: parseInline(del) });
    else if (em !== undefined || em2 !== undefined) out.push({ kind: 'em', children: parseInline(em ?? em2!) });
    else if (label !== undefined) out.push({ kind: 'link', children: parseInline(label), href: href! });
    else pushText(escaped ?? m[0]);
  }
  pushText(text.slice(at));
  return out;
}
