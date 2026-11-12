// The commits a release holds (`/release-notes` section 1): the commits on develop since the last release.
//   node scripts/tools/release-range.mjs [<last version>]    "<short id> <subject>" of each commit, newest first (the last version defaults to the
//                                                            newest tag on origin/main)
// A release is a squash merge of develop into main, so the tag's commit is not an ancestor of develop's own commits: `<tag>..origin/develop`
// would list every commit of every release again. The range starts at develop's own commit that prepared the last release instead
// (`chore: v<version> のリリースを用意する`, or `chore: v<version> をリリースする` for a release made before develop existed), found on the
// first-parent line of develop, where each pull request is one squash commit.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RELEASE_BRANCH, WORK_BRANCH } from './branches.mjs';

/** The subjects that mark the release of `version` on develop. */
export function releaseMarks(version) {
  return [`chore: v${version} のリリースを用意する`, `chore: v${version} をリリースする`];
}

/** The id of the newest commit (`commits`: [{ sha, subject }], newest first) that marks the release of `version`, or null. */
export function rangeStart(version, commits) {
  const marks = releaseMarks(version);
  return commits.find((c) => marks.includes(c.subject))?.sha ?? null;
}

/**
 * The commits of the range that belong in the release notes' reading: the squash commits that released an earlier version (they come back
 * on develop through the merge of main) are left out; merge commits are never listed.
 */
export function releaseCommits(commits) {
  return commits.filter((c) => !/^chore: v\d[^ ]* をリリースする$/.test(c.subject));
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

function main(argv) {
  git(['fetch', '-q', '--tags', 'origin', WORK_BRANCH, RELEASE_BRANCH]);
  const last = argv[0] ?? git(['describe', '--tags', '--abbrev=0', `origin/${RELEASE_BRANCH}`]).trim().replace(/^v/, '');
  const line = git(['log', '--first-parent', '--format=%H%x09%s', `origin/${WORK_BRANCH}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => ({ sha: l.split('\t')[0], subject: l.split('\t').slice(1).join('\t') }));
  const start = rangeStart(last, line);
  if (!start) {
    console.error(`release-range: no commit "${releaseMarks(last)[0]}" on the first-parent line of ${WORK_BRANCH}: use the commits since the date of v${last} (git log --since)`);
    return 1;
  }
  const commits = git(['log', '--no-merges', '--format=%h%x09%s', `${start}..origin/${WORK_BRANCH}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => ({ sha: l.split('\t')[0], subject: l.split('\t').slice(1).join('\t') }));
  for (const c of releaseCommits(commits)) console.log(`${c.sha} ${c.subject}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
