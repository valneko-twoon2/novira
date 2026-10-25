// Keeps what drives or describes the screens in step with them: every test id and every screen-text key that the e2e specs,
// the frontend scripts (the manual's scenes), the tools (the real-app runs, the model sweep, the speed runs), the docs and the
// skills name must still exist in frontend/src and the ja catalog. A test id renamed or removed in a component otherwise
// shows only when that script next runs, minutes into a build or a real-app run, or never for a doc.
//
//   node tools/ui-refs.mjs               the tracked files (pre-commit runs this; exit 1 with the list when one is missing)
//   node tools/ui-refs.mjs <file>...     these files instead (tools/verify-real-app.mjs checks its test script this way)
//
// What it reads as a reference: getByTestId('x'), testid('x') (the manual's scenes), a selector [data-testid="x"] and its
// prefix form [data-testid^="x"], "test id `x`" in Markdown; msg('area.key') and t('area.key') with a known area. A name
// built at run time is checked by its fixed start (getByTestId(`media-${kind}`) needs some id that starts with "media-").
// What counts as defined: any string in the non-test sources of frontend/src, and any template string there with a fixed part
// of three characters or more (`${kind}-prompt` defines every "<word>-prompt"), so ids built from props pass; a message key
// is defined when the ja catalog has it (or its plural forms `.one`/`.other`).
// What it cannot see: an id that exists but is not on the screen (hidden in one build, behind a closed dialog), an id held in
// a variable, and text matched by its words (getByText): the e2e run and the real-app run find those.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = 'frontend/src/i18n/locales/ja';

/** Sources that define test ids: the app's code, not its tests. */
export const isDefinitionSource = (path) => /^frontend\/src\/.+\.(tsx?|mjs|js)$/.test(path) && !/\.(test|testkit|property\.test)\.tsx?$|\.d\.ts$/.test(path);

/** Files that name test ids or message keys of the screens from outside the app's code. */
export const isReferenceSource = (path) =>
  (/^frontend\/(e2e|scripts)\/.+\.(ts|mjs|js)$/.test(path) || /^tools\/.+\.mjs$/.test(path) || /^\.claude\/.+\.(mjs|md)$/.test(path) || /^docs\/.+\.md$/.test(path) || path === 'AGENTS.md') &&
  path !== 'tools/ui-refs.mjs';

/**
 * Turns a template string's text (between the backticks) into `{ re, loose }`: a regex of the ids it can make. `loose` when
 * its fixed text has fewer than three letters (`${testId}-${item.id}`): such a template defines an id only when it starts with
 * a stem, a test id handed to a component through a prop (`testId="video-pack"`, then `-turbo`). Null when it has no fixed
 * text or holds more than a name.
 */
export function templatePattern(body) {
  const parts = body.split(/\$\{[^}]*\}/);
  if (parts.length < 2 || !parts.join('') || parts.some((p) => !/^[\w.:-]*$/.test(p))) return null;
  const fixed = parts.map((p) => p.replace(/[.]/g, '\\.'));
  return { re: new RegExp(`^${fixed.join('[\\w.:-]+')}$`), rest: new RegExp(`^${fixed.slice(1).join('[\\w.:-]+')}$`), loose: parts.join('').replace(/[^\w]/g, '').length < 3, lead: parts[0] === '' };
}

/** Whether a template (from templatePattern) can make `name`; a loose one only after one of `stems`. */
export function templateMakes(t, name, stems) {
  if (!t.loose) return t.re.test(name);
  if (!t.lead) return false;
  for (const stem of stems) if (name.startsWith(stem) && t.rest.test(name.slice(stem.length))) return true;
  return false;
}

/** Props that hand a test id (or its start) to a component: `testId`, `listTestId`, `idPrefix` and the like. */
const STEM = /\b(?:testId|[a-z]+TestId|idPrefix|[a-z]+IdPrefix)\s*[=:]\s*\{?\s*(['"])([\w.:-]+)\1/g;

/** What the app's sources define: `{ literals, patterns, stems }` from `[{ path, text }]`. */
export function definitionsOf(sources) {
  const literals = new Set();
  const patterns = [];
  const stems = new Set();
  const seen = new Set();
  for (const { text } of sources) {
    for (const m of text.matchAll(/(['"])([\w.:-]+)\1/g)) literals.add(m[2]);
    for (const m of text.matchAll(STEM)) stems.add(m[2]);
    for (const m of text.matchAll(/`([^`\n]*)`/g)) {
      if (!m[1].includes('${')) {
        if (/^[\w.:-]+$/.test(m[1])) literals.add(m[1]);
        continue;
      }
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const re = templatePattern(m[1]);
      if (re) patterns.push(re);
    }
  }
  return { literals, patterns, stems };
}

/**
 * The test ids that sources set themselves (`data-testid`, a `testId`/`idPrefix` prop, with a string or a template), as
 * `{ literals, patterns, stems }` like definitionsOf: what a feature folder puts on the screen, so a spec that names one
 * of them tests that feature (tools/affected.mjs).
 */
export function testIdsIn(texts) {
  const literals = new Set();
  const patterns = [];
  const stems = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(/\b(data-testid|testId|[a-z]+TestId|idPrefix|[a-z]+IdPrefix)\s*[=:]\s*\{?\s*(['"`])([^'"`\n]*)\2/g)) {
      const value = m[3];
      if (!value.includes('${')) {
        if (!/^[\w.:-]+$/.test(value)) continue;
        literals.add(value);
        if (m[1] !== 'data-testid') stems.add(value);
        continue;
      }
      const t = templatePattern(value);
      if (t) patterns.push(t);
    }
  }
  return { literals, patterns, stems };
}

/** The keys of the ja catalog, from `{ area: { key: text } }` objects. */
export function messageKeysOf(catalogs) {
  const keys = new Set();
  for (const table of catalogs) for (const key of Object.keys(table)) keys.add(key);
  return keys;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * The references of one file: `{ kind: 'testid' | 'message', name, prefix, line }`. `prefix` is set when only the start of the
 * name is fixed (a template string, `^=`). `areas` are the catalog areas, so `t('a.b')` of another kind of `t` is left alone.
 */
export function referencesIn(path, text, areas) {
  const out = [];
  const add = (kind, name, prefix, index) => {
    if (name) out.push({ kind, name, prefix, line: lineOf(text, index) });
  };
  for (const m of text.matchAll(/\b(?:getByTestId|testid)\(\s*(['"`])([^'"`]*?)(\$\{|\1)/g)) add('testid', m[2], m[3] === '${', m.index);
  for (const m of text.matchAll(/\[data-testid(\^?)=\\?(["'])([^"'\\]*?)(\$\{|\\?\2)/g)) add('testid', m[3], m[1] === '^' || m[4] === '${', m.index);
  if (path.endsWith('.md')) for (const m of text.matchAll(/\btest ids? `([\w.:-]+)`/g)) add('testid', m[1], false, m.index);
  for (const m of text.matchAll(/\b(?:msg|t)\(\s*(['"`])([a-z][\w-]*)\.([^'"`]*?)(\$\{|\1)/g)) {
    if (!areas.has(m[2])) continue;
    add('message', `${m[2]}.${m[3]}`, m[4] === '${', m.index);
  }
  return out;
}

/** Whether a test id reference names something the app defines. */
export function testIdDefined(ref, { literals, patterns, stems }) {
  if (ref.prefix) {
    for (const l of literals) if (l.startsWith(ref.name)) return true;
    // A template that can make an id starting this way (`media-${kind}` for `media-`).
    return patterns.some((t) => !t.loose && (t.re.source.slice(1).startsWith(ref.name.replace(/[.]/g, '\\.')) || t.re.test(`${ref.name}x`)));
  }
  return literals.has(ref.name) || patterns.some((t) => templateMakes(t, ref.name, stems));
}

/** Whether a message key reference names a key of the ja catalog. */
export function messageDefined(ref, keys) {
  if (ref.prefix) {
    for (const k of keys) if (k.startsWith(ref.name)) return true;
    return false;
  }
  return keys.has(ref.name) || keys.has(`${ref.name}.one`);
}

/** The problems of the given reference files, one line each: `path:line: what is missing`. */
export function missingRefs(files, defs, keys) {
  const areas = new Set([...keys].map((k) => k.split('.')[0]));
  const problems = [];
  for (const { path, text } of files) {
    for (const ref of referencesIn(path, text, areas)) {
      const ok = ref.kind === 'testid' ? testIdDefined(ref, defs) : messageDefined(ref, keys);
      if (ok) continue;
      const shown = `${ref.name}${ref.prefix ? '…' : ''}`;
      problems.push(
        ref.kind === 'testid'
          ? `${path}:${ref.line}: test id "${shown}" is in no source of frontend/src; the screen changed, so change this reference`
          : `${path}:${ref.line}: message key "${shown}" is not in the ja catalog; the text was renamed or removed, so change this reference`,
      );
    }
  }
  return problems;
}

const tracked = (root) => execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

/** Reads the definitions and keys of a checkout. */
export function loadDefinitions(root = ROOT, files = tracked(root)) {
  const defs = definitionsOf(files.filter(isDefinitionSource).map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') })));
  const dir = join(root, CATALOG);
  const keys = messageKeysOf(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))));
  return { defs, keys };
}

/** The problems of the tracked reference files of a checkout, or of `paths` (absolute or relative to the checkout). */
export function checkRefs(root = ROOT, paths = null) {
  const files = tracked(root);
  const { defs, keys } = loadDefinitions(root, files);
  const targets = paths
    ? paths.map((p) => ({ path: relative(root, join(root, p)).replaceAll('\\', '/').replace(/^(\.\.\/)+/, ''), abs: existsSync(p) ? p : join(root, p) }))
    : files.filter(isReferenceSource).map((path) => ({ path, abs: join(root, path) }));
  return missingRefs(
    targets.filter((t) => existsSync(t.abs)).map((t) => ({ path: t.path, text: readFileSync(t.abs, 'utf8') })),
    defs,
    keys,
  );
}

function main(argv) {
  const problems = checkRefs(ROOT, argv.length ? argv : null);
  if (problems.length) {
    console.error('ui-refs: these references name test ids or screen texts that no longer exist:');
    for (const p of problems) console.error(`  ${p}`);
    console.error('Change the reference to what the screen has now (search frontend/src for the new id or key), or remove it with the step that used it.');
    return 1;
  }
  console.log('ui-refs: OK');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
