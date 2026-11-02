// The size limit of a cargo target folder's dev builds (scripts/tools/prune-target.mjs): measured at most once a day,
// cleaned only past the limit, never while a program from that folder runs.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { EVERY_MS, LIMIT_BYTES, STAMP, folderSize, planTargetPrune, pruneTarget, targetBusy } from '../../scripts/tools/prune-target.mjs';

const NOW = Date.UTC(2026, 10, 2);
const proc = (name: string, path: string) => ({ pid: 7, ppid: 0, name, path, cmd: '' });
const plan = (o: Record<string, unknown>) => planTargetPrune({ now: NOW, checkedAt: null, size: null, busy: '', ...o }).action;

describe('prune-target', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('measures at most once a day, unless forced', () => {
    expect(plan({ checkedAt: NOW - EVERY_MS + 1 })).toBe('wait');
    expect(plan({ checkedAt: NOW - EVERY_MS })).toBe('measure');
    expect(plan({ checkedAt: null })).toBe('measure');
    expect(plan({ checkedAt: NOW - 1, force: true })).toBe('measure');
  });

  it('cleans only past the limit, and never while the folder is in use', () => {
    expect(plan({ size: LIMIT_BYTES })).toBe('keep');
    expect(plan({ size: LIMIT_BYTES + 1 })).toBe('clean');
    expect(plan({ size: LIMIT_BYTES + 1, busy: 'novira.exe runs from it' })).toBe('skip');
    expect(plan({ size: 0, busy: 'novira.exe runs from it' })).toBe('keep');
    expect(plan({ size: 10, limit: 5 })).toBe('clean');
  });

  it('counts a program running from inside the folder as in use, not one from beside it', () => {
    const target = join('E:', 'r', 'backend', 'target');
    expect(targetBusy([proc('novira.exe', join(target, 'debug', 'novira.exe'))], target)).toMatch(/novira\.exe \(pid 7\)/);
    expect(targetBusy([proc('novira.exe', join('E:', 'r', 'artifacts', 'novira.exe')), proc('target.exe', join('E:', 'r', 'backend', 'target2', 'x.exe'))], target)).toBe('');
    expect(targetBusy([proc('System', '')], target)).toBe('');
    expect(targetBusy(null, target)).toMatch(/could not be listed/);
  });

  it('adds up the files of a folder tree', () => {
    dir = mkdtempSync(join(tmpdir(), 'prune-target-'));
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'x'), Buffer.alloc(10));
    writeFileSync(join(dir, 'a', 'b', 'y'), Buffer.alloc(32));
    expect(folderSize(dir)).toBe(42);
    expect(folderSize(join(dir, 'missing'))).toBe(0);
  });

  it('stamps the measurement and keeps a small dev build', () => {
    dir = mkdtempSync(join(tmpdir(), 'prune-target-'));
    mkdirSync(join(dir, 'debug'));
    writeFileSync(join(dir, 'debug', 'x'), Buffer.alloc(5));
    expect(pruneTarget({ target: dir, now: NOW }).action).toBe('keep');
    expect(pruneTarget({ target: dir, now: NOW + 1000 }).action).toBe('wait');
    expect(pruneTarget({ target: join(dir, 'none') }).reason).toBe('no dev build');
    rmSync(join(dir, STAMP));
    expect(pruneTarget({ target: dir, now: NOW, dryRun: true }).action).toBe('keep');
  });
});
