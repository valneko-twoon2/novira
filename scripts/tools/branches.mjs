// The two long-lived branches (docs/development.md, "ブランチと PR"). Work branches start from the work branch and go back into it by a
// squash-merged pull request; a release is a squash-merged pull request from the work branch into the release branch, and main is then
// merged back into develop. It imports nothing, so every tool and hook can read it.

/** Where work happens: work branches start here, and their pull requests go here (no CI, no CodeQL required). */
export const WORK_BRANCH = 'develop';

/** What is released: only a release pull request from the work branch goes here, on green CI and CodeQL. Tags are cut on it. */
export const RELEASE_BRANCH = 'main';
