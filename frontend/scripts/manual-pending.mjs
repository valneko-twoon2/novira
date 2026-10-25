// Keeps track of the manual chapters that the languages other than ja and en have not caught up with. A chapter listed in
// docs/manual/pending.json is shown in English in that language (with a note) and is not checked against the shape of ja,
// so a manual change needs only ja and en, and the other languages are translated later in one batch.
//   node frontend/scripts/manual-pending.mjs add             list every changed ja/en chapter (git status) as pending in the other languages
//   node frontend/scripts/manual-pending.mjs add 12-comic.md the same for the named chapters
//   node frontend/scripts/manual-pending.mjs clear ko 12-comic.md   a translation is done (several chapters, or "all" for the language)
//   node frontend/scripts/manual-pending.mjs list
// A chapter file a language does not have yet is created there as a copy of the English one.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listChapters, listLocales, MANUAL_SOURCE, PRIMARY_LOCALES, readPending } from './manual.mjs';
import { CHAPTER_NAME } from './locales.mjs';

/** The pending list after `chapters` changed in ja or en: every other language that did not change them itself is behind. */
export function markPending(pending, chapters, followers, changedIn = {}) {
  const out = Object.fromEntries(Object.entries(pending).map(([l, files]) => [l, [...files]]));
  for (const locale of followers) {
    for (const file of chapters) {
      if (changedIn[locale]?.includes(file)) continue;
      const list = (out[locale] ??= []);
      if (!list.includes(file)) list.push(file);
    }
  }
  return sorted(out);
}

/** The pending list without the chapters a translation has caught up with. */
export function clearPending(pending, locale, chapters) {
  const out = Object.fromEntries(Object.entries(pending).map(([l, files]) => [l, [...files]]));
  const drop = (l) => (out[l] = (out[l] ?? []).filter((f) => !chapters.includes(f)));
  if (locale === 'all') Object.keys(out).forEach(drop);
  else drop(locale);
  return sorted(out);
}

function sorted(pending) {
  return Object.fromEntries(
    Object.keys(pending)
      .sort()
      .filter((l) => pending[l].length > 0)
      .map((l) => [l, [...pending[l]].sort()]),
  );
}

/** Chapter files changed in the working tree (modified, added or untracked), per language folder. */
function changedChapters() {
  const out = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', 'docs/manual'], { cwd: resolve(MANUAL_SOURCE, '..', '..'), encoding: 'utf8' });
  const byLocale = {};
  for (const entry of out.split('\0').filter(Boolean)) {
    const m = new RegExp(`^.. docs/manual/([^/]+)/(${CHAPTER_NAME})$`).exec(entry);
    if (m && !entry.startsWith(' D') && !entry.startsWith('D')) (byLocale[m[1]] ??= []).push(m[2]);
  }
  return byLocale;
}

function write(pending) {
  writeFileSync(join(MANUAL_SOURCE, 'pending.json'), `${JSON.stringify(pending, null, 2)}\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const followers = listLocales().filter((l) => !PRIMARY_LOCALES.includes(l));
  const pending = readPending();
  if (command === 'add') {
    const changedIn = changedChapters();
    const chapters = rest.length ? rest : [...new Set(PRIMARY_LOCALES.flatMap((l) => changedIn[l] ?? []))];
    for (const locale of followers) {
      for (const file of chapters) {
        const target = join(MANUAL_SOURCE, locale, file);
        if (!existsSync(target) && existsSync(join(MANUAL_SOURCE, 'en', file))) copyFileSync(join(MANUAL_SOURCE, 'en', file), target);
      }
    }
    write(markPending(pending, chapters, followers, changedIn));
    console.log(`manual-pending: ${chapters.length} chapter(s) marked as behind in ${followers.length} language(s).`);
  } else if (command === 'clear' && rest.length >= 1) {
    const [locale, ...files] = rest;
    write(clearPending(pending, locale, files.length ? files : listChapters('ja')));
    console.log(`manual-pending: cleared for ${locale}.`);
  } else if (command === 'list') {
    const entries = Object.entries(pending);
    if (!entries.length) console.log('manual-pending: no language is behind.');
    for (const [locale, files] of entries) console.log(`${locale}: ${files.join(', ')}`);
  } else {
    console.error('usage: node frontend/scripts/manual-pending.mjs add [chapter...] | clear <language|all> [chapter...] | list');
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
