// The e2e lock (tools/e2e-lock.mjs) that keeps two heavy Playwright runs from sharing the machine, and the server choice
// and build cache of the e2e runs (frontend/scripts/e2e-server.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { acquire, commandLine, describeLock, isStale, lockPath, OLD_MS, takeOver } from '../../tools/e2e-lock.mjs';
// @ts-expect-error -- plain ESM script without types
import { buildDir, inputsHash, serverMode } from '../scripts/e2e-server.mjs';

const NOW = Date.UTC(2026, 9, 21, 12);
const owner = (extra: Record<string, unknown> = {}) => ({ pid: 4242, host: 'here', what: 'layout-scan', checkout: 'E:/repo', at: new Date(NOW - 60_000).toISOString(), ...extra });

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('e2e lock', () => {
  it('is held while its process lives on this machine, and stale once it is gone', () => {
    expect(isStale(owner(), NOW, NOW, () => true, 'here')).toBe(false);
    expect(isStale(owner(), NOW, NOW, () => false, 'here')).toBe(true);
    expect(isStale(owner({ pid: 'x' }), NOW, NOW, () => true, 'here')).toBe(true);
  });

  it('trusts another machine only until the age limit, and takes over any lock older than it', () => {
    expect(isStale(owner({ host: 'there' }), NOW, NOW, () => false, 'here')).toBe(false);
    expect(isStale(owner({ at: new Date(NOW - OLD_MS - 1).toISOString() }), NOW, NOW, () => true, 'here')).toBe(true);
    expect(isStale(owner({ at: new Date(NOW - OLD_MS + 60_000).toISOString() }), NOW, NOW, () => true, 'here')).toBe(false);
    expect(isStale(owner({ at: 'not a date' }), NOW, NOW, () => true, 'here')).toBe(true);
  });

  it('waits a minute for the owner record of a lock just made, then takes it over', () => {
    expect(isStale(null, NOW - 30_000, NOW)).toBe(false);
    expect(isStale(null, NOW - 61_000, NOW)).toBe(true);
  });

  it('lives in the main checkout work folder unless NOVIRA_E2E_LOCK names one', () => {
    expect(lockPath({ NOVIRA_E2E_LOCK: 'X:/lock' })).toBe('X:/lock');
    expect(lockPath({}).replaceAll('\\', '/')).toMatch(/\/novira-data\/work\/e2e-lock$/);
  });

  it('is taken, described, released, and waits while another live process holds it', async () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-lock-'));
    const lock = join(dir, 'lock');
    const release = await acquire({ dir: lock, what: 'test run', log: () => {} });
    expect(JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'))).toMatchObject({ pid: process.pid, what: 'test run' });
    expect(describeLock(lock)).toContain('held by test run');
    // Held by this live process: a second taker gives up after its wait.
    await expect(acquire({ dir: lock, waitMs: 50, pollMs: 10, log: () => {} })).rejects.toThrow(/gave up waiting/);
    release();
    expect(existsSync(lock)).toBe(false);
    expect(describeLock(lock)).toContain('free');
  });

  it('takes over a lock whose process is gone', async () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-lock-'));
    const lock = join(dir, 'lock');
    mkdirSync(lock);
    // A process id that does not exist (larger than any Windows or Linux one).
    writeFileSync(join(lock, 'owner.json'), JSON.stringify(owner({ pid: 2 ** 31 - 2, host: undefined, at: new Date().toISOString() })));
    const lines: string[] = [];
    const release = await acquire({ dir: lock, waitMs: 1000, pollMs: 10, log: (l: string) => lines.push(l) });
    expect(lines.join('\n')).toContain('taking over a stale lock');
    expect(JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8')).pid).toBe(process.pid);
    release();
  });
});

describe('taking over a stale lock', () => {
  it('removes the lock that was judged stale, and puts back a fresh one another waiter made meanwhile', () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-lock-'));
    const lock = join(dir, 'lock');
    const stale = owner({ pid: 1, at: '2026-01-01T00:00:00.000Z' });
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify(stale));
    takeOver(lock, stale);
    expect(existsSync(lock)).toBe(false);
    // The other waiter was first: the lock is now its own, and this one's late takeover must leave it alone.
    const fresh = owner({ pid: process.pid, at: new Date().toISOString() });
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify(fresh));
    takeOver(lock, stale);
    expect(JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'))).toEqual(fresh);
    expect(readdirSync(dir)).toEqual(['lock']);
  });
});

describe('the command line a command is run with', () => {
  it('quotes an argument with a space or a character cmd.exe acts on, and leaves a plain one alone', () => {
    expect(commandLine(['npx', 'playwright', 'test', '--grep', 'a b', 'x&y', '--workers=2', ''])).toBe('npx playwright test --grep "a b" "x&y" "--workers=2" ""');
    expect(() => commandLine(['node', 'say "hi"'])).toThrow(/double quote/);
  });

  it.runIf(process.platform === 'win32')('keeps each argument whole through cmd.exe and runs nothing after &', () => {
    const line = commandLine([process.execPath, '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', 'a b', 'c&echo INJECTED']);
    const out = spawnSync(line, { shell: true, encoding: 'utf8' }).stdout;
    expect(out.trim()).toBe(JSON.stringify(['a b', 'c&echo INJECTED']));
  });
});

describe('e2e server', () => {
  it('serves the build to a run of the layout project only, the dev server otherwise', () => {
    expect(serverMode({}, ['node', 'playwright', 'test', '--project=layout'])).toBe('build');
    expect(serverMode({}, ['node', 'playwright', 'test', '--project', 'layout', '--workers=8'])).toBe('build');
    expect(serverMode({}, ['node', 'playwright', 'test', '--project=layout', '--project=chromium'])).toBe('dev');
    expect(serverMode({}, ['node', 'playwright', 'test', '--project=chromium'])).toBe('dev');
    expect(serverMode({}, ['node', 'playwright', 'test'])).toBe('dev');
  });

  it('follows E2E_SERVER, except that browser coverage always needs the dev server', () => {
    expect(serverMode({ E2E_SERVER: 'build' }, ['node', 'playwright', 'test'])).toBe('build');
    expect(serverMode({ E2E_SERVER: 'dev' }, ['node', 'playwright', 'test', '--project=layout'])).toBe('dev');
    expect(serverMode({ E2E_SERVER: 'nonsense' }, ['node', 'playwright', 'test', '--project=layout'])).toBe('build');
    expect(serverMode({ E2E_SERVER: 'build', E2E_COVERAGE: '1' }, ['node', 'playwright', 'test', '--project=layout'])).toBe('dev');
  });

  it('rebuilds when a file of the inputs changes, appears or is renamed, and not otherwise', () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-build-'));
    mkdirSync(join(dir, 'src', 'ui'), { recursive: true });
    writeFileSync(join(dir, 'src', 'ui', 'a.css'), 'a{}');
    writeFileSync(join(dir, 'index.html'), '<html>');
    writeFileSync(join(dir, 'other.txt'), 'not an input');
    const inputs = ['src', 'index.html', 'missing.json'];
    const first = inputsHash(dir, inputs);
    expect(inputsHash(dir, inputs)).toBe(first);
    writeFileSync(join(dir, 'other.txt'), 'changed');
    expect(inputsHash(dir, inputs)).toBe(first);
    writeFileSync(join(dir, 'src', 'ui', 'a.css'), 'a{color:red}');
    const changed = inputsHash(dir, inputs);
    expect(changed).not.toBe(first);
    writeFileSync(join(dir, 'src', 'ui', 'b.css'), '');
    expect(inputsHash(dir, inputs)).not.toBe(changed);
    rmSync(join(dir, 'src', 'ui', 'b.css'));
    expect(inputsHash(dir, inputs)).toBe(changed);
    rmSync(join(dir, 'src', 'ui', 'a.css'));
    writeFileSync(join(dir, 'src', 'ui', 'c.css'), 'a{color:red}');
    expect(inputsHash(dir, inputs)).not.toBe(changed);
  });

  it('keeps one build per checkout inside the work folder', () => {
    const a = buildDir('E:/Code/novira-wt-a').replaceAll('\\', '/');
    const b = buildDir('E:/Code/novira-wt-b').replaceAll('\\', '/');
    expect(a).toMatch(/\/novira-data\/work\/e2e-build\/novira-wt-a-[0-9a-f]{8}$/);
    expect(b).not.toBe(a);
  });
});
