// The layout scan's record and the pre-commit gate built on it (tools/layout-scan.mjs).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { defaultWorkers, fingerprint, gateMessage, indexFingerprint, isLayoutSource, parseArgs, parseStage, passed, readPasses, treeFingerprint, withPass } from '../../tools/layout-scan.mjs';

describe('layout source', () => {
  it('is css anywhere, ui/ and app/, feature components and the scan itself', () => {
    for (const path of ['frontend/src/theme/tokens.css', 'frontend/src/features/models/models-cards.css', 'frontend/src/ui/controls.tsx', 'frontend/src/ui/zoomMath.ts', 'frontend/src/app/Workspace.tsx', 'frontend/src/features/comic/ComicEditor.tsx', 'frontend/e2e/layout.spec.ts', 'frontend/e2e/layoutRules.ts', 'frontend/e2e/textFit.ts', 'frontend/scripts/e2e-server.mjs', 'frontend/playwright.config.ts']) {
      expect(isLayoutSource(path), path).toBe(true);
    }
  });

  it('is not tests, test support, feature logic, state, other specs or other folders', () => {
    for (const path of ['frontend/src/ui/controls.test.tsx', 'frontend/src/features/comic/ComicEditor.test.tsx', 'frontend/src/features/comic/comicStore.ts', 'frontend/src/state/ui.ts', 'frontend/src/backend/mock/canvas2dRecorder.testkit.ts', 'frontend/e2e/text-fit.spec.ts', 'frontend/src/i18n/locales/ja/app.json', 'tools/affected.mjs', 'backend/src/ui/a.css']) {
      expect(isLayoutSource(path), path).toBe(false);
    }
  });
});

describe('fingerprint', () => {
  it('depends on the content and path of layout source only, not on order or other files', () => {
    const a = fingerprint([
      ['frontend/src/ui/ui.css', '111'],
      ['frontend/src/app/App.tsx', '222'],
    ]);
    expect(fingerprint([['frontend/src/app/App.tsx', '222'], ['frontend/src/ui/ui.css', '111'], ['frontend/src/state/ui.ts', '999']])).toBe(a);
    expect(fingerprint([['frontend/src/app/App.tsx', '222'], ['frontend/src/ui/ui.css', '112']])).not.toBe(a);
    expect(fingerprint([['frontend/src/app/App.tsx', '222']])).not.toBe(a);
  });

  it('reads stage 0 of `git ls-files -s -z` and leaves out the sides of a conflict', () => {
    const out = ['100644 aaa 0\tfrontend/src/ui/ui.css', '100644 bbb 1\tfrontend/src/app/App.tsx', '100644 ccc 2\tfrontend/src/app/App.tsx', ''].join('\0');
    expect(parseStage(out)).toEqual([['frontend/src/ui/ui.css', 'aaa']]);
  });
});

describe('record of passes', () => {
  const pass = (fingerprint: string, locales = ['ja', 'en']) => ({ fingerprint, locales, head: 'h', at: 't' });

  it('keeps the newest pass of each fingerprint first, and at most twenty', () => {
    const many = Array.from({ length: 25 }, (_, i) => pass(`f${i}`));
    const after = withPass(many, pass('f3'));
    expect(after[0].fingerprint).toBe('f3');
    expect(after.filter((p: { fingerprint: string }) => p.fingerprint === 'f3')).toHaveLength(1);
    expect(after).toHaveLength(20);
  });

  it('counts a pass only when it ran in ja and en', () => {
    expect(passed([pass('x')], 'x')).toBe(true);
    expect(passed([pass('x', ['all', 'ja', 'en'])], 'x')).toBe(true);
    expect(passed([pass('x', ['ja'])], 'x')).toBe(false);
    expect(passed([pass('y')], 'x')).toBe(false);
    expect(passed([], 'x')).toBe(false);
  });

  it('reads a missing or broken record as no passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'layout-record-'));
    try {
      expect(readPasses(join(dir, 'none.json'))).toEqual([]);
      writeFileSync(join(dir, 'bad.json'), '{not json');
      expect(readPasses(join(dir, 'bad.json'))).toEqual([]);
      writeFileSync(join(dir, 'good.json'), JSON.stringify({ passes: [pass('x')] }));
      expect(readPasses(join(dir, 'good.json'))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('pre-commit gate', () => {
  it('lets a commit through that changes no layout source, whatever the record says', () => {
    expect(gateMessage(['frontend/src/state/ui.ts', 'docs/verification.md'], 'x', [])).toBeNull();
    expect(gateMessage([], 'x', [])).toBeNull();
  });

  it('refuses layout source without a pass on what is staged, and names the files and the command', () => {
    const text = gateMessage(['frontend/src/ui/ui.css', 'frontend/src/state/ui.ts'], 'staged', [{ fingerprint: 'older', locales: ['ja', 'en'] }]);
    expect(text).toContain('frontend/src/ui/ui.css');
    expect(text).not.toContain('frontend/src/state/ui.ts');
    expect(text).toContain('node tools/layout-scan.mjs');
    expect(gateMessage(['frontend/src/ui/ui.css'], 'staged', [{ fingerprint: 'staged', locales: ['ja'] }])).not.toBeNull();
  });

  it('lets layout source through with a pass on exactly what is staged', () => {
    expect(gateMessage(['frontend/src/ui/ui.css'], 'staged', [{ fingerprint: 'staged', locales: ['ja', 'en'] }])).toBeNull();
  });

  it('shortens a long list of files', () => {
    const paths = Array.from({ length: 12 }, (_, i) => `frontend/src/ui/f${i}.css`);
    expect(gateMessage(paths, 'x', [])).toContain('and 4 more');
  });
});

describe('command line', () => {
  it('takes the languages and --check, and passes the rest to Playwright', () => {
    expect(parseArgs([])).toEqual({ locales: 'ja,en', check: false, workers: null, extra: [] });
    expect(parseArgs(['--locales', 'all', '--grep', 'models'])).toEqual({ locales: 'all', check: false, workers: null, extra: ['--grep', 'models'] });
    expect(parseArgs(['--check']).check).toBe(true);
  });

  it('takes the workers as its own setting, so a run with other workers still records a pass', () => {
    expect(parseArgs(['--workers', '6'])).toMatchObject({ workers: 6, extra: [] });
    expect(parseArgs(['--workers=3', '--grep', 'x'])).toMatchObject({ workers: 3, extra: ['--grep', 'x'] });
    expect(parseArgs(['--workers', '0']).workers).toBeNull();
    expect(parseArgs(['--workers', 'many']).workers).toBeNull();
  });

  it('uses half the processors as workers, at least 2 and at most 6', () => {
    expect([1, 2, 4, 5, 8, 12, 16, 32].map((n) => defaultWorkers(n))).toEqual([2, 2, 2, 2, 4, 6, 6, 6]);
  });

  it('never takes more than 6 workers, even when asked for more', () => {
    expect(parseArgs(['--workers', '8']).workers).toBe(6);
    expect(parseArgs(['--workers=16']).workers).toBe(6);
    expect(parseArgs(['--workers', '3']).workers).toBe(3);
  });
});

describe('fingerprints of a real repository', () => {
  let repo = '';
  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
    repo = '';
  });

  it('match between the index and the working tree only when what is staged is what is on disk', () => {
    repo = mkdtempSync(join(tmpdir(), 'layout-repo-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    git('init', '-q');
    git('config', 'core.autocrlf', 'false');
    mkdirSync(join(repo, 'frontend/src/ui'), { recursive: true });
    writeFileSync(join(repo, 'frontend/src/ui/ui.css'), '.a { gap: 1px; }\n');
    writeFileSync(join(repo, 'frontend/src/ui/state.test.tsx'), 'test\n');
    git('add', '.');
    expect(indexFingerprint(repo)).toBe(treeFingerprint(repo));
    // An unstaged edit of layout source: the scan of the working tree is not a scan of the commit.
    writeFileSync(join(repo, 'frontend/src/ui/ui.css'), '.a { gap: 2px; }\n');
    expect(indexFingerprint(repo)).not.toBe(treeFingerprint(repo));
    git('add', '.');
    expect(indexFingerprint(repo)).toBe(treeFingerprint(repo));
    // A new file that is not staged yet counts on disk; a test file never counts.
    writeFileSync(join(repo, 'frontend/src/ui/new.css'), '.b {}\n');
    expect(indexFingerprint(repo)).not.toBe(treeFingerprint(repo));
    rmSync(join(repo, 'frontend/src/ui/new.css'));
    writeFileSync(join(repo, 'frontend/src/ui/state.test.tsx'), 'changed\n');
    expect(indexFingerprint(repo)).toBe(treeFingerprint(repo));
  });
});
