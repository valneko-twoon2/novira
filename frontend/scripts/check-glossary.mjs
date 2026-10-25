// The terminology check: one concept, one word. src/i18n/glossary.json lists, per concept, the canonical ja and en
// word and the variants that must not be used for it (regular expressions, per language, or under "*" for spellings of
// names that are the same in every language). This module finds those variants in the catalogs and the manual.
// Used by tests/i18n-glossary.test.ts and by the pre-commit hook; by hand (from the repository root):
//   node frontend/scripts/check-glossary.mjs            (the working tree, ja and en)
//   node frontend/scripts/check-glossary.mjs --staged   (the staged versions of the files)
//   NOVIRA_GLOSSARY_LOCALES=all (or "ko,de") checks those languages too; only the "*" rules and their own rules apply.
// What is not checked: catalog keys, `{{ui:…}}` references, `{placeholders}`, inline code, URLs, fenced code blocks.
// Limits: a rule matches words, not meaning; a variant that the regex does not name, or a concept no entry names, passes.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readBlobs } from './git-blobs.mjs';
import { PRIMARY_LOCALES } from './locales.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LOCALES = 'frontend/src/i18n/locales';
const MANUAL = 'docs/manual';
const GLOSSARY = 'frontend/src/i18n/glossary.json';
/** The languages checked unless NOVIRA_GLOSSARY_LOCALES says otherwise (the others follow in a batch). */
export const DEFAULT_LOCALES = PRIMARY_LOCALES;

/** The languages to check: the default, every one ("all"), or a comma-separated list. */
export function selectLocales(env, available) {
  const value = (env ?? '').trim();
  if (!value) return DEFAULT_LOCALES.filter((l) => available.includes(l));
  if (value === 'all') return [...available];
  const asked = value.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = asked.filter((l) => !available.includes(l));
  if (unknown.length) throw new Error(`NOVIRA_GLOSSARY_LOCALES names unknown languages: ${unknown.join(', ')}`);
  return asked;
}

/** Removes what a rule must not read: screen-word references, placeholders, inline code, URLs and image targets. */
export function strip(text) {
  return text
    .replace(/\{\{ui:[^}]*\}\}/g, ' ')
    .replace(/\{[A-Za-z0-9_]+\}/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
    .replace(/https?:\/\/\S+/g, ' ');
}

/** The checkable rules of one language: its own terms and the "*" ones, with the regexes compiled. */
export function rulesFor(glossary, language) {
  return glossary.terms.flatMap((term) =>
    [...(term.avoid[language] ?? []), ...(term.avoid['*'] ?? [])].map((pattern) => ({
      term,
      pattern,
      re: new RegExp(pattern, 'u'),
      keys: term.keys ? new RegExp(term.keys, 'u') : null,
      except: new Set((term.except ?? []).map((e) => e.key)),
    })),
  );
}

/**
 * The violations in a list of texts. A text is `{ where, key?, text }`: `key` is the catalog key (a rule with `keys`
 * reads only the keys that match, and `except` lists keys a rule skips); manual lines have no key.
 */
export function findViolations(texts, glossary, language) {
  const rules = rulesFor(glossary, language);
  const out = [];
  for (const item of texts) {
    const text = strip(item.text);
    for (const rule of rules) {
      if (rule.keys && !(item.key && rule.keys.test(item.key))) continue;
      if (item.key && rule.except.has(item.key)) continue;
      const m = rule.re.exec(text);
      if (m) out.push(`${item.where}: "${m[0]}" -> use "${rule.term[language] ?? rule.term.en}" (${rule.term.concept}: ${rule.term.why})`);
    }
  }
  return out;
}

/** The texts of one language: every catalog message and every manual line outside fenced code. */
export function textsOf(language, read) {
  const out = [];
  for (const file of read.list(`${LOCALES}/${language}`).filter((n) => n.endsWith('.json'))) {
    const messages = JSON.parse(read.file(`${LOCALES}/${language}/${file}`));
    for (const [key, text] of Object.entries(messages)) out.push({ where: `${language}/${file} ${key}`, key, text });
  }
  for (const file of read.list(`${MANUAL}/${language}`).filter((n) => n.endsWith('.md'))) {
    let fenced = false;
    read.file(`${MANUAL}/${language}/${file}`).split(/\r?\n/).forEach((text, i) => {
      if (/^\s*```/.test(text)) fenced = !fenced;
      else if (!fenced) out.push({ where: `manual/${language}/${file}:${i + 1}`, text });
    });
  }
  return out;
}

/** Reads the working tree. */
export const workingTree = {
  list: (dir) => {
    try {
      return readdirSync(join(ROOT, dir));
    } catch {
      return [];
    }
  },
  file: (path) => readFileSync(join(ROOT, path), 'utf8'),
};

/** Reads the index (what the commit will hold), with one git process for every file. */
function stagedTree() {
  const names = execFileSync('git', ['ls-files', '-z', '--', LOCALES, MANUAL, GLOSSARY], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  const blobs = readBlobs(names.map((n) => `:${n}`), ROOT);
  const files = new Map(names.map((n) => [n, blobs.get(`:${n}`) ?? '']));
  return {
    list: (dir) => [...new Set([...files.keys()].filter((n) => n.startsWith(`${dir}/`)).map((n) => n.slice(dir.length + 1).split('/')[0]))],
    file: (path) => files.get(path) ?? '',
  };
}

/** Every violation in the given languages, read through `read`. */
export function check(read, locales) {
  const glossary = JSON.parse(read.file(GLOSSARY));
  return locales.flatMap((l) => findViolations(textsOf(l, read), glossary, l));
}

function main() {
  const read = process.argv.includes('--staged') ? stagedTree() : workingTree;
  const locales = selectLocales(process.env.NOVIRA_GLOSSARY_LOCALES, read.list(LOCALES));
  const found = check(read, locales);
  if (found.length === 0) return 0;
  console.error(`glossary: ${found.length} word(s) that ${GLOSSARY} says not to use:`);
  for (const line of found) console.error(`  ${line}`);
  console.error('Use the canonical word, or add a per-key exception with a reason to the glossary (.claude/rules/i18n.md).');
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
