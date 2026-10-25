// Adds (or replaces) messages. ja and en are always needed; the other languages may be left out and filled later (--fill, i18n-todo.mjs).
// Usage (repository root or frontend/): node frontend/scripts/i18n-add.mjs <spec.json> [--replace] [--new-area]
// The spec is JSON: { "<area>": { "<key>": { "ja": "...", "en": "...", "zh-CN": "...", "zh-TW": "...", "ko": "...", "ru": "...", "es": "...", "pt-BR": "...", "fr": "...", "de": "..." } } }
//   - ja and en must have a text for every key (an empty or missing one is an error); a text given for another language is written, and
//     with --replace a missing one removes that language's old text (it would be about the old wording), so it falls back to English;
//   - --fill takes a spec with only the other languages' texts for keys ja already has, and adds the ones they lack;
//   - `{name}` placeholders must be the same in every language;
//   - a key that already exists is an error unless --replace is given (replacing changes the text in all languages);
//   - an area (file) that does not exist is an error unless --new-area is given; a new area is created in every language and
//     still has to be registered for ja and en in src/i18n/catalog.ts (see .claude/rules/i18n.md).
// New keys are appended at the end of the area file. Files are written the way the repository keeps them: 2-space JSON, LF.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMARY_LOCALES } from './locales.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(HERE, '..', 'src', 'i18n', 'locales');

/** The languages every message must have; the others may follow later (see .claude/rules/i18n.md). */
export { PRIMARY_LOCALES };

const placeholders = (text) => [...text.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map((m) => m[1]).sort();

/**
 * Applies a spec. Returns the files it wrote (relative to the locales folder); throws before writing anything when the spec is wrong.
 * @param {Record<string, Record<string, Record<string, string>>>} spec
 * @param {{ dir?: string, replace?: boolean, newArea?: boolean }} [options]
 */
export function addMessages(spec, { dir = LOCALES_DIR, replace = false, newArea = false, fill = false } = {}) {
  const locales = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const problems = [];
  const next = new Map();
  const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
  const fileOf = (locale, area) => join(dir, locale, `${area}.json`);

  for (const [area, keys] of Object.entries(spec)) {
    if (!/^[a-z][a-z0-9]*$/.test(area)) problems.push(`area "${area}": use a lower-case name`);
    for (const locale of locales) {
      const file = fileOf(locale, area);
      if (!existsSync(file) && !newArea) problems.push(`${locale}/${area}.json does not exist (use --new-area to create an area)`);
      next.set(file, { ...(next.get(file) ?? read(file)) });
    }
    for (const [key, texts] of Object.entries(keys)) {
      if (!key.startsWith(`${area}.`)) problems.push(`key "${key}" should start with "${area}."`);
      for (const locale of Object.keys(texts)) if (!locales.includes(locale)) problems.push(`${key}: unknown language "${locale}"`);
      const reference = fill ? next.get(fileOf('ja', area))[key] : texts.ja;
      if (fill && typeof reference !== 'string') problems.push(`${key}: --fill needs a key that ja already has`);
      for (const locale of locales) {
        const messages = next.get(fileOf(locale, area));
        const text = texts[locale];
        const given = typeof text === 'string' && text.trim() !== '';
        const primary = PRIMARY_LOCALES.includes(locale);
        if (fill) {
          // Fill adds the missing texts of the other languages; the primary ones are never touched.
          if (primary && text !== undefined) problems.push(`${key}: --fill is for the other languages, not ${locale}`);
          if (!given || primary) continue;
        } else if (!given) {
          if (primary) problems.push(`${key}: no text for ${locale} (ja and en are always needed)`);
          // The other languages follow later (see i18n-todo.mjs). A text they had for the old wording would now be wrong, so it goes.
          else if (replace && key in messages) delete messages[key];
          continue;
        }
        if (key in messages && !replace && !fill) problems.push(`${key} already exists in ${locale} (use --replace to change it in every language)`);
        if (fill && key in messages && !replace) continue;
        if (typeof reference === 'string' && placeholders(text).join() !== placeholders(reference).join()) {
          problems.push(`${key}: ${locale} has other {placeholders} than ja`);
        }
        messages[key] = text;
      }
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));

  const written = [];
  for (const [file, messages] of next) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
    written.push(file.slice(dir.length + 1).replace(/\\/g, '/'));
  }
  return written;
}

function main() {
  const args = process.argv.slice(2);
  const specFile = args.find((a) => !a.startsWith('--'));
  if (!specFile) {
    console.error('usage: node frontend/scripts/i18n-add.mjs <spec.json> [--replace] [--new-area] [--fill]');
    process.exitCode = 2;
    return;
  }
  try {
    const written = addMessages(JSON.parse(readFileSync(specFile, 'utf8')), { replace: args.includes('--replace'), newArea: args.includes('--new-area'), fill: args.includes('--fill') });
    for (const f of written) console.log(`i18n: wrote ${f}`);
    if (args.includes('--new-area')) console.log('i18n: a new area must also be registered in src/i18n/catalog.ts (import and spread, for ja and en; the other languages load their folder).');
  } catch (error) {
    console.error(`i18n: nothing written\n${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
