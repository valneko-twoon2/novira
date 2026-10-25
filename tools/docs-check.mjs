// Keeps the documents that describe the repository in step with it, by machine (AGENTS.md section 2, .claude/rules/).
//
//   node tools/docs-check.mjs            the map (docs/architecture/) matches the tree: every top-level folder, crate, source and
//                                          feature folder, rule and skill is named; the design pages (docs/design/) name what they
//                                          cover and are listed in their index; every path and link they write exists; pages are small
//   node tools/docs-check.mjs --git      also against the staged change (pre-commit): a change to a security boundary (IPC
//                                          commands, capabilities, CSP, window config) must come with a design page, and a change to
//                                          code that a design page covers prints a warning when that page is not in the commit
//   node tools/docs-check.mjs --find <path>...   the design pages that cover each path (read them before changing it)
//
// The map is a short guide, not a list of files, so it is checked for what it names and what it points at (.claude/rules/
// architecture-map.md). A design page is the current specification of one feature; its `covers` list in the front matter says
// which code it describes (.claude/rules/design-docs.md).
//
// What it cannot see: whether a page says the right thing, or whether a change inside a file needs a design note. It forces the
// question: a new folder fails until a page names it, a moved file fails until the page that pointed at it is fixed, a boundary
// change fails until a design page is in the commit, and a change to covered code asks (warns) whether its page still holds.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCH = 'docs/architecture';
const DESIGN = 'docs/design';

/** Bytes of the entry page of the map, which agents read at the start of a task. */
export const ENTRY_LIMIT = 7000;
/** Bytes of any other map page. */
export const PAGE_LIMIT = 14000;
/** Bytes of a design page; a longer one is split by feature. */
export const DESIGN_LIMIT = 14000;

/** Where a path written in a page starts when it is a repository path; anything else in backticks is not checked. */
const ROOTS = ['frontend/', 'backend/', 'contract/', 'docs/', 'scripts/', 'tools/', '.claude/', '.githooks/'];
/** Paths a page may name that are not tracked: build output. */
const UNTRACKED_OK = /^(frontend\/dist|backend\/target|frontend\/node_modules)(\/|$)/;
/** Names that look like paths under `tools/` but are not: the MCP methods `tools/list` and `tools/call`. */
const NOT_A_PATH = /^tools\/(list|call)$/;
/** Changes to these never ask for a design page: tests, their data and the docs themselves. */
const NOT_CODE = /(^docs\/|\.test\.|\.spec\.|\.testkit\.|\/tests?\/|\/e2e\/|__snapshots__|\.md$)/;

/** Where the names of the code live: the sources of every part, their configs and the launchers (not the screen texts). */
const CODE_FILE = /\.(tsx?|mjs|cjs|js|rs|toml|css|bat|ps1|json|sh)$/;
// Frontend tests are left out: a check of the docs quotes removed names as its examples (tests/docs-check.test.ts).
const NOT_CODE_FILE = /\/i18n\/locales\/|__snapshots__\/|\.test\.tsx?$|^frontend\/tests\//;
/** The pages whose code names are checked: everything written for developers and agents (the manual is for users). */
const NAMED_PAGES = /^(docs\/(?!manual\/).+\.md|\.claude\/.+\.md|AGENTS\.md)$/;
/** Names a page may write that no code of the repository has, each with the reason. */
const OUTSIDE_NAMES = {
  ORT_DYLIB_PATH: 'the ort crate reads it; gallery-share.md says the app does not use it',
  expected_behavior: 'a field of the evaluation JSON that the authoring-skills skill asks for',
  ryugahama_yueilxl_v1: 'a LoRA file of the user, named in verification.md as what a check ran on',
};

/**
 * The code names a page writes in backticks: one word shaped like an identifier of code (camelCase, a capital inside a
 * word, snake_case or UPPER_SNAKE), optionally with `()`. A plain word (`cast`, `Settings`) is not checked: it reads as
 * prose as often as code. Fenced blocks are left out (examples).
 */
export function codeNamesIn(body) {
  const out = new Map();
  const lines = body.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' ')).split('\n');
  lines.forEach((line, i) => {
    for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
      const name = /^([A-Za-z_]\w*)(\(\))?$/.exec(span)?.[1];
      if (!name || !(/[a-z][A-Z]/.test(name) || /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name) || /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name))) continue;
      if (!out.has(name)) out.set(name, i + 1);
    }
  });
  return out;
}

/** Files whose change moves a security boundary; a design page must be in the same commit. */
const BOUNDARY = [
  /^backend\/src-tauri\/src\/command_list\.rs$/,
  /^backend\/src-tauri\/(capabilities\/|tauri\.conf\.json$)/,
];

/** The first-level folder names directly under `prefix` among the tracked files. */
function foldersUnder(files, prefix) {
  const names = new Set();
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    const i = rest.indexOf('/');
    if (i > 0) names.add(rest.slice(0, i));
  }
  return [...names].sort();
}

/** The file names directly under `prefix` (no sub folder) with the extension. */
function filesUnder(files, prefix, ext) {
  return files.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/') && f.endsWith(ext)).map((f) => f.slice(prefix.length));
}

/** The repository paths a page writes in backticks, cut before a `<placeholder>` or a `*`. */
function pathsIn(body) {
  const out = new Set();
  for (const [, span] of body.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)) {
    if (/\s/.test(span) || !ROOTS.some((r) => span.startsWith(r))) continue;
    out.add(span.replace(/[<*].*$/, '').replace(/[.,;:]+$/, ''));
  }
  return [...out];
}

/** The relative targets of the markdown links of a page (not web addresses, not anchors). */
function linksIn(body) {
  return [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1].replace(/#.*$/, '')).filter((t) => t && !/^[a-z]+:/i.test(t));
}

/** The `covers` list of a design page's front matter, or null when the page has none. */
export function coversOf(body) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
  if (!front) return null;
  const list = [];
  let inList = false;
  for (const line of front[1].split(/\r?\n/)) {
    if (/^covers:\s*$/.test(line)) {
      inList = true;
    } else if (inList) {
      const item = /^\s+-\s+(\S.*?)\s*$/.exec(line);
      if (item) list.push(item[1]);
      else if (/^\S/.test(line)) inList = false;
    }
  }
  return list;
}

/** Whether `path` is covered by `entry`: the file itself, a folder, or a glob (`**` crosses folders, `*` does not). */
export function covers(entry, path) {
  if (!entry.includes('*')) return path === entry || path.startsWith(`${entry.replace(/\/$/, '')}/`);
  const source = entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${source}$`).test(path);
}

/** The design pages among the tracked files (the index is not one). */
function designPagesOf(files) {
  return files.filter((f) => f.startsWith(`${DESIGN}/`) && f.endsWith('.md') && f !== `${DESIGN}/README.md` && !f.slice(DESIGN.length + 1).includes('/'));
}

/** `[{ page, covers }]` of every design page, for the staged check and `--find`. */
export function designCovers(files, read) {
  return designPagesOf(files).map((page) => ({ page, covers: coversOf(read(page) ?? '') ?? [] }));
}

/**
 * Problems of the docs against the tree. `files` are the tracked paths, `read(path)` returns a file's text or null.
 * One string per problem, saying which page to fix.
 */
export function structureProblems(files, read) {
  const problems = [];
  const text = (path) => read(path) ?? '';
  const archPages = files.filter((f) => f.startsWith(`${ARCH}/`) && f.endsWith('.md'));
  const designPages = designPagesOf(files);
  const need = (page, names, what, suffix = '/') => {
    const body = page.map(text).join('\n');
    // A whole name: `eol.mjs` written only inside `check-eol.mjs` does not count.
    const named = (name) => new RegExp(`(?<![\\w.-])${`${name}${suffix}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(body);
    for (const name of names) if (!named(name)) problems.push(`${page[0]}: does not mention ${what} "${name}${suffix}"; add it to the map (.claude/rules/architecture-map.md)`);
  };
  const entry = `${ARCH}/README.md`;
  const frontend = `${ARCH}/frontend.md`;
  const backend = `${ARCH}/backend.md`;
  const tooling = `${ARCH}/tooling.md`;

  need([entry], foldersUnder(files, ''), 'the top-level folder');
  need([entry, tooling], filesUnder(files, 'scripts/', '.bat'), 'the launcher', '');
  // Everything the AI sessions, the hooks and CI call is described on the tooling page, and so are the Git hook bodies.
  need([tooling], filesUnder(files, 'tools/', '.mjs'), 'the tool', '');
  need([tooling], filesUnder(files, '.githooks/', '.mjs'), 'the Git hook body', '');
  need([frontend], foldersUnder(files, 'frontend/src/'), 'the source folder');
  need([frontend], foldersUnder(files, 'frontend/src/features/'), 'the feature folder');
  need([backend], foldersUnder(files, 'backend/crates/'), 'the crate');
  need([backend], foldersUnder(files, 'backend/crates/novira-core/src/'), 'the module folder');

  // Every rule and skill is reachable from AGENTS.md and described on the tooling page.
  const rules = filesUnder(files, '.claude/rules/', '.md');
  const skills = foldersUnder(files, '.claude/skills/');
  need(['AGENTS.md'], rules, 'the rule', '');
  need(['AGENTS.md'], skills.map((s) => `/${s}`), 'the skill', '');
  need([tooling], rules, 'the rule', '');
  need([tooling], skills, 'the skill');

  // What the pages point at exists: the paths they write and the links between them.
  const tracked = new Set(files);
  const exists = (path) => tracked.has(path) || files.some((f) => f.startsWith(`${path}/`));
  for (const page of [...archPages, ...designPages, ...(tracked.has(`${DESIGN}/README.md`) ? [`${DESIGN}/README.md`] : [])]) {
    const body = text(page);
    for (const path of pathsIn(body)) {
      if (UNTRACKED_OK.test(path) || NOT_A_PATH.test(path)) continue;
      if (!exists(path.replace(/\/$/, ''))) problems.push(`${page}: names the path "${path}", which does not exist; fix the page or remove the entry`);
    }
    for (const target of linksIn(body)) {
      const resolved = posix.normalize(posix.join(posix.dirname(page), target)).replace(/\/$/, '');
      if (!exists(resolved)) problems.push(`${page}: links to "${target}", which does not exist`);
    }
  }

  // A code name a page writes still exists somewhere in the code: a page that names a removed function, component or constant
  // describes code that is gone.
  const named = files.filter((f) => NAMED_PAGES.test(f));
  if (named.length) {
    const words = new Set();
    for (const f of files) if (CODE_FILE.test(f) && !NOT_CODE_FILE.test(f)) for (const w of text(f).match(/[A-Za-z_]\w*/g) ?? []) words.add(w);
    for (const page of named) {
      for (const [name, line] of codeNamesIn(text(page))) {
        if (!words.has(name) && !(name in OUTSIDE_NAMES)) problems.push(`${page}:${line}: names \`${name}\`, which no code of the repository has; the code was renamed or removed, so fix the page`);
      }
    }
  }

  // The map stays small enough to be read whole: the entry page is read at the start of every task.
  for (const page of archPages) {
    const size = Buffer.byteLength(text(page));
    const limit = page === entry ? ENTRY_LIMIT : PAGE_LIMIT;
    if (size > limit) problems.push(`${page}: ${size} bytes (at most ${limit}); cut what a search of the code shows (file lists), keep what it does not (.claude/rules/architecture-map.md)`);
  }

  // A design page says which code it describes, names only code that exists, is in the index, and is not too long.
  const index = text(`${DESIGN}/README.md`);
  for (const page of designPages) {
    const list = coversOf(text(page));
    if (list === null || list.length === 0) {
      problems.push(`${page}: needs a "covers:" list in its front matter (the files or folders of code it describes; .claude/rules/design-docs.md)`);
    } else {
      for (const entryPath of list) if (!files.some((f) => covers(entryPath, f))) problems.push(`${page}: covers "${entryPath}", which matches no file; fix the front matter`);
    }
    const base = page.split('/').pop();
    if (!index.includes(base)) problems.push(`${DESIGN}/README.md: does not list the page ${base}`);
    const size = Buffer.byteLength(text(page));
    if (size > DESIGN_LIMIT) problems.push(`${page}: ${size} bytes (at most ${DESIGN_LIMIT}); split it by feature (.claude/rules/design-docs.md)`);
  }
  return problems;
}

/**
 * Problems of a staged change. `changes` are `{ status, path }` (git diff --cached): the status letter and the path.
 */
export function stagedProblems(changes) {
  const problems = [];
  const hasDesign = changes.some((c) => c.status !== 'D' && c.path.startsWith(`${DESIGN}/`) && c.path.endsWith('.md'));
  const boundary = changes.find((c) => c.status !== 'D' && BOUNDARY.some((re) => re.test(c.path)));
  if (boundary && !hasDesign) {
    problems.push(`${boundary.path}: a security boundary changed (IPC commands, capabilities, CSP or window config); a design page must be in the same commit: re-read the page of the feature (node tools/docs-check.mjs --find ${boundary.path}) and ${DESIGN}/security.md, and update what no longer holds`);
  }
  return problems;
}

/**
 * Warnings for a staged change: code that a design page covers changed, and the page is not in the commit. `pages` is
 * `designCovers(...)`. Not a failure: a change inside a file often leaves the page true.
 */
export function stagedWarnings(changes, pages) {
  const inCommit = new Set(changes.filter((c) => c.status !== 'D').map((c) => c.path));
  const warnings = [];
  for (const { page, covers: list } of pages) {
    if (inCommit.has(page)) continue;
    const touched = [...inCommit].filter((p) => !NOT_CODE.test(p) && list.some((entry) => covers(entry, p)));
    if (touched.length === 0) continue;
    const shown = touched.slice(0, 3).join(', ') + (touched.length > 3 ? `, and ${touched.length - 3} more` : '');
    warnings.push(`${page} covers code in this commit (${shown}); read it and update it if it no longer says what the code does`);
  }
  return warnings;
}

/** The design pages that cover `path`. */
export function pagesCovering(path, pages) {
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  return pages.filter(({ covers: list }) => list.some((entry) => covers(entry, clean))).map(({ page }) => page);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function trackedFiles() {
  return git('ls-files', '-z').split('\0').filter(Boolean);
}

function stagedChanges() {
  const rows = git('diff', '--cached', '--name-status', '-z').split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < rows.length; ) {
    const status = rows[i][0];
    const path = status === 'R' || status === 'C' ? rows[i + 2] : rows[i + 1];
    i += status === 'R' || status === 'C' ? 3 : 2;
    out.push({ status, path });
  }
  return out;
}

const readFile = (path) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : null);

export function checkRepository() {
  return structureProblems(trackedFiles(), readFile);
}

function main(argv) {
  const find = argv.indexOf('--find');
  if (find >= 0) {
    const pages = designCovers(trackedFiles(), readFile);
    for (const path of argv.slice(find + 1)) {
      const hit = pagesCovering(path, pages);
      console.log(`${path}: ${hit.length ? hit.join(', ') : 'no design page covers it'}`);
    }
    return 0;
  }
  const files = trackedFiles();
  const staged = argv.includes('--git') ? stagedChanges() : [];
  const problems = [...structureProblems(files, readFile), ...stagedProblems(staged)];
  for (const w of stagedWarnings(staged, designCovers(files, readFile))) console.warn(`docs-check (warning): ${w}`);
  if (problems.length) {
    for (const p of problems) console.error(p);
    return 1;
  }
  console.log('Docs check: OK');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
