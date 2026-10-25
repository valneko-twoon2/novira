// Lists the messages the languages other than ja and en still lack (they show the English text meanwhile), so they can be
// translated together later.
//   node frontend/scripts/i18n-todo.mjs                     counts per language
//   node frontend/scripts/i18n-todo.mjs --lang ko,fr        only those languages
//   node frontend/scripts/i18n-todo.mjs --out todo.json     also writes { "<language>": { "<area>": { "<key>": { "ja": "...", "en": "..." } } } }
// Translate the texts into the same shape ({ "<area>": { "<key>": { "<language>": "..." } } }) and add them with
// `node frontend/scripts/i18n-add.mjs <spec.json> --fill`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_LOCALES } from './i18n-add.mjs';

const LOCALES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

/** For each other language: { area: { key: { ja, en } } } of the keys it lacks. */
export function missingMessages(dir = LOCALES_DIR, only = null) {
  const locales = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const read = (locale, area) => (existsSync(join(dir, locale, area)) ? JSON.parse(readFileSync(join(dir, locale, area), 'utf8')) : {});
  const areas = readdirSync(join(dir, 'ja')).filter((f) => f.endsWith('.json'));
  const out = {};
  for (const locale of locales.filter((l) => !PRIMARY_LOCALES.includes(l) && (!only || only.includes(l)))) {
    out[locale] = {};
    for (const area of areas) {
      const ja = read('ja', area);
      const en = read('en', area);
      const mine = read(locale, area);
      for (const key of Object.keys(ja).filter((k) => !(k in mine))) {
        (out[locale][area.replace(/\.json$/, '')] ??= {})[key] = { ja: ja[key], en: en[key] ?? ja[key] };
      }
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  const only = args.includes('--lang') ? value('--lang').split(',') : null;
  const missing = missingMessages(LOCALES_DIR, only);
  let total = 0;
  for (const [locale, areas] of Object.entries(missing)) {
    const count = Object.values(areas).reduce((n, keys) => n + Object.keys(keys).length, 0);
    total += count;
    console.log(`${locale}: ${count} message(s) to translate${count ? ` (${Object.keys(areas).join(', ')})` : ''}`);
  }
  if (args.includes('--out')) {
    writeFileSync(value('--out'), JSON.stringify(missing, null, 2));
    console.log(`i18n-todo: wrote ${value('--out')}`);
  }
  if (total === 0) console.log('i18n-todo: every language is complete.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
