// Which heavy CI jobs a push needs (scripts/tools/ci-scope.mjs): a job is skipped only when nothing it reads changed, and
// every run that cannot be sure (default branch, schedule, new branch) runs everything.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { runsEverything, run, scopeOf } from '../../scripts/tools/ci-scope.mjs';

const NONE = { vitest: false, rust: false, e2e: false, diff: false };

describe('scopeOf', () => {
  it('runs nothing for a change that only touches docs', { tags: ['decision-table'] }, () => {
    expect(scopeOf(['docs/design/README.md', 'README.md'])).toEqual(NONE);
  });
  it('runs the frontend jobs for a screen change, not the Rust ones', { tags: ['decision-table'] }, () => {
    expect(scopeOf(['frontend/src/features/text/Text.tsx'])).toEqual({ ...NONE, vitest: true, e2e: true });
  });
  it('runs the Rust and mock-comparison jobs for a backend change, not vitest or the screen flows', { tags: ['decision-table'] }, () => {
    expect(scopeOf(['backend/crates/novira-core/src/api.rs'])).toEqual({ vitest: false, rust: true, e2e: false, diff: true });
  });
  it('treats a change of the mock as a change the comparison must see', { tags: ['decision-table'] }, () => {
    expect(scopeOf(['frontend/src/backend/mock/MockBackend.ts']).diff).toBe(true);
  });
  it('lets a change of the workflow itself run every job', { tags: ['decision-table'] }, () => {
    expect(scopeOf(['.github/workflows/test.yml'])).toEqual({ vitest: true, rust: true, e2e: true, diff: true });
  });
  it('matches a prefix only at a folder boundary', { tags: ['boundary'] }, () => {
    expect(scopeOf(['backend-notes.md', 'frontend-notes.md'])).toEqual(NONE);
  });
  it('runs nothing for an empty diff', { tags: ['boundary'] }, () => {
    expect(scopeOf([])).toEqual(NONE);
  });
});

describe('runsEverything', () => {
  const push = { event: 'push', ref: 'refs/heads/feature', defaultBranch: 'main', before: 'abc123' };
  it('narrows only an ordinary branch push', { tags: ['decision-table'] }, () => {
    expect(runsEverything(push)).toBe(false);
  });
  it('runs everything on the default branch', { tags: ['decision-table'] }, () => {
    expect(runsEverything({ ...push, ref: 'refs/heads/main' })).toBe(true);
  });
  it.each(['schedule', 'workflow_dispatch'])('runs everything on %s', { tags: ['decision-table'] }, (event) => {
    expect(runsEverything({ ...push, event })).toBe(true);
  });
  it('runs everything on a new branch (before is all zeros) or a missing before', { tags: ['error-guessing'] }, () => {
    expect(runsEverything({ ...push, before: '0000000000000000000000000000000000000000' })).toBe(true);
    expect(runsEverything({ ...push, before: '' })).toBe(true);
  });
});

describe('run', () => {
  it('writes name=value lines, all true on the default branch', { tags: ['decision-table'] }, () => {
    expect(run({ EVENT: 'push', REF: 'refs/heads/main', DEFAULT_BRANCH: 'main', BEFORE: 'abc', SHA: 'def' })).toBe('vitest=true\nrust=true\ne2e=true\ndiff=true');
  });
  it('falls back to everything when git cannot give the diff', { tags: ['error-guessing'] }, () => {
    expect(run({ EVENT: 'push', REF: 'refs/heads/x', DEFAULT_BRANCH: 'main', BEFORE: 'not-a-commit', SHA: 'not-a-commit-either' })).toBe('vitest=true\nrust=true\ne2e=true\ndiff=true');
  });
});
