// The manual's side of the pre-commit language check: when a staged change adds or rewrites a chapter in ja or en, the other
// one of the two must change with it, and every other language must either change the chapter too or list it in
// docs/manual/pending.json (node frontend/scripts/manual-pending.mjs add). Run by the pre-commit hook; by hand:
//   node frontend/scripts/check-manual-sync.mjs            (staged changes)
// A deliberate one-language fix (a typo in ja only) passes with NOVIRA_I18N_SINGLE_LOCALE=1 set for that commit.
// Limits: it sees which files changed, not whether a translation says the same as its source.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CHAPTER_NAME, PRIMARY_LOCALES } from './locales.mjs';

const PRIMARY = PRIMARY_LOCALES;

/**
 * What a commit leaves out. `staged` maps a language to the chapter files it changes; `pending` is the pending list the
 * commit will contain; `followers` are the languages besides ja and en.
 * @returns {string[]} one line per problem
 */
export function manualProblems(staged, pending, followers) {
  const problems = [];
  const changed = new Set(PRIMARY.flatMap((l) => staged[l] ?? []));
  for (const file of [...changed].sort()) {
    for (const l of PRIMARY) if (!(staged[l] ?? []).includes(file)) problems.push(`${l}/${file}: ja and en must change together`);
    for (const l of followers) {
      if ((staged[l] ?? []).includes(file) || (pending[l] ?? []).includes(file)) continue;
      problems.push(`${l}/${file}: neither translated nor listed in docs/manual/pending.json (run: node frontend/scripts/manual-pending.mjs add)`);
    }
  }
  return problems;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function main() {
  process.chdir(git(['rev-parse', '--show-toplevel']).trim());
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', 'docs/manual']).split('\0').filter(Boolean);
  const staged = {};
  for (const f of files) {
    const m = new RegExp(`^docs/manual/([^/]+)/(${CHAPTER_NAME})$`).exec(f);
    if (m) (staged[m[1]] ??= []).push(m[2]);
  }
  if (!PRIMARY.some((l) => staged[l]?.length)) return 0;
  let pending = {};
  try {
    pending = JSON.parse(git(['show', ':docs/manual/pending.json']));
  } catch {
    /* no list yet: nothing is pending */
  }
  const followers = git(['ls-files', 'docs/manual'])
    .split('\n')
    .map((p) => /^docs\/manual\/([^/]+)\//.exec(p)?.[1])
    .filter((l, i, a) => l && !PRIMARY.includes(l) && a.indexOf(l) === i);
  const problems = manualProblems(staged, pending, followers);
  if (!problems.length) return 0;
  if (process.env.NOVIRA_I18N_SINGLE_LOCALE === '1') {
    console.warn('check-manual-sync: NOVIRA_I18N_SINGLE_LOCALE=1, accepting a change in only some languages.');
    return 0;
  }
  console.error('check-manual-sync: the manual is not in step:');
  for (const p of problems) console.error(`  ${p}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
