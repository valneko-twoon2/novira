// The repeat runner (scripts/tools/repeat-test.mjs): argument rules, how many runs start, what a failure reports, and that
// the real child-process path passes and fails with the command's own exit code.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { DEFAULT_TIMES, MAX_TIMES, parseArgs, repeat, runOnce, saveFailure, tail } from '../../scripts/tools/repeat-test.mjs';

type Run = { ok: boolean; code: number | null; output: string };
const pass: Run = { ok: true, code: 0, output: 'ok' };
const fail = (output: string): Run => ({ ok: false, code: 1, output });

describe('arguments', () => {
  it('defaults to 20 runs one after another, stopping at the first failure', { tags: ['condition'] }, () => {
    expect(parseArgs(['--', 'cargo', 'test'])).toEqual({ times: DEFAULT_TIMES, parallel: 1, stopOnFail: true, command: ['cargo', 'test'] });
    expect(DEFAULT_TIMES).toBe(20);
  });

  it('reads times, parallel with and without a number, and the stop switches', { tags: ['decision-table'] }, () => {
    expect(parseArgs(['--times', '5', '--parallel', '3', '--no-stop-on-fail', '--', 'x'])).toMatchObject({ times: 5, parallel: 3, stopOnFail: false });
    expect(parseArgs(['--parallel', '--', 'x'])).toMatchObject({ parallel: 4 });
    expect(parseArgs(['--no-stop-on-fail', '--stop-on-fail', '--', 'x'])).toMatchObject({ stopOnFail: true });
  });

  it('keeps the options of the command itself after the double dash', { tags: ['decision-table'] }, () => {
    expect(parseArgs(['--times', '2', '--', 'node', '--times', '9'])).toMatchObject({ times: 2, command: ['node', '--times', '9'] });
  });

  it('refuses a missing command, a bad count and an unknown option', { tags: ['error-guessing'] }, () => {
    expect(parseArgs([])).toHaveProperty('error');
    expect(parseArgs(['--times', '3'])).toHaveProperty('error');
    expect(parseArgs(['--times', '0', '--', 'x'])).toHaveProperty('error');
    expect(parseArgs(['--times', String(MAX_TIMES + 1), '--', 'x'])).toHaveProperty('error');
    expect(parseArgs(['--times', 'many', '--', 'x'])).toHaveProperty('error');
    expect(parseArgs(['--times'])).toHaveProperty('error');
    expect(parseArgs(['--parallel', '65', '--', 'x'])).toHaveProperty('error');
    expect(parseArgs(['--fast', '--', 'x'])).toHaveProperty('error');
  });

  it('accepts the limits', { tags: ['boundary'] }, () => {
    expect(parseArgs(['--times', '1', '--', 'x'])).toMatchObject({ times: 1 });
    expect(parseArgs(['--times', String(MAX_TIMES), '--', 'x'])).toMatchObject({ times: MAX_TIMES });
  });
});

describe('the series', () => {
  it('runs every time when all pass', { tags: ['condition'] }, async () => {
    const r = await repeat({ times: 7, run: async () => pass });
    expect(r).toEqual({ started: 7, passed: 7, failed: 0, firstFailure: null });
  });

  it('stops after the first failure by default and reports that run', { tags: ['condition'] }, async () => {
    const r = await repeat({ times: 10, run: async (i: number) => (i === 3 ? fail('boom') : pass) });
    expect(r.started).toBe(4);
    expect(r).toMatchObject({ passed: 3, failed: 1, firstFailure: { index: 3, output: 'boom' } });
  });

  it('goes on after a failure when told to, and still reports the first one', { tags: ['condition'] }, async () => {
    const r = await repeat({ times: 6, stopOnFail: false, run: async (i: number) => (i % 2 ? fail(`bad ${i}`) : pass) });
    expect(r).toMatchObject({ started: 6, passed: 3, failed: 3, firstFailure: { index: 1, output: 'bad 1' } });
  });

  it('never has more copies running than asked, and starts no new run after a failure', { tags: ['condition'] }, async () => {
    let live = 0;
    let most = 0;
    const r = await repeat({
      times: 12,
      parallel: 3,
      run: async (i: number) => {
        live++;
        most = Math.max(most, live);
        await new Promise((done) => setTimeout(done, 5));
        live--;
        return i === 4 ? fail('x') : pass;
      },
    });
    expect(most).toBe(3);
    expect(r.failed).toBe(1);
    expect(r.started).toBeLessThan(12);
  });

  it('does not start more copies than there are runs', { tags: ['condition'] }, async () => {
    let most = 0;
    let live = 0;
    await repeat({
      times: 2,
      parallel: 8,
      run: async () => {
        most = Math.max(most, ++live);
        await new Promise((done) => setTimeout(done, 5));
        live--;
        return pass;
      },
    });
    expect(most).toBe(2);
  });

  it('names the lowest failing run first when parallel copies finish out of order', { tags: ['error-guessing'] }, async () => {
    const r = await repeat({
      times: 2,
      parallel: 2,
      stopOnFail: false,
      run: async (i: number) => {
        await new Promise((done) => setTimeout(done, i === 0 ? 30 : 1));
        return fail(`run ${i}`);
      },
    });
    expect(r.firstFailure?.index).toBe(0);
  });
});

describe('output', () => {
  it('keeps the last lines only, without trailing blanks', { tags: ['condition'] }, () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n') + '\n\n';
    const lines = tail(text, 3).split('\n');
    expect(lines).toEqual(['line 97', 'line 98', 'line 99']);
    expect(tail('a\r\nb', 5)).toBe('a\nb');
  });

  describe('files', () => {
    let root = '';
    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'repeat-test-'));
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('saves a failing run under logs/repeat-test/ of the given root only', { tags: ['condition'] }, () => {
      const file = saveFailure('the output', root, new Date(Date.UTC(2026, 10, 7, 1, 2, 3)));
      expect(file.startsWith(join(root, 'logs', 'repeat-test'))).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe('the output');
      expect(existsSync(join(root, 'logs'))).toBe(true);
    });

    it('runs a real process: a pass, a failure with its own exit code and output, and a missing program', { tags: ['error-guessing'] }, async () => {
      const ok = await runOnce([process.execPath, '-e', 'console.log("hello")']);
      expect(ok).toMatchObject({ ok: true, code: 0 });
      expect(ok.output).toContain('hello');
      const bad = await runOnce([process.execPath, '-e', 'console.error("oops"); process.exit(3)']);
      expect(bad).toMatchObject({ ok: false, code: 3 });
      expect(bad.output).toContain('oops');
      const missing = await runOnce(['novira-no-such-program-xyz']);
      expect(missing.ok).toBe(false);
      expect(missing.output).toContain('could not start');
    });

    it('catches a command that fails only on its third run', { tags: ['error-guessing'] }, async () => {
      const counter = join(root, 'count');
      writeFileSync(counter, '0');
      const script = `const fs=require('fs');const n=Number(fs.readFileSync(${JSON.stringify(counter)},'utf8'))+1;fs.writeFileSync(${JSON.stringify(counter)},String(n));if(n===3){console.log('third');process.exit(1)}`;
      const r = await repeat({ times: 10, run: () => runOnce([process.execPath, '-e', script]) });
      expect(r).toMatchObject({ started: 3, passed: 2, failed: 1 });
      expect(r.firstFailure?.output).toContain('third');
    });
  });
});
