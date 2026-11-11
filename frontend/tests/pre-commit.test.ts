// The first check of the Git pre-commit hook (.githooks/pre-commit.mjs): what is never committed, even when forced past .gitignore.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HOOK = fileURLToPath(new URL('../../.githooks/pre-commit.mjs', import.meta.url));

describe('pre-commit refusal', () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'novira-pre-commit-'));
    execFileSync('git', ['-C', repo, 'init', '-q']);
    execFileSync('git', ['-C', repo, 'config', 'core.autocrlf', 'false']);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it.each(['logs/e2e/trace.zip', 'logs/coverage/report/index.html', 'novira-data/work/a.txt'])('refuses %s', { tags: ['equivalence'] }, (file) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), 'x\n');
    execFileSync('git', ['-C', repo, 'add', '-f', file]);
    const run = spawnSync(process.execPath, [HOOK], { cwd: repo, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`${file}  (user data or generated output)`);
  });
});
