#!/usr/bin/env node
// Checks a skill folder against Anthropic's skill authoring best practices.
// Usage: node .claude/skills/authoring-skills/scripts/check-skill.mjs <skill folder>
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

// Limits from https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const BODY_MAX_LINES = 500;
// A reference longer than this needs a table of contents at the top.
const TOC_MIN_LINES = 100;
const RESERVED = ['anthropic', 'claude'];

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node check-skill.mjs <skill folder>');
  process.exit(2);
}
const skillFile = join(resolve(dir), 'SKILL.md');
if (!existsSync(skillFile)) {
  console.error(`${skillFile} not found. Pass the folder that holds SKILL.md.`);
  process.exit(2);
}

const problems = [];
const text = readFileSync(skillFile, 'utf8');
const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
if (!match) {
  console.error('SKILL.md must start with YAML frontmatter between --- lines.');
  process.exit(1);
}
const [, front, body] = match;

function field(key) {
  const m = front.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let value = m[1].trim();
  if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
  return value;
}

const name = field('name');
if (!name) problems.push('frontmatter has no name.');
else {
  if (name.length > NAME_MAX) problems.push(`name is ${name.length} characters; at most ${NAME_MAX}.`);
  if (!/^[a-z0-9-]+$/.test(name)) problems.push(`name "${name}" may use only lowercase letters, digits and hyphens.`);
  for (const word of RESERVED) if (name.includes(word)) problems.push(`name "${name}" contains the reserved word "${word}".`);
  if (name !== basename(resolve(dir))) problems.push(`name "${name}" differs from the folder name "${basename(resolve(dir))}".`);
}

const description = field('description');
if (!description) problems.push('frontmatter has no description, or it is empty.');
else {
  if (description.length > DESCRIPTION_MAX) problems.push(`description is ${description.length} characters; at most ${DESCRIPTION_MAX}.`);
  if (/<[a-zA-Z/][^>]*>/.test(description)) problems.push('description contains an XML tag; write the placeholder without angle brackets.');
  if (/^(I |I'm |You |We )/.test(description)) problems.push('description must be in the third person ("Checks…", not "I can…" / "You can…").');
  if (!/\b(use|used) (when|for|before|after|whenever)\b/i.test(description)) problems.push('description does not say when to use the skill ("Use when …").');
}

const bodyLines = body.split('\n').length;
if (bodyLines > BODY_MAX_LINES) problems.push(`body is ${bodyLines} lines; keep it under ${BODY_MAX_LINES} and move detail into referenced files.`);

// Links to files next to SKILL.md: they must exist, use forward slashes and not link onward.
const linkPattern = /\]\(([^)#\s]+)(?:#[^)]*)?\)/g;
function localLinks(markdown) {
  return [...markdown.matchAll(linkPattern)].map((m) => m[1]).filter((target) => !/^[a-z]+:/i.test(target));
}
if (/\b[\w.-]+\\[\w.-]+\.(md|mjs|js|py|sh|json)\b/.test(body)) problems.push('body has a Windows-style path with a backslash; use forward slashes.');
for (const target of localLinks(body)) {
  const path = join(dirname(skillFile), target);
  if (!path.startsWith(dirname(skillFile))) continue; // links into the repository are checked by docs-check
  if (!existsSync(path)) {
    problems.push(`link "${target}" points at a missing file.`);
    continue;
  }
  if (!target.endsWith('.md')) continue;
  const ref = readFileSync(path, 'utf8');
  const onward = localLinks(ref).filter((t) => t.endsWith('.md') && existsSync(join(dirname(path), t)) && join(dirname(path), t).startsWith(dirname(skillFile)));
  if (onward.length) problems.push(`"${target}" links on to ${onward.join(', ')}; link every reference directly from SKILL.md.`);
  const lines = ref.split('\n');
  if (lines.length > TOC_MIN_LINES && !/^#+\s*(contents|table of contents)/im.test(lines.slice(0, 30).join('\n'))) {
    problems.push(`"${target}" is ${lines.length} lines; put a "## Contents" list near the top.`);
  }
}

if (problems.length) {
  console.log(`${problems.length} problem(s) in ${skillFile}:`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}
console.log(`OK: ${skillFile}`);
