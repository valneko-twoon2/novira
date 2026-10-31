// The whole test suite in one run (tools/full-check.mjs): its steps, its options and its report.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { formatReport, parseArgs, plan } from '../../tools/full-check.mjs';

describe('full-check', () => {
  it('runs the fast checks, the server tests, the mock against the backend, every Playwright project and the layout scan, in that order', () => {
    const names = plan().map((s: { name: string }) => s.name);
    expect(names[0]).toMatch(/^scripts\\check\.bat/);
    expect(names[1]).toBe('cargo test novira-server');
    expect(names[2]).toMatch(/diff-backends/);
    const playwright = plan()[3];
    expect(playwright.cwd).toBe('frontend');
    expect(playwright.args).toEqual(expect.arrayContaining(['--project=chromium', '--project=phone', '--project=webkit', '--project=visual']));
    expect(playwright.args[0]).toMatch(/e2e-lock\.mjs$/);
    expect(names[4]).toMatch(/^layout scan/);
    expect(plan({ browser: false })).toHaveLength(3);
  });

  it('takes only its own options', () => {
    expect(parseArgs([])).toEqual({ browser: true, list: false });
    expect(parseArgs(['--no-browser', '--list'])).toEqual({ browser: false, list: true });
    expect(() => parseArgs(['--fast'])).toThrow(/unknown option --fast/);
  });

  it('reports each step and the last lines of the failed ones', () => {
    const ok = formatReport([{ name: 'a', code: 0, ms: 90_000, tail: ['quiet'] }], 'T');
    expect(ok).toContain('All 1 steps passed.');
    expect(ok).toContain('| a | pass | 1.5 |');
    expect(ok).not.toContain('quiet');
    const bad = formatReport(
      [
        { name: 'a', code: 0, ms: 0, tail: [] },
        { name: 'b', code: 2, ms: 60_000, tail: ['error: x'] },
      ],
      'T',
    );
    expect(bad).toContain('**1 of 2 steps failed.**');
    expect(bad).toContain('| b | FAIL (exit 2) | 1.0 |');
    expect(bad).toContain('## b\n\n```text\nerror: x\n```');
  });
});
