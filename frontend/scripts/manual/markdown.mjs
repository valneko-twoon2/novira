// A small Markdown to HTML renderer for the user manual (docs/manual/<locale>/*.md).
// Only what the manual uses is supported, and nothing from the source reaches the page unescaped:
//   blocks: headings (# to ####), paragraphs, bullet and numbered lists (nested by indentation), tables, fenced code,
//           block quotes (notes), horizontal rules, a picture on a line of its own (becomes a figure)
//   inline: **bold**, *italic*, `code`, [text](url), ![alt](shot:<scene id>)
//   UI words: {{ui:<message key>}} is replaced by that message of the manual's language, so the manual names buttons
//             and tabs exactly as the screen does (an unknown key is a problem, and so is a message with placeholders)
// Links may point to https/http pages, to `#anchors`, or to another chapter file (`03-canvas.md`, `03-canvas.md#fixes`).
// Anything else is shown as plain text and reported in `problems`, so a broken link fails the build instead of shipping.

/** @typedef {{ level: number, text: string, id: string }} Heading */
/**
 * @typedef {object} RenderOptions
 * @property {(key: string) => string | undefined} [message] the UI message of the manual's language
 * @property {(file: string) => string | undefined} [chapterId] the page id of a chapter file, or undefined when there is none
 * @property {(file: string) => string} [chapterPage] the page file of a chapter (empty for the chapter being rendered), when each chapter has its own page
 * @property {string} [idPrefix] put before every heading id, so ids stay unique when chapters share one page (the chapter title takes the prefix alone)
 * @property {string} [linkPrefix] the prefix for links to headings of this chapter inside a fragment (a quote): its own headings take no prefix there, but its links still need the chapter's
 * @property {boolean} [fragment] a piece inside another chapter (a block quote): no title is required
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const UNESCAPES = Object.fromEntries(Object.entries(ESCAPES).map(([c, e]) => [e, c]));

/** The text escapeHtml was given back. */
export function unescapeHtml(text) {
  return String(text).replace(/&(amp|lt|gt|quot|#39);/g, (e) => UNESCAPES[e]);
}

/** An anchor id from heading text: lower case, letters and digits of any script kept, everything else becomes a hyphen. */
export function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}＀-￯]/u;

/** A line break inside a paragraph is a space, except between two wide (CJK) characters where a gap would look wrong. */
function joinLines(lines) {
  let out = lines[0] ?? '';
  for (let i = 1; i < lines.length; i++) {
    const before = out.slice(-1);
    const after = lines[i].charAt(0);
    out += WIDE.test(before) && WIDE.test(after) ? lines[i] : ` ${lines[i]}`;
  }
  return out;
}

/**
 * Renders one chapter.
 * @param {string} source
 * @param {RenderOptions} [options]
 * @returns {{ html: string, title: string, headings: Heading[], shots: string[], problems: string[] }}
 */
export function renderMarkdown(source, options = {}) {
  const problems = [];
  const shots = [];
  const headings = [];
  const usedIds = new Map();
  const text = source.replace(/\r\n?/g, '\n');

  const uiText = (match, key) => {
    const value = options.message?.(key);
    if (value === undefined) {
      problems.push(`unknown UI message key {{ui:${key}}}`);
      return key;
    }
    if (/\{\w+\}/.test(value)) {
      problems.push(`UI message ${key} has placeholders, so it cannot be used as a word in the manual`);
      return key;
    }
    return value;
  };

  function link(label, url) {
    const prefix = options.linkPrefix ?? options.idPrefix ?? '';
    if (/^https?:\/\//i.test(url)) return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    if (url.startsWith('#')) return `<a href="#${escapeHtml(prefix ? `${prefix}--${url.slice(1)}` : url.slice(1))}">${label}</a>`;
    const m = /^([\w.-]+\.md)(?:#([\w\p{L}-]+))?$/u.exec(url);
    if (m) {
      const id = options.chapterId?.(m[1]);
      if (id) {
        const page = options.chapterPage?.(m[1]) ?? '';
        const target = m[2] ? `${id}--${m[2]}` : id;
        // On another chapter's page the link opens the page; a heading is reached through its id.
        return `<a href="${escapeHtml(page ? (m[2] ? `${page}#${target}` : page) : `#${target}`)}">${label}</a>`;
      }
      problems.push(`link to a chapter that does not exist: ${url}`);
      return label;
    }
    problems.push(`link not allowed (only https, #anchors and chapter files): ${url}`);
    return label;
  }

  function inline(raw) {
    const spans = [];
    // Code spans first (kept aside behind private-use markers): their content is shown as it is and must not be read as emphasis or links.
    let s = raw.replace(/\{\{ui:([\w.-]+)\}\}/g, uiText).replace(/`([^`]+)`/g, (m, code) => {
      spans.push(`<code>${escapeHtml(code)}</code>`);
      return `${spans.length - 1}`;
    });
    s = escapeHtml(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const shot = /^shot:([\w-]+)$/.exec(url);
      if (!shot) {
        problems.push(`picture not allowed (only shot:<scene id>): ${url}`);
        return alt;
      }
      if (!alt.trim()) problems.push(`picture ${shot[1]} has no description`);
      shots.push(shot[1]);
      return `<img src="images/${shot[1]}.png" alt="${alt}" loading="lazy">`;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => link(label, url.replace(/&amp;/g, '&')));
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
    return s.replace(/(\d+)/g, (m, i) => spans[Number(i)]);
  }

  function headingId(textValue) {
    // The id comes from the words (an apostrophe is a separator, not "39").
    const base = slugify(textValue);
    const n = usedIds.get(base) ?? 0;
    usedIds.set(base, n + 1);
    const unique = n === 0 ? base : `${base}-${n + 1}`;
    return options.idPrefix ? `${options.idPrefix}--${unique}` : unique;
  }

  const listStart = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  const lines = text.split('\n');
  const out = [];
  let title = '';

  /** Reads a list starting at `i`; returns the HTML and the index after the list. */
  function readList(i, indent) {
    const first = listStart.exec(lines[i]);
    const ordered = /\d/.test(first[2]);
    const items = [];
    while (i < lines.length) {
      const m = listStart.exec(lines[i]);
      if (!m || m[1].length < indent) break;
      if (m[1].length > indent) {
        // A deeper item belongs to the previous one.
        const nested = readList(i, m[1].length);
        if (items.length) items[items.length - 1].children += nested.html;
        i = nested.next;
        continue;
      }
      const item = { lines: [m[3]], children: '' };
      i++;
      // Lines indented under the item continue its text.
      while (i < lines.length && lines[i].trim() !== '' && !listStart.test(lines[i]) && /^\s{2,}/.test(lines[i])) {
        item.lines.push(lines[i].trim());
        i++;
      }
      items.push(item);
    }
    const tag = ordered ? 'ol' : 'ul';
    return {
      html: `<${tag}>${items.map((it) => `<li>${inline(joinLines(it.lines))}${it.children}</li>`).join('')}</${tag}>`,
      next: i,
    };
  }

  const splitRow = (row) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      const rendered = inline(h[2]);
      // The words without markup or escapes: the title and the heading texts are escaped once, where a page prints them.
      const plain = unescapeHtml(rendered.replace(/<[^>]+>/g, ''));
      const id = level === 1 && !title && options.idPrefix ? options.idPrefix : headingId(plain);
      if (level === 1 && !title) title = plain;
      headings.push({ level, text: plain, id });
      out.push(`<h${level} id="${escapeHtml(id)}">${rendered}</h${level}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<aside class="note">${renderMarkdownFragment(body.join('\n'))}</aside>`);
      continue;
    }
    if (listStart.test(line)) {
      const list = readList(i, listStart.exec(line)[1].length);
      out.push(list.html);
      i = list.next;
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|```|>\s?|(-{3,}|\*{3,})\s*$)/.test(lines[i]) &&
      !listStart.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    const joined = joinLines(para);
    const onlyPicture = /^!\[([^\]]*)\]\(shot:[\w-]+\)$/.exec(joined);
    if (onlyPicture) {
      out.push(`<figure>${inline(joined)}<figcaption>${escapeHtml(onlyPicture[1])}</figcaption></figure>`);
    } else {
      out.push(`<p>${inline(joined)}</p>`);
    }
  }

  /** A block quote holds blocks too (paragraphs, lists); render it with the same rules and merge what it found. */
  function renderMarkdownFragment(fragment) {
    const inner = renderMarkdown(fragment, { ...options, fragment: true, idPrefix: undefined, linkPrefix: options.linkPrefix ?? options.idPrefix });
    problems.push(...inner.problems);
    shots.push(...inner.shots);
    return inner.html;
  }

  if (!title && !options.fragment) problems.push('the chapter has no "# " title');
  return { html: out.join('\n'), title, headings, shots, problems };
}
