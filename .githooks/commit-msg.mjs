// The check of the versioned Git commit-msg hook (.githooks/commit-msg): a commit message is a summary and a few bullets,
// not a report (.claude/rules/commit-messages.md).
//
//   node .githooks/commit-msg.mjs <message file>    exit 1 and list the problems when the message is too long or badly shaped
//
// Shape: line 1 is "<type>: <summary>" in Japanese (a Conventional Commits type such as feat, fix, docs or chore, an
// optional "(scope)" and "!", at most 72 characters, no full stop); then, only if needed, a blank line and a single block
// of "- " bullets (at most 8 lines of at most 100 characters); then, after a blank line, trailers (but never Co-Authored-By: the repository's commits carry no co-author line).
// The summary and every bullet are written in Japanese. Only the messages Git writes itself ("Merge branch '...'",
// "Revert \"...\"", fixup!, squash!, amend!) are not checked; a merge written by hand follows the
// same shape. What it cannot see: whether the bullets say the right thing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SUBJECT_MAX = 72;
export const BULLETS_MAX = 8;
export const BULLET_WIDTH_MAX = 100;

/** The types line 1 may start with (Conventional Commits). */
export const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const EXEMPT = /^(Merge (branch|remote-tracking branch|tag|pull request) |Revert "|fixup! |squash! |amend! )/;
const HEADER = /^([a-z]+)(\([\w./-]+\))?!?: (\S.*)$/;
/** Hiragana, katakana or a kanji: a line with none of them is not Japanese. */
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const TRAILER = /^[A-Za-z][A-Za-z-]*: \S/;
const CO_AUTHOR = /^co-authored-by:/im;
// Names of work branches (a subagent's worktree branch, a claude/ branch) and archive tags: the log does not need them.
const BRANCH_NAME = /\b(?:worktree-agent-\w+|claude\/[\w.-]+|archive\/[\w.-]+)/;

/** The problems of a commit message, one sentence each (an empty list means the message is fine). */
export function messageProblems(message, { branch = '' } = {}) {
  const lines = message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !l.startsWith('#'));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const subject = lines[0] ?? '';
  if (subject.trim() === '') return ['The summary (line 1) is empty.'];
  if (EXEMPT.test(subject)) return [];

  const problems = [];
  if (CO_AUTHOR.test(lines.join(String.fromCharCode(10)))) problems.push('Remove the Co-Authored-By line; commits here carry no co-author trailer.');
  if (subject.length > SUBJECT_MAX) problems.push(`Line 1 is ${subject.length} characters; keep the summary within ${SUBJECT_MAX}.`);
  if (/[.。]$/.test(subject)) problems.push('Line 1 ends with a full stop; drop it.');
  const header = HEADER.exec(subject);
  if (!header || !TYPES.includes(header[1])) problems.push(`Line 1 starts with a type and a colon: "<type>: ..." or "<type>(scope): ...", the type one of ${TYPES.join(', ')}.`);
  else if (!JAPANESE.test(header[3])) problems.push('Write the summary after the type in Japanese.');

  // Paragraphs after the summary: bullets, then optionally a block of trailers.
  const paragraphs = [];
  let current = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      if (current.length) paragraphs.push(current);
      current = [];
    } else current.push(line);
  }
  if (current.length) paragraphs.push(current);
  if (lines.length > 1 && lines[1].trim() !== '') problems.push('Put a blank line between the summary and the rest.');

  const last = paragraphs[paragraphs.length - 1];
  if (last && last.every((l) => TRAILER.test(l))) paragraphs.pop();
  if (paragraphs.length > 1) problems.push('After the summary write one block of "- " bullets only (no paragraphs, no blank lines inside).');
  const body = paragraphs.flat();
  const text = lines.join('\n');
  const named = BRANCH_NAME.exec(text)?.[0] ?? (branch && !/^(main|master|HEAD)$/.test(branch) && text.includes(branch) ? branch : '');
  if (named) problems.push(`The message names a branch or tag ("${named}"); say what the commit does, not where it was made.`);
  if (body.length > BULLETS_MAX) problems.push(`The body is ${body.length} lines; at most ${BULLETS_MAX} bullets. Keep the main points, drop the steps and file lists.`);
  for (const line of body) {
    if (!line.startsWith('- ')) problems.push(`Body line is not a bullet ("- ..."): "${line.slice(0, 40)}". One bullet is one line; do not wrap.`);
    else if (line.length > BULLET_WIDTH_MAX) problems.push(`A bullet is ${line.length} characters; at most ${BULLET_WIDTH_MAX}: "${line.slice(0, 40)}..."`);
    else if (!JAPANESE.test(line)) problems.push(`Write the bullet in Japanese: "${line.slice(0, 40)}"`);
  }
  return problems;
}

function currentBranch() {
  try {
    return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}

function main(argv) {
  const file = argv[0];
  if (!file) {
    console.error('usage: node .githooks/commit-msg.mjs <message file>');
    return 2;
  }
  const problems = messageProblems(readFileSync(file, 'utf8'), { branch: currentBranch() });
  if (problems.length === 0) return 0;
  console.error('commit-msg: the message does not follow .claude/rules/commit-messages.md:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Line 1: "<type>: <summary in Japanese>" in at most 72 characters (for example "fix: スマホで顔を直す画面を全画面にする").');
  console.error('Then, only if needed, up to 8 one-line "- " bullets in Japanese of what was done.');
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
