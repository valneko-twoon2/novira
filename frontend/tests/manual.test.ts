// The user manual (docs/manual/<language>/*.md): the renderer, and the rules that keep every language complete and in step with the
// screenshot scenes (scripts/manual/scenes.mjs).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM scripts without types
import { escapeHtml, renderMarkdown, slugify } from '../scripts/manual/markdown.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { SCENES } from '../scripts/manual/scenes.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { chapterId, chapterPage, listChapters, listLocales, loadMessages, MANUAL_SOURCE, META_KEYS, PRIMARY_LOCALES, readPending, renderManual } from '../scripts/manual.mjs';

interface Rendered {
  html: string;
  title: string;
  headings: Array<{ level: number; text: string; id: string }>;
  shots: string[];
  problems: string[];
}
const render = (source: string, options: Record<string, unknown> = {}): Rendered => renderMarkdown(source, options);

describe('the Markdown renderer', () => {
  it('renders headings with anchors, emphasis, code and lists', () => {
    const r = render('# Title\n\nSome **bold** and *soft* and `code`.\n\n- one\n  - nested\n- two\n\n1. first\n2. second\n\n## Part two\n');
    expect(r.title).toBe('Title');
    expect(r.html).toContain('<strong>bold</strong>');
    expect(r.html).toContain('<em>soft</em>');
    expect(r.html).toContain('<code>code</code>');
    expect(r.html).toContain('<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>');
    expect(r.html).toContain('<ol><li>first</li><li>second</li></ol>');
    expect(r.headings.map((h) => [h.level, h.id])).toEqual([
      [1, 'title'],
      [2, 'part-two'],
    ]);
    expect(r.problems).toEqual([]);
  });

  it('keeps heading ids unique across chapters with a prefix, and links to them', () => {
    const r = render('# One\n\n## Same\n\n## Same\n\n[back](#same) [other](02-two.md#deep) [chapter](02-two.md)', {
      idPrefix: 'ch-01',
      chapterId: (f: string) => (f === '02-two.md' ? 'ch-02' : undefined),
    });
    expect(r.headings.map((h) => h.id)).toEqual(['ch-01', 'ch-01--same', 'ch-01--same-2']);
    expect(r.html).toContain('href="#ch-01--same"');
    expect(r.html).toContain('href="#ch-02--deep"');
    expect(r.html).toContain('href="#ch-02"');
  });

  it('links to another chapter through the page of that chapter, and stays on the page for its own headings', () => {
    const r = render('# One\n\n## Same\n\n[back](#same) [own](01-one.md#same) [other](02-two.md#deep) [chapter](02-two.md)', {
      idPrefix: 'ch-01',
      chapterId: (f: string) => (f === '02-two.md' ? 'ch-02' : f === '01-one.md' ? 'ch-01' : undefined),
      chapterPage: (f: string) => (f === '01-one.md' ? '' : f.replace(/\.md$/, '.html')),
    });
    expect(r.html).toContain('href="#ch-01--same"');
    expect(r.html).toContain('href="02-two.html#ch-02--deep"');
    expect(r.html).toContain('href="02-two.html"');
    expect(r.html).not.toContain('href="01-one.html');
  });

  it('makes heading ids from the words, so an apostrophe is a separator and links inside a quote keep the chapter prefix', () => {
    const source = ['# One', '', "## Remove the l'arrière-plan", '', '> see [it](#remove-the-l-arrière-plan)', ''].join('\n');
    const r = render(source, { idPrefix: 'ch-01' });
    expect(r.headings.map((h) => h.id)).toEqual(['ch-01', 'ch-01--remove-the-l-arrière-plan']);
    expect(r.html).toContain('href="#ch-01--remove-the-l-arrière-plan"');
  });

  it("gives the title and the heading texts as plain words, so a page escapes them once (no &amp;#39; in the contents)", () => {
    const r = render("# Découvrir l'écran\n\n## Drag & Drop <now>\n");
    expect(r.title).toBe("Découvrir l'écran");
    expect(r.headings.map((h) => h.text)).toEqual(["Découvrir l'écran", 'Drag & Drop <now>']);
    expect(r.html).toContain('<h2 id="drag-drop-now">Drag &amp; Drop &lt;now&gt;</h2>');
    expect(escapeHtml(r.title)).toBe('Découvrir l&#39;écran');
  });

  it('renders tables, notes and a picture on its own line as a figure', () => {
    const r = render('# T\n\n| a | b |\n|---|---|\n| 1 | `x\\|y` |\n\n> **Tip** careful\n\n![The generate tab](shot:generate)\n');
    expect(r.html).toContain('<th>a</th><th>b</th>');
    expect(r.html).toContain('<td><code>x|y</code></td>');
    expect(r.html).toContain('<aside class="note">');
    expect(r.html).toContain('<figure><img src="images/generate.png" alt="The generate tab" loading="lazy"><figcaption>The generate tab</figcaption></figure>');
    expect(r.shots).toEqual(['generate']);
  });

  it('does not let anything from the source into the page unescaped', () => {
    const r = render('# <b>T</b>\n\n<script>alert(1)</script> & "quotes"\n\n[x](javascript:alert(1))\n\n![a](https://example.com/p.png)\n\n```\n<div>\n```\n');
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('<b>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('&amp; &quot;quotes&quot;');
    expect(r.html).toContain('&lt;div&gt;');
    expect(r.html).not.toContain('href="javascript');
    expect(r.html).not.toContain('https://example.com/p.png');
    expect(r.problems.join('\n')).toMatch(/link not allowed/);
    expect(r.problems.join('\n')).toMatch(/picture not allowed/);
  });

  it('opens outside links safely and refuses a link to a missing chapter', () => {
    const r = render('# T\n\n[site](https://example.com/a?b=1&c=2) [gone](09-missing.md)', { chapterId: () => undefined });
    expect(r.html).toContain('href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer"');
    expect(r.problems.join('\n')).toMatch(/chapter that does not exist/);
  });

  it('puts the words of the screen in with {{ui:key}} and reports unknown keys and placeholders', () => {
    const message = (key: string) => ({ 'a.b': 'Generate', 'a.n': '{count} items' })[key];
    expect(render('# T\n\nPress **{{ui:a.b}}**.', { message }).html).toContain('<strong>Generate</strong>');
    expect(render('# T\n\n{{ui:no.key}}', { message }).problems.join()).toMatch(/unknown UI message key/);
    expect(render('# T\n\n{{ui:a.n}}', { message }).problems.join()).toMatch(/placeholders/);
  });

  it('needs a title, a picture description, and joins wrapped lines without a gap between wide characters', () => {
    expect(render('no title here').problems.join()).toMatch(/no "# " title/);
    expect(render('# T\n\n![](shot:generate)').problems.join()).toMatch(/no description/);
    expect(render('# T\n\n日本語の\n文章です\nand english\nwords').html).toContain('<p>日本語の文章です and english words</p>');
  });

  it('slugs keep letters of every script', () => {
    expect(slugify('Make a Picture!')).toBe('make-a-picture');
    expect(slugify('画像を作る')).toBe('画像を作る');
    expect(slugify('???')).toBe('section');
    expect(escapeHtml('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});

describe('the manual of every language', () => {
  const locales: string[] = listLocales();
  const ja: string[] = listChapters('ja');
  const read = (locale: string, file: string): string => readFileSync(join(MANUAL_SOURCE, locale, file), 'utf8');
  const sceneIds: string[] = SCENES.map((s: { id: string }) => s.id);

  /** The shape of a chapter: its blocks, with the counts that a translation must keep (rows, items, pictures). */
  const skeleton = (source: string): string[] => {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let fence = false;
    for (const line of lines) {
      if (/^```/.test(line)) {
        fence = !fence;
        out.push('code');
      } else if (fence) continue;
      else if (/^#{1,4}\s/.test(line)) out.push(`h${(/^#+/.exec(line) as RegExpExecArray)[0].length}`);
      else if (/^\|/.test(line)) out.push('row');
      else if (/^\s*([-*]|\d+\.)\s/.test(line)) out.push(`li${/^\s*/.exec(line)![0].length}`);
      else if (/^>/.test(line)) out.push('quote');
      else if (/^!\[.*\]\(shot:[\w-]+\)\s*$/.test(line)) out.push(`pic:${/shot:([\w-]+)/.exec(line)![1]}`);
      else if (/^---+\s*$/.test(line)) out.push('rule');
      else if (line.trim() !== '') out.push('p');
    }
    // A run of paragraph lines is one paragraph: translations may wrap differently.
    return out.filter((item, i) => !(item === 'p' && out[i - 1] === 'p'));
  };

  it('has a folder for every language of the app, and for no other', () => {
    const folders = readdirSync(MANUAL_SOURCE, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(folders, 'add docs/manual/<language>/ when a language is added (see .claude/rules/i18n.md)').toEqual([...locales].sort());
  });

  it('has the same chapter files in every language', () => {
    expect(ja.length).toBeGreaterThan(0);
    for (const locale of locales) expect(listChapters(locale), locale).toEqual(ja);
  });

  it('has the words of the page in every language', () => {
    for (const locale of locales) {
      const meta = JSON.parse(readFileSync(join(MANUAL_SOURCE, locale, '_meta.json'), 'utf8')) as Record<string, string>;
      expect(Object.keys(meta).sort(), locale).toEqual([...META_KEYS].sort());
      for (const key of META_KEYS) expect(meta[key]?.trim(), `${locale} ${key}`).toBeTruthy();
    }
  });

  it('renders every chapter without problems (links, UI words, pictures)', () => {
    for (const locale of locales) {
      const page = renderManual(locale, { locales, messages: loadMessages(locale) }) as { problems: string[] };
      expect(page.problems, locale).toEqual([]);
    }
  });

  it('makes a contents page and one page per chapter, each with the index of the chapters on the left', () => {
    const page = renderManual('ja', { locales, messages: loadMessages('ja') }) as { pages: Array<{ file: string; html: string }> };
    expect(page.pages.map((p) => p.file)).toEqual(['index.html', ...ja.map((f) => chapterPage(f))]);
    for (const p of page.pages) {
      for (const f of ja) expect(p.html, `${p.file} lists ${f}`).toContain(`href="${chapterPage(f)}"`);
    }
  });

  it('opens only the sections of the chapter being read in the index, and keeps the language on the same page', () => {
    const { pages } = renderManual('ja', { locales, messages: loadMessages('ja') }) as { pages: Array<{ file: string; html: string }> };
    const second = pages.find((p) => p.file === chapterPage(ja[1] as string)) as { html: string };
    const nav = /<nav class="toc"[\s\S]*?<\/nav>/.exec(second.html)![0];
    expect(nav).toContain('aria-current="page"');
    expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
    expect(nav).toContain(`href="../en/${chapterPage(ja[1] as string)}"`);
    // The sections listed on the left are the ## headings of this chapter only.
    const sections = (read('ja', ja[1] as string).match(/^## .+$/gm) ?? []).length;
    // Only the open chapter has links to a heading (the others link to their own pages).
    expect((nav.match(/href="#/g) ?? []).length).toBe(sections);
  });

  it('keeps the shape of the Japanese chapters in every translation that is up to date', () => {
    const pending = readPending() as Record<string, string[]>;
    for (const file of ja) {
      const expected = skeleton(read('ja', file));
      for (const locale of locales.filter((l) => l !== 'ja')) {
        if ((pending[locale] ?? []).includes(file)) continue;
        expect(skeleton(read(locale, file)), `${locale}/${file} must have the structure of ja/${file}`).toEqual(expected);
      }
    }
  });

  it('lists as pending only chapters of the other languages that exist, and none of ja or en', () => {
    const pending = readPending() as Record<string, string[]>;
    for (const [locale, files] of Object.entries(pending)) {
      expect(locales, `pending.json names the language ${locale}`).toContain(locale);
      expect(PRIMARY_LOCALES, `${locale} is always kept up to date`).not.toContain(locale);
      for (const file of files) expect(listChapters(locale), `pending.json: ${locale}/${file} does not exist`).toContain(file);
    }
  });

  it('shows the English chapter, with a note, for a chapter a language is behind with', () => {
    const file = ja[0] as string;
    const source = mkdtempSync(join(tmpdir(), 'novira-manual-'));
    for (const l of ['ja', 'en', 'ko']) {
      mkdirSync(join(source, l));
      for (const f of ['_meta.json']) writeFileSync(join(source, l, f), JSON.stringify(Object.fromEntries(META_KEYS.map((k: string) => [k, `${l} ${k}`]))));
      writeFileSync(join(source, l, file), `# ${l} title\n\nbody of ${l}\n`);
    }
    writeFileSync(join(source, 'pending.json'), JSON.stringify({ ko: [file] }));
    const page = renderManual('ko', { source, locales: ['ja', 'en', 'ko'], messages: {} }) as { pages: Array<{ file: string; html: string }>; problems: string[] };
    const chapter = page.pages.find((p) => p.file === chapterPage(file))!.html;
    expect(chapter).toContain('body of en');
    expect(chapter).not.toContain('body of ko');
    expect(chapter).toContain('lang="en"');
    expect(page.problems).toEqual([]);
    writeFileSync(join(source, 'pending.json'), '{}');
    const own = renderManual('ko', { source, locales: ['ja', 'en', 'ko'], messages: {} }) as { pages: Array<{ file: string; html: string }> };
    expect(own.pages.find((p) => p.file === chapterPage(file))!.html).toContain('body of ko');
  });

  it('sends a link of an English chapter to the heading at the same place in a translated chapter', () => {
    const source = mkdtempSync(join(tmpdir(), 'novira-manual-'));
    const texts: Record<string, [string, string]> = {
      ja: ['# 一\n\n本文\n', '# 二\n\n## ポーズを作る\n\n本文\n'],
      en: ['# One\n\nSee [the pose](02-two.md#making-a-pose).\n', '# Two\n\n## Making a pose\n\nBody\n'],
      ko: ['# 하나\n\n본문\n', '# 둘\n\n## 포즈 만들기\n\n본문\n'],
    };
    for (const [l, [one, two]] of Object.entries(texts)) {
      mkdirSync(join(source, l));
      writeFileSync(join(source, l, '_meta.json'), JSON.stringify(Object.fromEntries(META_KEYS.map((k: string) => [k, `${l} ${k}`]))));
      writeFileSync(join(source, l, '01-one.md'), one);
      writeFileSync(join(source, l, '02-two.md'), two);
    }
    writeFileSync(join(source, 'pending.json'), JSON.stringify({ ko: ['01-one.md'] }));
    const page = renderManual('ko', { source, locales: ['ja', 'en', 'ko'], messages: {} }) as { pages: Array<{ file: string; html: string }>; problems: string[] };
    expect(page.problems).toEqual([]);
    const link = /href="02-two\.html#([^"]+)"/.exec(page.pages.find((p) => p.file === chapterPage('01-one.md'))!.html)?.[1];
    expect(page.pages.find((p) => p.file === chapterPage('02-two.md'))!.html).toContain(`id="${link}"`);
  });

  it('shows only scenes that exist, and every scene is shown', () => {
    const used = new Set<string>();
    for (const file of ja) for (const m of read('ja', file).matchAll(/\(shot:([\w-]+)\)/g)) used.add(m[1] as string);
    expect([...used].filter((id) => !sceneIds.includes(id)), 'a chapter shows a scene that scripts/manual/scenes.mjs does not have').toEqual([]);
    expect(sceneIds.filter((id) => !used.has(id)), 'a scene is taken but no chapter shows it (delete it or show it)').toEqual([]);
  });

  it('has scenes with unique ids that can be run', () => {
    expect(new Set(sceneIds).size).toBe(sceneIds.length);
    for (const scene of SCENES as Array<{ id: string; run: unknown }>) {
      expect(scene.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(typeof scene.run).toBe('function');
    }
  });

  it('uses valid chapter ids and an existing source folder', () => {
    expect(existsSync(MANUAL_SOURCE)).toBe(true);
    expect(chapterId('03-canvas.md')).toBe('ch-03-canvas');
    expect(chapterPage('03-canvas.md')).toBe('03-canvas.html');
  });
});
