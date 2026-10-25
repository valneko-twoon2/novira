// Keeps the languages in step: when a staged change adds, removes or rewrites a message in ja or en, the same key must
// change in the other one of the two in the same commit; the other languages may leave a new message for later (they
// show the English text), but a text they already had for a changed message must be updated or removed. Run by the
// pre-commit hook; by hand:
//   node scripts/check-i18n-sync.mjs            (staged changes)
// A deliberate one-language fix (a typo in ja only) passes with NOVIRA_I18N_SINGLE_LOCALE=1 set for that commit.
// A locale added in the commit (no catalog at HEAD) is skipped: nothing in it can be out of date yet.
// Limits: compares key by key between the staged and the HEAD version; a change that rewrites the other locales'
// text to the same words it had before is not seen.
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readBlobs } from './git-blobs.mjs';
import { PRIMARY_LOCALES } from './locales.mjs';

const DIR = 'frontend/src/i18n/locales/';
/** The languages that always hold every message (see PRIMARY_LOCALES in src/i18n/catalog.ts). */
const PRIMARY = PRIMARY_LOCALES;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** A catalog read through `read` (a spec to its text, or null), or {} when there is none or it does not parse. */
function readJson(read, spec) {
  try {
    return JSON.parse(read(spec) ?? '{}');
  } catch {
    return {};
  }
}

/** The product name is spelled novira in every language, so fixing only its capitals is not a change of meaning. */
const spell = (text) => (typeof text === 'string' ? text.replace(/novira/g, 'novira') : text);

/** Keys whose text was added, removed or changed between two versions of a catalog. */
export function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => spell(before[k]) !== spell(after[k]));
}

/**
 * The keys a locale should have changed and did not. ja and en must change the same keys. Another language may lack a
 * new message (it shows the English text until it is translated), but a text it already had for a message that ja or en
 * changed or removed is out of date, so it must change too (i18n-add.mjs --replace removes it). `had` holds, per locale,
 * the keys it had at HEAD. Newly added locales are left out.
 */
export function unsyncedKeys(changesByLocale, newLocales = [], had = {}) {
  const locales = Object.keys(changesByLocale).filter((l) => !newLocales.includes(l));
  const primary = locales.filter((l) => PRIMARY.includes(l));
  const out = {};
  for (const locale of locales) {
    const mine = new Set(changesByLocale[locale]);
    const source = PRIMARY.includes(locale)
      ? primary.filter((l) => l !== locale).flatMap((l) => changesByLocale[l])
      : primary.flatMap((l) => changesByLocale[l]).filter((k) => had[locale]?.has(k));
    const missing = [...new Set(source)].filter((k) => !mine.has(k)).sort();
    if (missing.length) out[locale] = missing;
  }
  return out;
}

function main() {
  const root = git(['rev-parse', '--show-toplevel']).trim();
  process.chdir(root);
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z', '--', DIR]).split('\0').filter(Boolean);
  if (!staged.length) return 0;
  const locales = git(['ls-files', DIR])
    .split('\n')
    .filter(Boolean)
    .map((p) => p.slice(DIR.length).split('/')[0])
    .filter((v, i, a) => v && a.indexOf(v) === i);
  const areas = [...new Set(staged.map((p) => p.slice(DIR.length).split('/')[1]))];
  const changes = Object.fromEntries(locales.map((l) => [l, []]));
  const had = Object.fromEntries(locales.map((l) => [l, new Set()]));
  // Every version needed, read in one git process.
  const paths = areas.flatMap((area) => locales.map((locale) => `${DIR}${locale}/${area}`));
  const blobs = readBlobs(paths.flatMap((p) => [`HEAD:${p}`, `:${p}`]));
  const read = (spec) => blobs.get(spec) ?? null;
  for (const area of areas) {
    for (const locale of locales) {
      const path = `${DIR}${locale}/${area}`;
      const before = readJson(read, `HEAD:${path}`);
      changes[locale].push(...changedKeys(before, readJson(read, `:${path}`)));
      for (const k of Object.keys(before)) had[locale].add(k);
    }
  }
  // The very first commit of a repository has no HEAD: nothing was committed before, so every language is new.
  const hasHead = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { stdio: 'ignore' }).status === 0;
  const atHead = new Set(
    (hasHead ? git(['ls-tree', '-r', '--name-only', 'HEAD', '--', DIR]) : '')
      .split('\n')
      .filter(Boolean)
      .map((p) => p.slice(DIR.length).split('/')[0]),
  );
  const unsynced = unsyncedKeys(
    changes,
    locales.filter((l) => !atHead.has(l)),
    had,
  );
  if (!Object.keys(unsynced).length) return 0;
  if (process.env.NOVIRA_I18N_SINGLE_LOCALE === '1') {
    console.warn('check-i18n-sync: NOVIRA_I18N_SINGLE_LOCALE=1, accepting a change in only some languages.');
    return 0;
  }
  console.error('check-i18n-sync: ja and en must change together, and a text another language already had for a changed message is out of date. Update it or remove it (i18n-add.mjs --replace removes it):');
  for (const [locale, keys] of Object.entries(unsynced)) console.error(`  ${locale}: ${keys.join(', ')}`);
  console.error('(A deliberate fix to one language only: commit with NOVIRA_I18N_SINGLE_LOCALE=1.)');
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
