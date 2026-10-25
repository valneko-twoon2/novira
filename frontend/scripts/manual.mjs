// The user manual in one script: takes the screenshots of every screen in every language, and builds the HTML pages.
//   node frontend/scripts/manual.mjs [all|shots|build] [options]        (repository root or frontend/; or `scripts\manual.bat`)
//     all     (default) shots, then build, then open in the browser (--no-open to skip)
//     shots   take the pictures: every scene of manual/scenes.mjs in every language -> novira-data/work/manual/<language>/images/<scene id>.png
//     build   docs/manual/<language>/*.md -> novira-data/work/manual/<language>/index.html (contents) + one <NN-name>.html per chapter, and novira-data/work/manual/index.html
//   options: --locale ja,en   --scene generate,viewer (shots)   --theme dark|light (shots)   --list (the scenes)
//            --allow-missing-images (build)   --open / --no-open
//
// Source, per language folder:
//   _meta.json        words the page itself needs: { name, title, subtitle, contents, language }
//   NN-name.md        one chapter each, shown in file-name order; the first line is its "# " title
// Pictures are written `![what it shows](shot:<scene id>)` in every language; the id must be a scene of manual/scenes.mjs.
// UI words are written `{{ui:<message key>}}` and come from the language's own message catalog (see manual/markdown.mjs).
// The built page has no script and no outside request (its content security policy forbids both).
//
// Shots start their own Vite dev server and drive the mock backend in Chromium, so no desktop app, engine or GPU is involved.
// The mock gives the same pictures every time, the clock is frozen, and the "mock" badge is hidden, so a rerun changes a picture
// only when the screen itself changed. Languages run side by side; the scenes of one language run in turn; a scene that fails is
// reported and the others still run (exit code 1 at the end). Playwright and Vite are loaded only when pictures are taken, so the
// build functions can be imported (tests/manual.test.ts) without a browser.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderMarkdown } from './manual/markdown.mjs';
import { SCENES } from './manual/scenes.mjs';
import { CHAPTER_FILE, PRIMARY_LOCALES } from './locales.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
export const MANUAL_SOURCE = join(REPO, 'docs', 'manual');
export const MANUAL_OUT = join(REPO, 'novira-data', 'work', 'manual');
const LOCALES_DIR = join(REPO, 'frontend', 'src', 'i18n', 'locales');

/** The words the page needs besides the chapters. */
export const META_KEYS = ['name', 'title', 'subtitle', 'contents', 'language'];

/** The languages of the app: one folder per language under src/i18n/locales. */
export function listLocales() {
  return readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Every message of a language (merged from its area files), with `en` and then `ja` filling in what it lacks, as the app does. */
export function loadMessages(locale) {
  const read = (l) =>
    Object.assign(
      {},
      ...readdirSync(join(LOCALES_DIR, l))
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(LOCALES_DIR, l, f), 'utf8'))),
    );
  return { ...read('ja'), ...read('en'), ...read(locale) };
}

/** The languages whose manual always has every chapter up to date; the others may be behind (docs/manual/pending.json). */
export { PRIMARY_LOCALES };

/** The chapters each other language has not caught up with: { "<language>": ["12-comic.md", ...] }. The page shows the English chapter for them. */
export function readPending(source = MANUAL_SOURCE) {
  const file = join(source, 'pending.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

/** The chapter files of a language, in reading order. */
export function listChapters(locale, source = MANUAL_SOURCE) {
  const dir = join(source, locale);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => CHAPTER_FILE.test(f))
    .sort();
}

export function readMeta(locale, source = MANUAL_SOURCE) {
  return JSON.parse(readFileSync(join(source, locale, '_meta.json'), 'utf8'));
}

/** The page id of a chapter file: `03-canvas.md` -> `ch-03-canvas`. */
export const chapterId = (file) => `ch-${file.replace(/\.md$/, '')}`;

/** The reading-order number of a chapter file: `03-canvas.md` -> `03`. */
const chapterNumber = (file) => file.slice(0, 2);

const CSS = `
/* The look of the app: pure black surfaces, one blue accent, flat (no glow), the brand gradient only on the "n". Tokens copy src/theme/tokens.css. */
:root{color-scheme:dark;--bg:#000;--panel:#0a0a0a;--surface:#121212;--elevated:#1c1c1c;--text:#f2f2f2;--muted:#929292;--faint:#737373;--border:rgb(255 255 255 / 12%);--border-strong:rgb(255 255 255 / 22%);--accent:#5b94f7;--accent-strong:#3d7cf0;--accent-soft:rgb(91 148 247 / 16%);--on-accent:#fff;--brand:linear-gradient(135deg,#3d7cf0 0%,#3d7cf0 55%,#d23a56 100%);--shadow:0 10px 30px rgb(0 4 20 / 55%);--radius:6px;--radius-lg:10px;--mono:"JetBrains Mono","Cascadia Code",Consolas,monospace}
@media (prefers-color-scheme:light){:root{color-scheme:light;--bg:#fff;--panel:#fff;--surface:#f7f7f7;--elevated:#efefef;--text:#000;--muted:#5c5c5c;--faint:#7a7a7a;--border:rgb(0 0 0 / 12%);--border-strong:rgb(0 0 0 / 22%);--accent:#2f6feb;--accent-strong:#2459d1;--accent-soft:rgb(47 111 235 / 12%);--shadow:0 8px 24px rgb(0 0 0 / 14%)}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px}
::selection{background:var(--accent-soft)}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.8 "Segoe UI Variable Text","Segoe UI","Yu Gothic UI","Meiryo UI","Malgun Gothic","Microsoft JhengHei UI","Microsoft YaHei UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.layout{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:100vh}

nav.toc{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:28px 18px 32px;background:var(--panel);border-right:1px solid var(--border);scrollbar-width:thin}
.brand{display:flex;align-items:center;gap:12px;margin:0 8px 4px}
.mark{font-size:34px;font-weight:700;line-height:1;background:var(--brand);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.brand strong{font-size:15px;font-weight:600;line-height:1.35}
.sub{margin:6px 8px 22px;color:var(--muted);font-size:12px;line-height:1.55}
nav.toc h2{margin:24px 8px 8px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);border:0;padding:0}
nav.toc ul{list-style:none;margin:0;padding:0}
nav.toc>ul>li{margin:1px 0}
nav.toc a{display:block;padding:5px 10px;border-radius:var(--radius);color:var(--muted);text-decoration:none;font-size:13px;line-height:1.5}
nav.toc a:hover{background:rgb(128 128 128 / 14%);color:var(--text)}
nav.toc>ul>li>a{display:flex;gap:10px;color:var(--text);font-weight:500}
nav.toc .no{flex:none;width:1.6em;color:var(--accent);font:600 11px/1.9 var(--mono)}
nav.toc ul ul{margin:0 0 6px 38px;border-left:1px solid var(--border)}
nav.toc ul ul a{padding:3px 10px;font-size:12px}
.langs ul{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px}
.langs a{padding:4px 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;color:var(--muted)}
.langs a.current{background:var(--accent-strong);border-color:var(--accent-strong);color:var(--on-accent)}
nav.toc a.brand{display:flex;align-items:center;gap:12px;margin:0 8px 4px;padding:0;color:var(--text)}
nav.toc a.brand:hover{background:none}
nav.toc h2 a.contents-link{display:inline;padding:0;color:inherit;font-size:inherit;letter-spacing:inherit;text-transform:inherit}
nav.toc h2 a.contents-link:hover{background:none;color:var(--text)}
nav.toc h2 a.contents-link.current{color:var(--accent)}
nav.toc li.open>a{background:var(--accent-soft)}
.contents{list-style:none;margin:0 0 48px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
.contents>li{margin:0;padding:16px 18px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--panel)}
.contents a.chapter-link{display:flex;gap:10px;color:var(--text);font-size:15px;font-weight:600;line-height:1.5;text-decoration:none}
.contents a.chapter-link:hover{color:var(--accent)}
.contents .no{flex:none;width:1.6em;color:var(--accent);font:600 12px/1.9 var(--mono)}
.contents ul{list-style:none;margin:8px 0 0 2.2em;padding:0}
.contents ul li{margin:0}
.contents ul a{display:block;padding:2px 0;color:var(--muted);font-size:13px;line-height:1.55;text-decoration:none}
.contents ul a:hover{color:var(--text)}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:48px;padding-top:24px;border-top:1px solid var(--border)}
.pager a{display:block;max-width:48%;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius-lg);color:var(--text);font-size:14px;line-height:1.5;text-decoration:none}
.pager a:hover{border-color:var(--accent)}
.pager .next{margin-left:auto;text-align:right}
.pager small{margin-right:4px;color:var(--accent);font:600 11px var(--mono)}

main{padding:0 clamp(20px,5vw,72px) 120px}
.page{max-width:880px;margin:0 auto;padding-top:40px}
.hero{padding:32px 0 40px;border-bottom:1px solid var(--border);margin-bottom:56px}
.hero .mark{font-size:64px;display:block;margin-bottom:12px}
.hero h1{font-size:clamp(28px,4vw,40px);font-weight:700;line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}
.hero p{margin:0;color:var(--muted);font-size:16px}

section.chapter{margin-bottom:72px;padding-bottom:8px}
.chapter-no{margin:0 0 6px;font:600 12px/1 var(--mono);letter-spacing:.14em;color:var(--accent)}
section.chapter>h1{position:relative;font-size:28px;font-weight:700;line-height:1.35;margin:0 0 28px;padding-bottom:18px}
section.chapter>h1::after{content:"";position:absolute;left:0;bottom:0;width:44px;height:3px;border-radius:2px;background:var(--accent)}
h2{font-size:21px;font-weight:650;line-height:1.4;margin:2.4em 0 .7em;padding-top:1.2em;border-top:1px solid var(--border)}
section.chapter>h2:first-of-type{margin-top:1em;padding-top:0;border-top:0}
h3{font-size:17px;font-weight:650;margin:2em 0 .5em}
h4{font-size:15px;font-weight:650;margin:1.6em 0 .4em;color:var(--muted)}
p,ul,ol{margin:.9em 0}
ul,ol{padding-left:1.5em}
li{margin:.35em 0}
li::marker{color:var(--faint)}
strong{font-weight:650}
code{padding:.12em .45em;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);font:.88em var(--mono)}
pre{margin:1.2em 0;padding:16px 18px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);overflow:auto}
pre code{padding:0;border:0;background:none}
hr{border:0;border-top:1px solid var(--border);margin:2.4em 0}

figure{margin:1.8em 0 2em;border:1px solid var(--border-strong);border-radius:var(--radius-lg);background:var(--panel);box-shadow:var(--shadow);overflow:hidden}
figure::before{content:"";display:block;height:30px;border-bottom:1px solid var(--border);background:radial-gradient(circle at 18px 15px,var(--border-strong) 4px,transparent 4.5px),radial-gradient(circle at 36px 15px,var(--border-strong) 4px,transparent 4.5px),radial-gradient(circle at 54px 15px,var(--border-strong) 4px,transparent 4.5px),var(--surface)}
figure img{display:block;width:100%;height:auto}
figcaption{padding:10px 16px;border-top:1px solid var(--border);color:var(--muted);font-size:12.5px;line-height:1.55}

aside.note{margin:1.6em 0;padding:4px 20px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 var(--radius-lg) var(--radius-lg) 0;background:var(--surface)}
aside.note p:first-child{margin-top:.8em}
aside.note p:last-child{margin-bottom:.8em}

.table-wrap{margin:1.6em 0;overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-lg)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:10px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border)}
th{background:var(--surface);color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.03em}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:rgb(128 128 128 / 6%)}

@media (max-width:900px){.layout{display:block}nav.toc{position:static;height:auto;border-right:0;border-bottom:1px solid var(--border)}.hero{padding-top:8px}}
@media print{:root{color-scheme:light;--bg:#fff;--panel:#fff;--surface:#f7f7f7;--text:#000;--muted:#444;--border:#ccc;--border-strong:#bbb;--shadow:none}nav.toc,.pager{display:none}.layout{display:block}main{padding:0}.hero{padding-top:0}figure,aside.note,.table-wrap{break-inside:avoid}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

const CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

/** The page file of a chapter: `03-canvas.md` -> `03-canvas.html`. */
export const chapterPage = (file) => file.replace(/\.md$/, '.html');

/** The language list of a page inside novira-data/work/manual/<locale>/: each link goes to the same page in that language (the file names are the same in every language). */
function languageLinks(locales, current, metas, page) {
  return `<ul>${locales
    .map((l) => `<li><a${l === current ? ' class="current" aria-current="true"' : ''} href="../${l}/${page}" hreflang="${l}" lang="${l}">${escapeHtml(metas[l]?.name ?? l)}</a></li>`)
    .join('')}</ul>`;
}

/** The left index: the contents link, every chapter, and the sections (## headings) of the chapter being read. */
function sideNav(meta, chapters, current, languages) {
  const items = chapters
    .map((c) => {
      const open = c.file === current;
      const subs = open ? c.headings.filter((h) => h.level === 2) : [];
      return `<li${open ? ' class="open"' : ''}><a href="${chapterPage(c.file)}"${open ? ' aria-current="page"' : ''}><span class="no">${chapterNumber(c.file)}</span><span>${escapeHtml(c.title)}</span></a>${
        subs.length ? `<ul>${subs.map((h) => `<li><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`).join('')}</ul>` : ''
      }</li>`;
    })
    .join('');
  return `<nav class="toc" aria-label="${escapeHtml(meta.contents)}">
<a class="brand" href="index.html"><span class="mark" aria-hidden="true">n</span><strong>${escapeHtml(meta.title)}</strong></a>
<p class="sub">${escapeHtml(meta.subtitle)}</p>
<h2><a class="contents-link${current === undefined ? ' current' : ''}" href="index.html">${escapeHtml(meta.contents)}</a></h2>
<ul>${items}</ul>
<h2>${escapeHtml(meta.language)}</h2>
<div class="langs">${languages}</div>
</nav>`;
}

function pageShell(locale, title, nav, body) {
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
${nav}
<main>
<div class="page">
${body}
</div>
</main>
</div>
</body>
</html>
`;
}

/**
 * Renders one language: the contents page (`index.html`) and one page per chapter (`NN-name.html`).
 * @returns {{ pages: Array<{ file: string, html: string }>, problems: string[], shots: string[] }}
 */
export function renderManual(locale, { source = MANUAL_SOURCE, locales = listLocales(), messages = loadMessages(locale) } = {}) {
  const problems = [];
  const meta = readMeta(locale, source);
  for (const key of META_KEYS) if (typeof meta[key] !== 'string' || !meta[key].trim()) problems.push(`${locale}/_meta.json: "${key}" is missing`);
  const metas = Object.fromEntries(locales.map((l) => [l, existsSync(join(source, l, '_meta.json')) ? readMeta(l, source) : undefined]));
  const files = listChapters(locale, source);
  const pending = PRIMARY_LOCALES.includes(locale) ? [] : (readPending(source)[locale] ?? []);
  if (files.length === 0) problems.push(`${locale}: no chapters (NN-name.md) in ${join(source, locale)}`);

  const chapters = files.map((file) => {
    // A chapter this language is behind with is shown in English, with a note, until it is translated.
    const behind = pending.includes(file);
    const rendered = renderMarkdown(readFileSync(join(source, behind ? 'en' : locale, file), 'utf8'), {
      message: (key) => messages[key],
      chapterId: (f) => (files.includes(f) ? chapterId(f) : undefined),
      // A link to another chapter goes to that chapter's page; a link inside the chapter stays on the page.
      chapterPage: (f) => (f === file ? '' : chapterPage(f)),
      idPrefix: chapterId(file),
    });
    for (const p of rendered.problems) problems.push(`${locale}/${file}: ${p}`);
    return { file, id: chapterId(file), behind, ...rendered };
  });

  // A chapter shown in English links to the headings of the other chapters by their English ids. A translated chapter has the
  // same headings in the same order (tests/manual.test.ts), so such a link goes to the heading at the same place there.
  const englishIds = new Map();
  const headingsOfEnglish = (file) => {
    if (!englishIds.has(file)) {
      const en = renderMarkdown(readFileSync(join(source, 'en', file), 'utf8'), { message: (key) => messages[key], chapterId, chapterPage, idPrefix: chapterId(file) });
      englishIds.set(file, en.headings.map((h) => h.id));
    }
    return englishIds.get(file);
  };
  for (const c of chapters) {
    if (!c.behind) continue;
    c.html = c.html.replace(/href="([^"#]+)#([^"]+)"/g, (whole, page, id) => {
      const target = chapters.find((o) => chapterPage(o.file) === page);
      if (!target || target.behind || target.headings.some((h) => h.id === id)) return whole;
      const at = headingsOfEnglish(target.file).indexOf(id);
      const local = at >= 0 ? target.headings[at]?.id : undefined;
      return local ? `href="${page}#${local}"` : whole;
    });
  }

  // A link to a heading must reach one: the ids are built from each language's own headings, so a translation can break a link the source has.
  const headingIds = new Map(chapters.map((c) => [chapterPage(c.file), new Set(c.headings.map((h) => h.id))]));
  for (const c of chapters) {
    for (const m of c.html.matchAll(/href="([^"#]*)#([^"]+)"/g)) {
      const page = m[1] || chapterPage(c.file);
      if (!headingIds.get(page)?.has(m[2])) problems.push(`${locale}/${c.file}: link to a heading that does not exist: ${m[1]}#${m[2]}`);
    }
  }

  const pages = chapters.map((c, i) => {
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    const pager = `<nav class="pager" aria-label="${escapeHtml(meta.contents)}">${
      prev ? `<a class="prev" href="${chapterPage(prev.file)}" rel="prev"><small>${chapterNumber(prev.file)}</small> ${escapeHtml(prev.title)}</a>` : '<span></span>'
    }${next ? `<a class="next" href="${chapterPage(next.file)}" rel="next"><small>${chapterNumber(next.file)}</small> ${escapeHtml(next.title)}</a>` : '<span></span>'}</nav>`;
    const note = c.behind ? '<aside class="note" lang="en"><p>This chapter has not been translated into this language yet. The English version is shown.</p></aside>\n' : '';
    const body = `<section class="chapter"${c.behind ? ' lang="en"' : ''}>\n<p class="chapter-no" aria-hidden="true">${chapterNumber(c.file)}</p>\n${note}${c.html}\n</section>\n${pager}`;
    return {
      file: chapterPage(c.file),
      html: pageShell(locale, `${c.title} - ${meta.title}`, sideNav(meta, chapters, c.file, languageLinks(locales, locale, metas, chapterPage(c.file))), body),
    };
  });

  const contents = chapters
    .map((c) => {
      const subs = c.headings.filter((h) => h.level === 2);
      return `<li><a class="chapter-link" href="${chapterPage(c.file)}"><span class="no">${chapterNumber(c.file)}</span><span>${escapeHtml(c.title)}</span></a>${
        subs.length ? `<ul>${subs.map((h) => `<li><a href="${chapterPage(c.file)}#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`).join('')}</ul>` : ''
      }</li>`;
    })
    .join('');
  const cover = `<header class="hero">
<span class="mark" aria-hidden="true">n</span>
<h1>${escapeHtml(meta.title)}</h1>
<p>${escapeHtml(meta.subtitle)}</p>
</header>
<ol class="contents">${contents}</ol>`;
  pages.unshift({
    file: 'index.html',
    html: pageShell(locale, meta.title, sideNav(meta, chapters, undefined, languageLinks(locales, locale, metas, 'index.html')), cover),
  });
  return { pages, problems, shots: chapters.flatMap((c) => c.shots) };
}

/** The page at novira-data/work/manual/index.html: the list of languages. */
function renderIndex(locales, source) {
  const metas = Object.fromEntries(locales.map((l) => [l, existsSync(join(source, l, '_meta.json')) ? readMeta(l, source) : { name: l, title: l }]));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>novira</title>
<style>${CSS}main{margin:0 auto;padding-top:14vh;max-width:520px}ul{list-style:none;padding:0}li a{display:block;padding:14px 18px;margin:8px 0;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--panel);color:var(--text);text-decoration:none;font-size:1.05rem}li a:hover{border-color:var(--accent)}li a small{color:var(--muted);margin-left:8px}</style>
</head>
<body>
<main>
<span class="mark" style="font-size:56px;display:block" aria-hidden="true">n</span>
<h1 style="margin:8px 0 20px;font-size:32px">novira</h1>
<ul>${locales.map((l) => `<li><a href="${l}/index.html" hreflang="${l}" lang="${l}">${escapeHtml(metas[l].name)} <small>${escapeHtml(metas[l].title)}</small></a></li>`).join('')}</ul>
</main>
</body>
</html>
`;
}

/** Writes the pages. Returns the problems found (broken links, unknown UI words, pictures not taken yet). */
export function buildManual({ locales = listLocales(), source = MANUAL_SOURCE, out = MANUAL_OUT, allowMissingImages = false } = {}) {
  const problems = [];
  const all = listLocales();
  for (const locale of locales) {
    const rendered = renderManual(locale, { source, locales: all });
    problems.push(...rendered.problems);
    const dir = join(out, locale);
    mkdirSync(join(dir, 'images'), { recursive: true });
    if (!allowMissingImages) {
      for (const id of new Set(rendered.shots)) {
        if (!existsSync(join(dir, 'images', `${id}.png`))) problems.push(`${locale}: picture ${id}.png has not been taken (run scripts\\manual.bat shots)`);
      }
    }
    for (const page of rendered.pages) writeFileSync(join(dir, page.file), page.html);
  }
  writeFileSync(join(out, 'index.html'), renderIndex(all, source));
  return problems;
}

// --- screenshots ----------------------------------------------------------------------------------------------------------

const FIXED_TIME = new Date('2026-01-15T10:00:00+09:00');
const SIZE = { width: 1440, height: 900 };

/** The helpers a scene gets (see manual/scenes.mjs). */
function makeContext(page, locale, messages, target) {
  let taken = 0;
  const ctx = {
    page,
    locale,
    /** The text of a message key in this language, with `{name}` filled in. */
    msg: (key, vars = {}) => {
      const text = messages[key];
      if (text === undefined) throw new Error(`unknown message key ${key}`);
      return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
    },
    testid: (id) => page.getByTestId(id),
    /** The open dialog (the topmost one). */
    dialog: () => page.getByRole('dialog').last(),
    /** An item of the open menu, found by the message that labels it. */
    menuItem: (key, vars) => page.getByRole('menuitem', { name: ctx.msg(key, vars) }),
    /** Hides what exists only in the mock (a setting row, a note): the closest block around the element that shows this text. */
    async hideText(text, block = '.st-row, [role="status"], [class*="note"]') {
      await page.evaluate(([wanted, selector]) => {
        const leaf = Array.from(document.querySelectorAll('*')).find((el) => el.children.length === 0 && el.textContent?.trim() === wanted);
        const target = leaf?.closest(selector) ?? leaf;
        if (target instanceof HTMLElement) target.style.display = 'none';
      }, [text, block]);
    },
    /** Waits until nothing is moving: toasts closed, fonts and pictures loaded, the pointer away from tooltips. */
    async settle() {
      await page.locator('.toast__close').evaluateAll((buttons) => buttons.forEach((b) => b.click()));
      await page.mouse.move(0, 0);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).filter((img) => img.src).map((img) => img.decode().catch(() => undefined)));
      });
      await page.waitForTimeout(250);
    },
    /** Saves the picture of the scene: the whole window, or only the given element (a dialog, a panel). */
    async shot(element) {
      taken++;
      if (taken > 1) throw new Error('a scene takes one picture');
      await ctx.settle();
      const options = { path: target, animations: 'disabled', caret: 'hide' };
      await (element ? element.screenshot(options) : page.screenshot(options));
    },
    /** Makes pictures from the Generate form and waits until they are in the gallery and the queue is idle. */
    async generate(prompt, count = 1) {
      const thumbs = page.getByTestId('gallery-thumb');
      const before = await thumbs.count();
      await page.getByTestId('seed-fixed').click();
      await page.getByTestId('positive-prompt').fill(prompt);
      for (let i = 0; i < count; i++) {
        await page.getByTestId('invoke-button').click();
        await page.waitForFunction(
          ([n]) => document.querySelectorAll('[data-testid="gallery-thumb"]').length >= n,
          [before + i + 1],
          { timeout: 30_000 },
        );
      }
      await page.getByTestId('gallery-generating').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined);
    },
    /** Opens a tab of the side navigation. */
    async tab(name) {
      // The comic is a mode of the Generate entry: open the entry, then the comic icon of its media row.
      if (name === 'comic') {
        await page.getByTestId('tab-generate').click();
        await page.getByTestId('media-comic').click();
        return;
      }
      await page.getByTestId(`tab-${name}`).click();
    },
  };
  return ctx;
}

async function runLocale(browser, baseUrl, locale, scenes, theme, failures) {
  const messages = loadMessages(locale);
  const dir = join(MANUAL_OUT, locale, 'images');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, locale, timezoneId: 'Asia/Tokyo', colorScheme: theme });
  await context.addInitScript(
    ([language, themeName]) => {
      localStorage.setItem('novira.settings', JSON.stringify({ state: { language, theme: themeName, showDevLog: false }, version: 0 }));
    },
    [locale, theme],
  );
  for (const scene of scenes) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    try {
      await page.clock.setFixedTime(FIXED_TIME);
      if (scene.settings) {
        // Settings of this scene only, merged over the saved ones before the app reads them.
        await page.addInitScript((patch) => {
          const saved = JSON.parse(localStorage.getItem('novira.settings') ?? '{}');
          localStorage.setItem('novira.settings', JSON.stringify({ ...saved, state: { ...saved.state, ...patch } }));
        }, scene.settings);
      }
      await page.goto(`${baseUrl}${scene.query ?? ''}`);
      await page.waitForSelector('.app', { timeout: 20_000 });
      await page.getByTestId('splash').waitFor({ state: 'detached', timeout: 20_000 });
      await page.addStyleTag({ content: '.sidenav__mock{display:none !important}' });
      await scene.run(makeContext(page, locale, messages, join(dir, `${scene.id}.png`)));
      if (errors.length) console.warn(`[${locale}] ${scene.id}: console errors: ${errors.slice(0, 2).join(' | ')}`);
      console.log(`[${locale}] ${scene.id}`);
    } catch (error) {
      failures.push(`${locale}/${scene.id}: ${String(error.message).split('\n')[0]}`);
      console.error(`[${locale}] ${scene.id} FAILED: ${String(error.message).split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
  await context.close();
}

const FRONTEND = resolve(HERE, '..');

/** Takes the pictures. Returns the failures ("<language>/<scene>: reason"). */
export async function takeShots({ locales = listLocales(), scenes = SCENES, theme = 'dark' } = {}) {
  const { chromium } = await import('@playwright/test');
  const { createServer } = await import('vite');
  const { acquire } = await import('../../tools/e2e-lock.mjs');
  // A heavy browser run: one at a time with the other Playwright runs (the layout scan wants port 5191 to itself, too).
  const releaseLock = await acquire({ what: 'manual shots' });
  const server = await createServer({ root: FRONTEND, logLevel: 'error', server: { port: 5191, strictPort: false } });
  await server.listen();
  const baseUrl = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  const failures = [];
  try {
    await Promise.all(locales.map((locale) => runLocale(browser, baseUrl, locale, scenes, theme, failures)));
  } finally {
    await browser.close();
    await server.close();
    releaseLock();
  }
  return failures;
}

async function main() {
  const args = process.argv.slice(2);
  const command = ['all', 'shots', 'build'].includes(args[0] ?? '') ? args[0] : 'all';
  const option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes('--list')) {
    for (const s of SCENES) console.log(s.id);
    return;
  }
  const all = listLocales();
  const locales = option('--locale')?.split(',') ?? all;
  for (const l of locales) if (!all.includes(l)) throw new Error(`unknown language ${l} (have ${all.join(', ')})`);

  let failed = false;
  if (command !== 'build') {
    const wanted = option('--scene')?.split(',');
    for (const id of wanted ?? []) if (!SCENES.some((s) => s.id === id)) throw new Error(`unknown scene ${id}`);
    const scenes = wanted ? SCENES.filter((s) => wanted.includes(s.id)) : SCENES;
    const failures = await takeShots({ locales, scenes, theme: option('--theme') ?? 'dark' });
    console.log(`manual shots: ${scenes.length * locales.length - failures.length} taken, ${failures.length} failed -> ${MANUAL_OUT}`);
    for (const f of failures) console.error(`  ${f}`);
    failed = failures.length > 0;
    if (failed) process.exitCode = 1;
  }
  if (command !== 'shots' && !failed) {
    const problems = buildManual({ locales, allowMissingImages: args.includes('--allow-missing-images') });
    for (const p of problems) console.error(`manual: ${p}`);
    console.log(`manual: built ${join(MANUAL_OUT, 'index.html')}${problems.length ? ` with ${problems.length} problem(s)` : ''}`);
    process.exitCode = problems.length ? 1 : 0;
    const open = command === 'all' ? !args.includes('--no-open') : args.includes('--open');
    if (open && !problems.length) {
      // Explorer hands the local page to the default browser (no shell string is built).
      const { spawn } = await import('node:child_process');
      spawn('explorer.exe', [join(MANUAL_OUT, 'index.html')], { stdio: 'ignore', detached: true }).unref();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
