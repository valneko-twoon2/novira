// Writes two files from the open-source software novira ships or downloads:
//   - src/features/settings/ossLicenses.json: the list the About dialog shows;
//   - THIRD_PARTY_NOTICES.txt (repository root): every license text, copied from the package itself, which the About
//     dialog shows in full.
// Frontend: the production npm packages (`npm query .prod`). Backend: the Rust crates the app links on Windows
// (`cargo metadata`, normal dependencies of the `novira` package, followed transitively).
// Downloads: what the app fetches at run time (ComfyUI, 7-Zip, the watermark's ONNX Runtime and models) is not shipped, so
// it is listed in scripts/oss-downloads.json. Every file the watermark's download manifest (files.json) names must be
// covered by an entry there, or this script fails.
// A package that ships no license file gets its text from scripts/oss-texts/<name>@<version>.txt (taken from its repository);
// a package with neither makes this script fail, and all such packages are named in one message.
// Run from frontend/: `npm run licenses`. The pre-commit hook runs it when a dependency, a download or a license text changes
// (.githooks/pre-commit.mjs), so the committed files stay current.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargoCommand } from '../../tools/harness-process.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(here, '..');
const repoDir = join(frontendDir, '..');
const outFile = join(frontendDir, 'src', 'features', 'settings', 'ossLicenses.json');
const noticesFile = join(repoDir, 'THIRD_PARTY_NOTICES.txt');
const overrideDir = join(here, 'oss-texts');
const downloadsFile = join(here, 'oss-downloads.json');
const includedFile = join(here, 'oss-included.json');
const watermarkFilesFile = join(repoDir, 'backend', 'crates', 'novira-core', 'src', 'provenance', 'files.json');

/** Packages with no license text anywhere: named together, so one run shows them all. */
const missingTexts = [];

/** The files that carry a license text: LICENSE, COPYING, NOTICE and their variants (LICENSE-MIT, license.md). */
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;

/** `git+https://github.com/a/b.git` and friends become a plain https URL. */
export function cleanUrl(raw) {
  if (!raw) return '';
  let url = typeof raw === 'string' ? raw : (raw.url ?? '');
  url = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
  if (/^github:/.test(url)) url = `https://github.com/${url.slice(7)}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  return url.startsWith('http') ? url : '';
}

/** Metadata writes `MIT/Apache-2.0` for "either"; the SPDX form is `MIT OR Apache-2.0`. */
export function spdx(expr) {
  const s = expr.trim();
  return /\b(OR|AND)\b/.test(s) ? s : s.replace(/\s*\/\s*/g, ' OR ');
}

function uniqueSorted(items) {
  const seen = new Map();
  for (const item of items) seen.set(`${item.name}@${item.version}`, item);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}


function frontendPackages() {
  // `npm` is a .cmd on Windows, so it needs a shell.
  // In a Git worktree node_modules may be a junction into another checkout; npm sees the packages only from there.
  const modules = join(frontendDir, 'node_modules');
  const cwd = existsSync(modules) ? dirname(realpathSync(modules)) : frontendDir;
  const json = execFileSync('npm query .prod', { cwd, encoding: 'utf8', shell: true, maxBuffer: 64 << 20 });
  const packages = JSON.parse(json).filter((p) => p.name !== 'novira-frontend');
  return uniqueSorted(
    packages.map((p) => ({
      kind: 'npm',
      name: p.name,
      version: p.version,
      license: spdx(typeof p.license === 'string' ? p.license : (p.license?.type ?? 'UNKNOWN')),
      url: cleanUrl(p.repository) || cleanUrl(p.homepage),
      dir: p.path,
    })),
  );
}

function backendCrates() {
  const json = execFileSync(cargoCommand(), ['metadata', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc'], {
    cwd: join(repoDir, 'backend'),
    encoding: 'utf8',
    maxBuffer: 256 << 20,
  });
  const meta = JSON.parse(json);
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const workspace = new Set(meta.workspace_members);
  const root = meta.packages.find((p) => p.name === 'novira' && workspace.has(p.id));
  const seen = new Set();
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    // Only normal dependencies end up in the app; build scripts and tests do not ship.
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (dep.dep_kinds.some((k) => k.kind === null)) queue.push(dep.pkg);
    }
  }
  return uniqueSorted(
    [...seen]
      .filter((id) => !workspace.has(id))
      .map((id) => byId.get(id))
      .map((p) => ({
        kind: 'crate',
        name: p.name,
        version: p.version,
        license: spdx(p.license ?? (p.license_file ? 'see license file' : 'UNKNOWN')),
        url: cleanUrl(p.repository) || cleanUrl(p.homepage),
        dir: dirOf(p.manifest_path),
      })),
  );
}

function dirOf(file) {
  return file.slice(0, Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')));
}

/** The file names the app downloads that a manifest pins: the watermark's files. */
function downloadedFileNames() {
  return JSON.parse(readFileSync(watermarkFilesFile, 'utf8')).files.map((f) => f.name);
}

/**
 * The problems of the download list (oss-downloads.json): an entry without a name, license or url, and a file the app
 * downloads (`downloadedNames`) that no entry `covers`, so a new download cannot ship without its notice.
 */
export function downloadProblems(list, downloadedNames) {
  const problems = list.filter((d) => !d.name || !d.license || !d.url).map((d) => `oss-downloads.json: an entry lacks name, license or url: ${JSON.stringify(d)}`);
  const covered = new Set(list.flatMap((d) => d.covers ?? []));
  const uncovered = [...new Set(downloadedNames)].filter((name) => !covered.has(name));
  if (uncovered.length > 0) problems.push(`downloaded file(s) with no entry in scripts/oss-downloads.json (add it to the \`covers\` of its download): ${uncovered.join(', ')}`);
  return problems;
}

/** What the app downloads at run time, with its license and where it comes from. Throws on a problem of the list. */
function downloads() {
  const { downloads: list } = JSON.parse(readFileSync(downloadsFile, 'utf8'));
  const problems = downloadProblems(list, downloadedFileNames());
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return list;
}

/**
 * The license texts of one package: the license files in its folder, or the text kept in scripts/oss-texts when the package
 * ships none. Each text comes with the file it was read from (`fromRepository` when it was not in the package).
 */
function licenseTexts(pkg) {
  const files = existsSync(pkg.dir)
    ? readdirSync(pkg.dir).filter((f) => LICENSE_FILE.test(f) && statSync(join(pkg.dir, f)).isFile()).sort()
    : [];
  if (files.length > 0) {
    return files.map((file) => ({ text: readFileSync(join(pkg.dir, file), 'utf8'), fromRepository: false }));
  }
  const override = join(overrideDir, `${pkg.name.replace('/', '+')}@${pkg.version}.txt`);
  if (existsSync(override)) {
    return [{ text: readFileSync(override, 'utf8'), fromRepository: true }];
  }
  missingTexts.push(`${pkg.name}@${pkg.version}`);
  return [];
}

/** Line endings to LF and no trailing blank lines, so the same text compares equal wherever it came from. */
function normalize(text) {
  return `${text.replace(/\r\n/g, '\n').replace(/\s+$/, '')}\n`;
}

/**
 * Every distinct license text once, with the packages that carry it (the same text is printed once in the notices).
 * Texts that differ only in spacing or line breaks (the same Apache-2.0 text copied with other line endings) count as one.
 */
function textGroups(packages) {
  const groups = new Map();
  for (const pkg of packages) {
    for (const { text, fromRepository } of licenseTexts(pkg)) {
      const body = normalize(text);
      const key = body.replace(/\s+/g, ' ').trim();
      const group = groups.get(key) ?? { body, members: [] };
      if (!group.members.some((m) => m.pkg === pkg)) group.members.push({ pkg, fromRepository });
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.members[0].pkg.name.localeCompare(b.members[0].pkg.name));
}

/**
 * The problem of an entry of oss-included.json, or null: its license text is missing, or a place it is used in is gone.
 * `exists` takes a path from the repository root.
 */
export function includedProblem(e, exists) {
  if (!exists(`frontend/scripts/oss-texts/${e.text}`)) return `oss-included.json: ${e.name} names a license text that is not in scripts/oss-texts: ${e.text}`;
  // Content that was removed takes its entry and its notice with it (a set of panel layouts once stayed listed after its code went).
  const gone = (e.usedIn ?? []).filter((p) => !exists(p));
  if (!e.usedIn?.length || gone.length) return `oss-included.json: ${e.name} ${gone.length ? `is used in ${gone.join(', ')}, which does not exist` : 'names no place it is used in'}; remove the entry with its content, or fix usedIn`;
  return null;
}

/** The content that ships in the app without being a package (oss-included.json), each with its license text. */
function included() {
  const list = JSON.parse(readFileSync(includedFile, 'utf8')).included;
  return list.map((e) => {
    const problem = includedProblem(e, (p) => existsSync(join(repoDir, p)));
    if (problem) throw new Error(problem);
    return { ...e, body: normalize(readFileSync(join(overrideDir, e.text), 'utf8')) };
  });
}

function noticesText(groups, downloaded, shipped) {
  const lines = [
    'Third-party notices for novira',
    '==============================',
    '',
    'novira is licensed under the Apache License, Version 2.0 (see LICENSE and NOTICE).',
    'The software below is used under its own license. Each license text is printed once; the packages listed',
    'above it carry that text. The list and the texts are generated by `npm run licenses`',
    '(frontend/scripts/oss-licenses.mjs). Do not edit this file by hand.',
    '',
    'Downloaded at run time (not shipped with the app)',
    '-------------------------------------------------',
    'The app downloads these on first start or when a feature needs them. Their license texts are at the links.',
    ...downloaded.map((e) => `- ${e.name}${e.version ? ` ${e.version}` : ''} (${e.license}) ${e.url}${e.inside ? ` (inside ${e.inside})` : ''}`),
    '',
    'Content in the app that is not a package',
    '----------------------------------------',
    ...shipped.flatMap((e) => ['', `${e.name} ${e.version} (${e.license}); used in ${e.usedIn.join(', ')}`, '', e.body]),
    '',
    'Software in the app',
    '===================',
    '',
  ];
  groups.forEach((group, i) => {
    lines.push(`License text ${i + 1} of ${groups.length}`, 'Used by:');
    for (const { pkg, fromRepository } of group.members) {
      const from = fromRepository ? ' (the package ships no license file; the text is from its repository)' : '';
      lines.push(`- ${pkg.name} ${pkg.version} (${pkg.kind}, ${pkg.license})${pkg.url ? ` ${pkg.url}` : ''}${from}`);
    }
    lines.push('', '----------------------------------------------------------------------', group.body, '');
  });
  return lines.join('\n');
}

function main() {
  const frontend = frontendPackages();
  const backend = backendCrates();
  const downloaded = downloads();
  const groups = textGroups([...frontend, ...backend]);
  if (missingTexts.length > 0) {
    throw new Error(`no license text for ${missingTexts.length} package(s); add scripts/oss-texts/<name>@<version>.txt for each:\n  ${missingTexts.join('\n  ')}`);
  }

  // Everything is worked out before anything is written, so a failure never leaves one file new and the other old.
  const shipped = included();
  const data = {
    frontend: frontend.map(({ name, version, license, url }) => ({ name, version, license, url })),
    backend: backend.map(({ name, version, license, url }) => ({ name, version, license, url })),
    engine: downloaded.map(({ name, version, license, url }) => ({ name, version: version ?? '', license, url })),
  };
  writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(noticesFile, noticesText(groups, downloaded, shipped).replace(/\r\n/g, '\n'));
  console.log(
    `frontend ${data.frontend.length}, backend ${data.backend.length}, downloads ${data.engine.length}, license texts ${groups.length} -> ${outFile}, ${noticesFile}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
