// The test breakdown a CI run writes to its job summary (scripts/tools/ci-summary.mjs): cargo's per-binary results and
// Playwright's per-project counts. A missing input must not fail the run.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { cargoMarkdown, parseCargo, parsePlaywright, parseVitest, playwrightMarkdown, run, vitestMarkdown } from '../../scripts/tools/ci-summary.mjs';

const CARGO = [
  '     Running unittests src\\lib.rs (target\\debug\\deps\\novira_core-aaa.exe)',
  'running 3 tests',
  'test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.1s',
  '     Running tests\\comfy_client_jobs.rs (target\\debug\\deps\\comfy_client_jobs-bbb.exe)',
  'test result: FAILED. 5 passed; 2 failed; 1 ignored; 0 measured; 0 filtered out; finished in 1.0s',
  '   Doc-tests novira_core',
  'test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.0s',
].join('\r\n');

const spec = (file: string, tests: { projectName: string; status: string }[]) => ({ file, specs: [{ file, tests }], suites: [] });

describe('ci-summary', { tags: [] }, () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('reads one row per cargo test binary, with its name', { tags: ['equivalence'] }, () => {
    expect(parseCargo(CARGO)).toEqual([
      { name: 'src/lib.rs', passed: 3, failed: 0, ignored: 0 },
      { name: 'comfy_client_jobs.rs', passed: 5, failed: 2, ignored: 1 },
      { name: 'doc-tests novira_core', passed: 0, failed: 0, ignored: 0 },
    ]);
  });

  it('gives no rows for output without results', { tags: ['boundary', 'error-guessing'] }, () => {
    expect(parseCargo('')).toEqual([]);
    expect(parseCargo('error: could not compile')).toEqual([]);
  });

  it('totals a crate and folds the binaries behind it', { tags: ['equivalence', 'condition'] }, () => {
    const md = cargoMarkdown('cargo test', [{ name: 'novira-core', rows: parseCargo(CARGO), missing: false }, { name: 'novira-server', rows: [], missing: true }]);
    expect(md).toContain('**8 passed, 2 failed, 1 ignored** in 3 test binaries');
    expect(md).toContain('<b>novira-core</b>: 8 passed, 2 failed, 1 ignored (3 binaries)');
    expect(md).toContain('| comfy_client_jobs.rs | 5 | 2 | 1 |');
    expect(md).toContain('`novira-server`: no log');
  });

  it('counts a Playwright test once by its final status, per project and per file', { tags: ['equivalence'] }, () => {
    const report = {
      suites: [
        spec('a.spec.ts', [{ projectName: 'chromium', status: 'expected' }, { projectName: 'chromium', status: 'flaky' }, { projectName: 'phone', status: 'unexpected' }]),
        { file: 'b.spec.ts', specs: [], suites: [spec('b.spec.ts', [{ projectName: 'chromium', status: 'skipped' }])] },
      ],
    };
    const { projects, files } = parsePlaywright(report);
    expect(projects.get('chromium')).toEqual({ passed: 1, failed: 0, flaky: 1, skipped: 1 });
    expect(projects.get('phone')).toEqual({ passed: 0, failed: 1, flaky: 0, skipped: 0 });
    expect([...files.keys()].sort()).toEqual(['chromium a.spec.ts', 'chromium b.spec.ts', 'phone a.spec.ts']);
    expect(playwrightMarkdown('E2E', { projects, files })).toContain('**1 passed, 1 failed, 1 flaky, 1 skipped**');
  });

  it('counts a vitest report per folder and per file, whatever the path style', { tags: ['equivalence'] }, () => {
    const report = {
      testResults: [
        { name: String.raw`E:\Code\novira\frontend\src\state\a.test.ts`, assertionResults: [{ status: 'passed' }, { status: 'failed' }] },
        { name: '/home/runner/work/novira/frontend/src/state/b.test.ts', assertionResults: [{ status: 'passed' }, { status: 'pending' }] },
        { name: '/home/runner/work/novira/frontend/tests/c.test.ts', assertionResults: [{ status: 'todo' }] },
      ],
    };
    const { areas, files } = parseVitest(report);
    expect(areas.get('src/state')).toEqual({ passed: 2, failed: 1, skipped: 1 });
    expect(areas.get('tests/c.test.ts')).toEqual({ passed: 0, failed: 0, skipped: 1 });
    expect([...files.keys()].sort()).toEqual(['src/state/a.test.ts', 'src/state/b.test.ts', 'tests/c.test.ts']);
    const md = vitestMarkdown('vitest', { areas, files });
    expect(md).toContain('**2 passed, 1 failed, 2 skipped** in 3 test files');
    expect(md).toContain('| src/state | 2 | 1 | 1 |');
    expect(vitestMarkdown('x', parseVitest({}))).toContain('**0 passed, 0 failed, 0 skipped** in 0 test files');
  });

  it('says so, and does not throw, when an input is missing or is not JSON', { tags: ['error-guessing'] }, () => {
    dir = mkdtempSync(join(tmpdir(), 'ci-summary-'));
    expect(run(['playwright', 'E2E', join(dir, 'none.json')])).toContain('No report to read');
    writeFileSync(join(dir, 'bad.json'), 'not json');
    expect(run(['playwright', 'E2E', join(dir, 'bad.json')])).toContain('No report to read');
    expect(run(['cargo', 'cargo test', join(dir, 'novira-core.log')])).toContain('`novira-core`: no log');
    expect(run(['vitest', 'unit', join(dir, 'none.json')])).toContain('No report to read');
    expect(run(['bogus'])).toContain('usage');
  });

  it('names a crate by its log file', { tags: ['equivalence'] }, () => {
    dir = mkdtempSync(join(tmpdir(), 'ci-summary-'));
    writeFileSync(join(dir, 'novira-core.log'), CARGO);
    expect(run(['cargo', 'cargo test', join(dir, 'novira-core.log')])).toContain('<b>novira-core</b>');
  });
});
