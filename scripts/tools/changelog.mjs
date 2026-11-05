// The changelog (CHANGELOG.md, Keep a Changelog 1.1.0, .claude/skills/release-notes/SKILL.md): its shape, the notes of one version
// for the release page, and the cut of a release.
//   node scripts/tools/changelog.mjs --check                          the file has the shape below (pre-commit when it is staged, CI)
//   node scripts/tools/changelog.mjs --notes <tag> [--out <file>]     the body of the version the tag v<version> names (the release workflow)
//   node scripts/tools/changelog.mjs --release <version> [--date <YYYY-MM-DD>]   moves [Unreleased] into a new version section
//                                                                      dated today (UTC) and rewrites the links (/release-notes)
// Shape: "# 変更履歴", an introduction, "## [Unreleased]", then "## [x.y.z] - YYYY-MM-DD" newest first. Inside a section only
// "### " + Added, Changed, Deprecated, Removed, Fixed or Security, in that order, each holding one-line "- " bullets. At the
// end one link per section: [unreleased] compares the latest tag with HEAD, a version compares its tag with the one before
// (the first version links its tag).
// Limits: it checks the shape, not whether a bullet is true or whether a change is missing.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const FILE = join(ROOT, 'CHANGELOG.md');
export const REPO = 'https://github.com/valneko-twoon2/novira';
export const TITLE = '# 変更履歴';
export const TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SECTION = /^## \[([^\]]+)\](?: - (\S+))?\s*$/;
const LINK = /^\[([^\]]+)\]: (\S+)$/;

/** Splits the text into the introduction, the sections and the link lines. */
export function parse(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const head = [];
  const sections = [];
  const links = [];
  for (const line of lines) {
    const link = LINK.exec(line);
    const section = SECTION.exec(line);
    if (link) links.push({ key: link[1], url: link[2] });
    else if (section) sections.push({ name: section[1], date: section[2] ?? null, heading: line, body: [] });
    else if (line.startsWith('## ')) sections.push({ name: null, date: null, heading: line, body: [] });
    else (sections.length ? sections[sections.length - 1].body : head).push(line);
  }
  return { head, sections, links };
}

function compareVersions(a, b) {
  const [ca, pa] = a.split('-', 2);
  const [cb, pb] = b.split('-', 2);
  const na = ca.split('.').map(Number);
  const nb = cb.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (na[i] !== nb[i]) return na[i] - nb[i];
  if (pa === pb) return 0;
  if (pa === undefined) return 1;
  if (pb === undefined) return -1;
  return pa < pb ? -1 : 1;
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** The link lines the sections call for, newest first. */
export function expectedLinks(versions) {
  const out = [{ key: 'unreleased', url: versions.length ? `${REPO}/compare/v${versions[0]}...HEAD` : `${REPO}/commits/main` }];
  versions.forEach((v, i) => {
    const older = versions[i + 1];
    out.push({ key: v, url: older ? `${REPO}/compare/v${older}...v${v}` : `${REPO}/releases/tag/v${v}` });
  });
  return out;
}

/** The problems of a section's body: only type headings in order, each with one-line bullets. */
function bodyErrors(section) {
  const errors = [];
  let type = -1;
  let bullets = 0;
  let total = 0;
  const close = () => {
    if (type >= 0 && bullets === 0) errors.push(`${section.heading}: "### ${TYPES[type]}" has no bullet`);
  };
  for (const line of section.body) {
    if (line.trim() === '') continue;
    if (line.startsWith('### ')) {
      const next = TYPES.indexOf(line.slice(4).trim());
      if (next < 0) errors.push(`${section.heading}: "${line}" is not one of ${TYPES.join(', ')}`);
      else if (next <= type) errors.push(`${section.heading}: "${line}" is out of order (${TYPES.join(', ')})`);
      close();
      type = Math.max(type, next);
      bullets = 0;
    } else if (/^- \S/.test(line)) {
      if (type < 0) errors.push(`${section.heading}: a bullet before any "### " type: ${line}`);
      bullets++;
      total++;
    } else errors.push(`${section.heading}: only "### <type>" and one-line "- " bullets belong in a section: ${line}`);
  }
  close();
  return { errors, total };
}

/** Every problem of the file's shape; empty when it is fine. */
export function check(text) {
  const { head, sections, links } = parse(text);
  const errors = [];
  if (head[0] !== TITLE) errors.push(`the first line must be "${TITLE}"`);
  if (!head.slice(1).some((l) => l.trim() !== '')) errors.push('an introduction must follow the title');
  if (sections[0]?.name !== 'Unreleased' || sections[0].date !== null) errors.push('the first section must be "## [Unreleased]"');
  const versions = [];
  sections.forEach((s, i) => {
    if (i === 0 && s.name === 'Unreleased') {
      errors.push(...bodyErrors(s).errors);
      return;
    }
    if (s.name === null || !VERSION.test(s.name)) {
      errors.push(`"${s.heading}" must read "## [x.y.z] - YYYY-MM-DD"`);
      return;
    }
    if (!s.date || !validDate(s.date)) errors.push(`${s.heading}: the date must be a real YYYY-MM-DD`);
    if (versions.includes(s.name)) errors.push(`${s.heading}: the version is written twice`);
    else if (versions.length && compareVersions(versions[versions.length - 1], s.name) <= 0) errors.push(`${s.heading}: versions go newest first`);
    const body = bodyErrors(s);
    errors.push(...body.errors);
    if (body.total === 0) errors.push(`${s.heading}: a released version needs at least one bullet`);
    versions.push(s.name);
  });
  const want = expectedLinks(versions).map((l) => `[${l.key}]: ${l.url}`);
  const have = links.map((l) => `[${l.key}]: ${l.url}`);
  if (want.join('\n') !== have.join('\n')) errors.push(`the links at the end must be, in this order:\n${want.join('\n')}`);
  return errors;
}

/** The release notes of the version the tag names: the section's body without its surrounding blank lines. */
export function notes(text, tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v') || !VERSION.test(tag.slice(1))) throw new Error(`"${tag}" is not a tag v<version>`);
  const section = parse(text).sections.find((s) => s.name === tag.slice(1));
  if (!section) throw new Error(`CHANGELOG.md has no "## [${tag.slice(1)}]" section; run /release-notes, which writes it before tagging`);
  const body = section.body.join('\n').trim();
  if (!body) throw new Error(`the section of ${tag} is empty`);
  return `${body}\n`;
}

/** The text with [Unreleased] moved into a new section for the version, dated `date`, and the links rewritten. */
export function release(text, version, date) {
  if (!VERSION.test(version ?? '')) throw new Error(`"${version}" is not a version x.y.z`);
  if (!validDate(date ?? '')) throw new Error(`"${date}" is not a date YYYY-MM-DD`);
  const errors = check(text);
  if (errors.length) throw new Error(`CHANGELOG.md is not in shape:\n${errors.join('\n')}`);
  const { head, sections } = parse(text);
  const [unreleased, ...older] = sections;
  const body = unreleased.body.join('\n').trim();
  if (!body) throw new Error('[Unreleased] has nothing to release');
  if (older.length && compareVersions(older[0].name, version) >= 0) throw new Error(`${version} is not newer than ${older[0].name}`);
  const blocks = [
    head.join('\n').trimEnd(),
    '## [Unreleased]',
    `## [${version}] - ${date}\n\n${body}`,
    ...older.map((s) => `${s.heading}\n\n${s.body.join('\n').trim()}`),
    expectedLinks([version, ...older.map((s) => s.name)])
      .map((l) => `[${l.key}]: ${l.url}`)
      .join('\n'),
  ];
  return `${blocks.join('\n\n')}\n`;
}

function main(argv) {
  const [command, value] = argv;
  const option = (name) => {
    const i = argv.indexOf(name);
    return i < 0 ? undefined : argv[i + 1];
  };
  const text = readFileSync(FILE, 'utf8');
  if (command === '--check') {
    const errors = check(text);
    if (errors.length) {
      console.error(`changelog: CHANGELOG.md is not in shape (.claude/skills/release-notes/SKILL.md):\n${errors.map((e) => `  ${e}`).join('\n')}`);
      return 1;
    }
    return 0;
  }
  if (command === '--notes') {
    const body = notes(text, value);
    const out = option('--out');
    if (!out) process.stdout.write(body);
    else {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, body);
      console.log(`changelog: the notes of ${value} are in ${out}`);
    }
    return 0;
  }
  if (command === '--release') {
    writeFileSync(FILE, release(text, value, option('--date') ?? new Date().toISOString().slice(0, 10)));
    console.log(`changelog: [Unreleased] is now [${value}]`);
    return 0;
  }
  throw new Error('usage: changelog.mjs --check | --notes <tag> [--out <file>] | --release <version> [--date <YYYY-MM-DD>]');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`changelog: ${e.message}`);
    process.exitCode = 1;
  }
}
