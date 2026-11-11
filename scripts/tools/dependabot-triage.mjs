// Judges the open pull requests of Dependabot (docs/design/01-app/04-release/03-dependabot.md): a small update whose checks all passed is
// merged, an update that needs a person's judgement or has gone stale is closed with the reason, the rest wait.
//   node scripts/tools/dependabot-triage.mjs [--dry]     reads GH_REPO and GH_TOKEN (the `gh` command's own), changes nothing with --dry
// The decision is a pure function of the title, the labels, the age and the state of the checks; only `run` talks to GitHub.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** A pull request this old with no merge is closed: Dependabot makes a new one for the next version. */
export const STALE_DAYS = 21;

/** Workflows that must have passed on the head commit before a merge, and ones that count only when they ran. */
const REQUIRED = ['test.yml', 'supply-chain.yml'];
const OPTIONAL = ['audit.yml'];

const part = (s) => (s === undefined ? 0 : Number(s));

/**
 * `major`, `minor`, `patch` or `group` (the minor-and-patch group) for a Dependabot title; null when it names no versions.
 * A 0.x version has no stable API, so its minor bump counts as major.
 */
export function bumpKind(title) {
  if (/\bminor-and-patch group\b/i.test(title)) return 'group';
  const m = /\bfrom v?(\d+)(?:\.(\d+))?(?:\.(\d+))?\S* to v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(title);
  if (!m) return null;
  const [from, to] = [m.slice(1, 4).map((x) => part(x)), m.slice(4, 7).map((x) => part(x))];
  if (from[0] !== to[0]) return 'major';
  if (from[0] === 0 && from[1] !== to[1]) return 'major';
  return from[1] !== to[1] ? 'minor' : 'patch';
}

/**
 * What to do with one pull request: `{ action: 'merge' | 'close' | 'leave', reason }`.
 * `ci` is `success`, `failure`, `pending` or `none` (see `ciState`).
 */
export function decide({ title, labels = [], ageDays, ci }) {
  const kind = bumpKind(title);
  if (!kind) return { action: 'leave', reason: 'the title names no versions, so the size of the update is unknown' };
  const small = kind !== 'major';
  // A security update is never closed by a rule: a person reads it, and a small one whose checks passed is merged.
  if (labels.includes('security')) return small && ci === 'success' ? { action: 'merge', reason: 'a small security update and every check passed' } : { action: 'leave', reason: 'a security update waits for a person' };
  if (!small) return { action: 'close', reason: 'a major update needs a person to read its changes; Dependabot offers the next major version when there is one' };
  if (ci === 'success') return { action: 'merge', reason: `a ${kind} update and every check passed` };
  if (ageDays > STALE_DAYS) return { action: 'close', reason: `open for more than ${STALE_DAYS} days without passing; Dependabot opens a new one for the next version` };
  return { action: 'leave', reason: ci === 'failure' ? 'a check failed' : 'the checks have not finished' };
}

/** The state of the checks of one commit from the runs of the workflows (`{ workflow, headSha, status, conclusion }`). */
export function ciState(runs, sha) {
  const of = (file) => runs.filter((r) => r.workflow === file && r.headSha === sha);
  const state = (file) => {
    const own = of(file).filter((r) => r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
    if (own.length === 0) return 'none';
    if (own.some((r) => r.status !== 'completed')) return 'pending';
    return own.some((r) => r.conclusion !== 'success') ? 'failure' : 'success';
  };
  const states = [...REQUIRED.map(state), ...OPTIONAL.map(state).filter((s) => s !== 'none')];
  if (states.includes('failure')) return 'failure';
  if (states.includes('pending')) return 'pending';
  return states.every((s) => s === 'success') ? 'success' : 'none';
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });

function runsOf(branch, exec) {
  return REQUIRED.concat(OPTIONAL).flatMap((workflow) =>
    JSON.parse(exec(['run', 'list', '--workflow', workflow, '--branch', branch, '--limit', '10', '--json', 'headSha,status,conclusion'])).map((r) => ({ ...r, workflow })),
  );
}

/** `exec` runs `gh` with an argument list and gives its output; the tests pass a stand-in. */
export function run({ dry = false, now = Date.now(), log = console.log, exec = gh } = {}) {
  const prs = JSON.parse(exec(['pr', 'list', '--author', 'app/dependabot', '--state', 'open', '--limit', '50', '--json', 'number,title,labels,createdAt,headRefName,headRefOid']));
  for (const pr of prs) {
    const ageDays = (now - Date.parse(pr.createdAt)) / 86_400_000;
    const ci = ciState(runsOf(pr.headRefName, exec), pr.headRefOid);
    const { action, reason } = decide({ title: pr.title, labels: pr.labels.map((l) => l.name), ageDays, ci });
    log(`#${pr.number} ${action} (${reason}): ${pr.title}`);
    if (dry || action === 'leave') continue;
    if (action === 'merge') exec(['pr', 'merge', String(pr.number), '--squash', '--delete-branch']);
    else exec(['pr', 'close', String(pr.number), '--delete-branch', '--comment', `Closed by scripts/tools/dependabot-triage.mjs: ${reason}.`]);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) run({ dry: process.argv.includes('--dry') });
