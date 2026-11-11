// The stale-output policy of the harness (scripts/tools/prune-stale.mjs): which entry of novira-data/work/ and logs/ is old
// enough to delete, what is never touched (links, anything in use, a wrong root), the `.last-used` marker, and the guards of
// scripts/tools/verify-real-app.mjs that keep the isolated app away from the user's own data.
import { existsSync, lutimesSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { MARKER, assertRoot, lockHeld, markUsed, namedByProcesses, planPrune, prune, pruneAll, ruleFor, verifyAppRunning, workRoot } from '../../scripts/tools/prune-stale.mjs';
// @ts-expect-error -- plain ESM script without types
import { engineOff, guard, layout as verifyLayout, parseArgs as verifyArgs, shareModels, turnEngineOff } from '../../scripts/tools/verify-real-app.mjs';
// @ts-expect-error -- plain ESM script without types
import { pruneStale } from '../../.claude/hooks/commit-before-stop.mjs';

const DAY = 24 * 60 * 60 * 1000;
const proc = (name: string, path: string, cmd: string) => ({ pid: 1, ppid: 0, name, path, cmd });
const NOW = Date.UTC(2026, 9, 20);
const entry = (name: string, daysOld: number, extra: Record<string, unknown> = {}) => ({ name, usedAt: NOW - daysOld * DAY, link: false, busy: '', ...extra });
const actions = (entries: unknown[], opts?: unknown) => Object.fromEntries(planPrune(entries, NOW, opts).map((v: { name: string; action: string }) => [v.name, v.action]));

describe('prune policy', { tags: [] }, () => {
  it('gives each kind of entry its own limit, and short-lived scratch to everything else', { tags: ['equivalence'] }, () => {
    expect(ruleFor('verify-data').days).toBe(30);
    expect(ruleFor('verify-webview').days).toBe(30);
    expect(ruleFor('comfy-copy').days).toBe(30);
    expect(ruleFor('check-target').days).toBe(14);
    expect(ruleFor('perf-data').days).toBe(30);
    for (const name of ['perf-target', 'perf', 'server-target', 'layout-scan', 'release-notes']) expect(ruleFor(name).days).toBe(14);
    for (const name of ['coverage', 'mutation', 'manual', 'models-sweep', 'e2e-build']) expect(ruleFor(name).days).toBe(7);
    for (const name of ['live-test', 'verify-wf', 'verify-data2', 'shot.png', 'run.log', 'test1.mjs', 'x', 'perf-old', 'release-notes-old']) expect(ruleFor(name).days).toBe(3);
  });

  it('gives what lives in logs/ the days of its kind in novira-data/work/', { tags: ['equivalence'] }, () => {
    for (const name of ['coverage', 'mutation', 'models-sweep', 'perf', 'full-check', 'fuzz']) expect(ruleFor(name, true).days, name).toBe(ruleFor(name).days);
    for (const name of ['e2e', 'e2e-novira-wt-x', 'playwright-report']) expect(ruleFor(name, true).days, name).toBe(ruleFor('coverage').days);
  });

  it('has no rule for any other name in logs/, and keeps it however old', { tags: ['condition'] }, () => {
    for (const name of ['notes', 'e2e-', 'e2efoo', 'x-e2e', 'full-check-old', 'verify-data', 'manual', 'old.txt']) expect(ruleFor(name, true), name).toBeUndefined();
    expect(actions([entry('notes', 999), entry('coverage', 8)], { inLogs: true })).toEqual({ notes: 'keep', coverage: 'delete' });
  });

  it('deletes just over the limit and keeps just under it', { tags: ['boundary'] }, () => {
    expect(actions([entry('shot.png', 3), entry('a.log', 3.01)])).toEqual({ 'shot.png': 'keep', 'a.log': 'delete' });
    expect(actions([entry('coverage', 7), entry('manual', 7.5), entry('check-target', 14), entry('mutation', 14.1)])).toEqual({
      coverage: 'keep',
      manual: 'delete',
      'check-target': 'keep',
      mutation: 'delete',
    });
    expect(actions([entry('verify-data', 30), entry('comfy-copy', 31)])).toEqual({ 'verify-data': 'keep', 'comfy-copy': 'delete' });
  });

  it('does not treat a standing-environment look-alike as standing', { tags: ['error-guessing'] }, () => {
    expect(actions([entry('verify-data-old', 4), entry('verify-data', 4)])).toEqual({ 'verify-data-old': 'delete', 'verify-data': 'keep' });
  });

  it('skips a link, an entry in use, and everything while a verification app runs', { tags: ['condition'] }, () => {
    expect(actions([entry('a', 9, { link: true })])).toEqual({ a: 'skip' });
    expect(actions([entry('verify-data', 99, { busy: 'its novira.lock is held' })])).toEqual({ 'verify-data': 'skip' });
    expect(actions([entry('a', 9), entry('b', 1)], { verifyRunning: true })).toEqual({ a: 'skip', b: 'keep' });
  });

  it('reports the age and the limit with the verdict', { tags: ['equivalence'] }, () => {
    expect(planPrune([entry('a.log', 5)], NOW)[0]).toMatchObject({ action: 'delete', ageDays: 5, limitDays: 3 });
  });

  it('knows a verification exe by its folder, and a process by the entry it names', { tags: ['equivalence'] }, () => {
    const lines = [
      proc('novira.exe', 'C:\\Temp\\novira-verify\\debug\\novira.exe', '"C:\\Temp\\novira-verify\\debug\\novira.exe"'),
      proc('python.exe', 'E:\\r\\novira-data\\work\\comfy-copy\\python\\python.exe', 'python main.py'),
    ];
    expect(verifyAppRunning(lines, 'C:\\Temp\\novira-verify')).toBe(true);
    expect(verifyAppRunning(lines, 'C:\\Other')).toBe(false);
    expect(verifyAppRunning([proc('novira.exe', 'E:\\r\\backend\\target\\debug\\novira.exe', 'x')], 'C:\\Temp\\novira-verify')).toBe(false);
    expect([...namedByProcesses(lines, 'E:\\r\\novira-data\\work', ['comfy-copy', 'verify-data'])]).toEqual(['comfy-copy']);
  });
});

describe('prune on disk', { tags: [] }, () => {
  let repo: string;
  let work: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'novira-prune-'));
    work = join(repo, 'novira-data', 'work');
    mkdirSync(work, { recursive: true });
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const age = (path: string, days: number) => {
    const when = new Date(Date.now() - days * DAY);
    utimesSync(path, when, when);
  };
  const folderIn = (root: string, name: string, days: number, files = ['f.txt']) => {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    for (const f of files) {
      writeFileSync(join(dir, f), 'x');
      age(join(dir, f), days);
    }
    age(dir, days);
    return dir;
  };
  const folder = (name: string, days: number, files?: string[]) => folderIn(work, name, days, files);
  const none = () => [];

  it('refuses a root that is not exactly <repo>/novira-data/work', { tags: ['error-guessing'] }, () => {
    expect(workRoot(repo)).toBe(work);
    for (const bad of [join(repo, 'novira-data'), join(repo, 'out'), join(work, 'verify-data'), repo, '', join(repo, 'novira-data', 'models')]) {
      expect(() => assertRoot(bad, repo)).toThrow(/refusing/);
      expect(() => prune({ repo, root: bad, processes: none })).toThrow(/refusing/);
    }
    expect(() => assertRoot(work, repo)).not.toThrow();
  });

  it('does nothing when work/ does not exist', { tags: ['boundary'] }, () => {
    rmSync(work, { recursive: true });
    expect(prune({ repo, processes: none })).toEqual({ deleted: [], skipped: [], kept: [] });
  });

  it('deletes stale entries only, files and folders, and lists a dry run without deleting', { tags: ['scenario'] }, () => {
    folder('old-scratch', 10);
    folder('fresh-scratch', 0);
    folder('coverage', 8);
    folder('verify-data', 10);
    writeFileSync(join(work, 'old.png'), 'x');
    age(join(work, 'old.png'), 5);
    const lines: string[] = [];
    const dry = prune({ repo, dryRun: true, processes: none, log: (m: string) => lines.push(m) });
    expect(dry.deleted.sort()).toEqual(['coverage', 'old-scratch', 'old.png']);
    expect(lines.every((l) => l.startsWith('would delete '))).toBe(true);
    expect(existsSync(join(work, 'old-scratch'))).toBe(true);

    const done = prune({ repo, processes: none, log: (m: string) => lines.push(m) });
    expect(done.deleted.sort()).toEqual(['coverage', 'old-scratch', 'old.png']);
    expect(done.kept.sort()).toEqual(['fresh-scratch', 'verify-data']);
    expect(existsSync(join(work, 'old-scratch'))).toBe(false);
    expect(existsSync(join(work, 'old.png'))).toBe(false);
    expect(existsSync(join(work, 'verify-data', 'f.txt'))).toBe(true);
    expect(lines.some((l) => l.startsWith('deleted ') && l.includes('old-scratch'))).toBe(true);
  });

  it('measures the age from the .last-used marker, not from the files inside', { tags: ['condition'] }, () => {
    const marked = folder('verify-wf', 10);
    markUsed(marked);
    expect(readFileSync(join(marked, MARKER), 'utf8')).toMatch(/^\d{4}-/);
    const unmarkedOld = folder('verify-old', 10);
    const markedOldFiles = folder('live-a', 10);
    writeFileSync(join(markedOldFiles, MARKER), 'x');
    age(join(markedOldFiles, MARKER), 10);
    const result = prune({ repo, processes: none });
    expect(result.kept).toContain('verify-wf');
    expect(result.deleted.sort()).toEqual(['live-a', 'verify-old']);
    expect(existsSync(unmarkedOld)).toBe(false);
  });

  it('falls back to the newest top-level modification time without a marker', { tags: ['condition'] }, () => {
    folder('mixed', 10, ['a.txt']);
    writeFileSync(join(work, 'mixed', 'recent.txt'), 'x');
    expect(prune({ repo, processes: none }).kept).toEqual(['mixed']);
  });

  it('never follows or deletes a link, and skips an entry holding one', { tags: ['error-guessing'] }, () => {
    const outside = join(repo, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep.txt'), 'precious');
    symlinkSync(outside, join(work, 'linked'), 'junction');
    lutimesSync(join(work, 'linked'), new Date(Date.now() - 10 * DAY), new Date(Date.now() - 10 * DAY));
    const holder = folder('holder', 10);
    mkdirSync(join(holder, 'sub'));
    symlinkSync(outside, join(holder, 'sub', 'models'), 'junction');
    age(join(holder, 'sub'), 10);
    age(holder, 10);
    const result = prune({ repo, processes: none });
    expect(result.skipped.sort()).toEqual(['holder', 'linked']);
    expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
    expect(existsSync(holder)).toBe(true);
  });

  it('keeps everything when the running processes cannot be listed, and what a process names', { tags: ['error-guessing'] }, () => {
    folder('a-scratch', 10);
    expect(prune({ repo, processes: () => null }).skipped).toEqual(['a-scratch']);
    const named = folder('comfy-copy', 40);
    const result = prune({ repo, processes: () => [proc('python.exe', 'x', `python ${join(named, 'ComfyUI', 'main.py')}`)] });
    expect(result).toMatchObject({ deleted: ['a-scratch'], skipped: ['comfy-copy'] });
    expect(existsSync(named)).toBe(true);
  });

  it('keeps everything while a verification novira.exe runs', { tags: ['condition'] }, () => {
    folder('a-scratch', 10);
    const target = join(tmpdir(), 'novira-verify-test-target');
    const prev = process.env.NOVIRA_VERIFY_TARGET;
    process.env.NOVIRA_VERIFY_TARGET = target;
    try {
      const result = prune({ repo, processes: () => [proc('novira.exe', join(target, 'debug', 'novira.exe'), 'x')] });
      expect(result).toMatchObject({ deleted: [], skipped: ['a-scratch'] });
    } finally {
      if (prev === undefined) delete process.env.NOVIRA_VERIFY_TARGET;
      else process.env.NOVIRA_VERIFY_TARGET = prev;
    }
  });

  it('treats a lock file nobody holds as free, and a folder without one as free', { tags: ['error-guessing'] }, () => {
    const dir = folder('verify-lock', 0);
    expect(lockHeld(dir)).toBe(false);
    writeFileSync(join(dir, 'novira.lock'), '');
    expect(lockHeld(dir)).toBe(false);
  });

  it('is run by the Stop hook and reports only what it deleted', { tags: ['condition'] }, () => {
    expect(pruneStale(join(repo, 'missing.mjs'))).toEqual([]);
  });

  describe('of logs/', { tags: [] }, () => {
    let logs: string;
    beforeEach(() => {
      logs = join(repo, 'logs');
      mkdirSync(logs);
    });

    it('accepts exactly <repo>/logs as a root, never a folder that only looks like it', { tags: ['boundary'] }, () => {
      expect(() => assertRoot(logs, repo)).not.toThrow();
      for (const bad of [join(logs, 'coverage'), join(repo, 'logs2'), join(repo, 'frontend', 'logs'), join(repo, 'novira-data', 'logs')]) {
        expect(() => prune({ repo, root: bad, processes: none })).toThrow(/refusing/);
      }
    });

    it('deletes only the stale entries it knows, by the age of their kind', { tags: ['equivalence'] }, () => {
      const ages: Array<[string, number]> = [
        ['coverage', 8],
        ['mutation', 6],
        ['models-sweep', 8],
        ['e2e', 8],
        ['e2e-novira-wt-x', 8],
        ['playwright-report', 8],
        ['perf', 13],
        ['full-check', 4],
        ['fuzz', 2],
        ['notes', 400],
      ];
      for (const [name, days] of ages) folderIn(logs, name, days);
      writeFileSync(join(logs, 'old.txt'), 'x');
      age(join(logs, 'old.txt'), 400);
      const done = prune({ repo, root: logs, processes: none });
      expect(done.deleted.sort()).toEqual(['coverage', 'e2e', 'e2e-novira-wt-x', 'full-check', 'models-sweep', 'playwright-report']);
      expect(done.kept.sort()).toEqual(['fuzz', 'mutation', 'notes', 'old.txt', 'perf']);
      expect(existsSync(join(logs, 'notes', 'f.txt'))).toBe(true);
      expect(existsSync(join(logs, 'old.txt'))).toBe(true);
    });

    it('ages the coverage history with its entry, so a new run keeps an old history', { tags: ['condition'] }, () => {
      const coverage = folderIn(logs, 'coverage', 30);
      folderIn(coverage, 'history', 30);
      age(coverage, 30);
      expect(prune({ repo, root: logs, processes: none, dryRun: true }).deleted).toEqual(['coverage']);
      mkdirSync(join(coverage, 'report'));
      expect(prune({ repo, root: logs, processes: none }).kept).toEqual(['coverage']);
      expect(existsSync(join(coverage, 'history', 'f.txt'))).toBe(true);
    });

    it('measures the age from the .last-used marker, as in novira-data/work/', { tags: ['condition'] }, () => {
      markUsed(folderIn(logs, 'perf', 60));
      expect(prune({ repo, root: logs, processes: none }).kept).toEqual(['perf']);
    });

    it('never follows a link, and refuses a logs/ that is one', { tags: ['error-guessing'] }, () => {
      const outside = join(repo, 'outside');
      mkdirSync(outside);
      writeFileSync(join(outside, 'keep.txt'), 'precious');
      symlinkSync(outside, join(logs, 'e2e'), 'junction');
      lutimesSync(join(logs, 'e2e'), new Date(Date.now() - 10 * DAY), new Date(Date.now() - 10 * DAY));
      expect(prune({ repo, root: logs, processes: none }).skipped).toEqual(['e2e']);
      expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
      rmSync(logs, { recursive: true });
      symlinkSync(outside, logs, 'junction');
      expect(() => prune({ repo, root: logs, processes: none })).toThrow(/is a link/);
      expect(existsSync(join(outside, 'keep.txt'))).toBe(true);
    });

    it('keeps what a running process names, and everything when the processes cannot be listed', { tags: ['error-guessing'] }, () => {
      const e2e = folderIn(logs, 'e2e', 10);
      expect(prune({ repo, root: logs, processes: () => [proc('node.exe', 'x', `node ${join(e2e, 'trace.zip')}`)] }).skipped).toEqual(['e2e']);
      expect(prune({ repo, root: logs, processes: () => null }).skipped).toEqual(['e2e']);
      expect(existsSync(e2e)).toBe(true);
    });

    it('prunes novira-data/work/ and logs/ together from one list of the processes', { tags: ['scenario'] }, () => {
      folder('old-scratch', 10);
      folderIn(logs, 'fuzz', 10);
      folderIn(logs, 'notes', 10);
      let asked = 0;
      const processes = () => {
        asked += 1;
        return [];
      };
      expect(pruneAll({ repo, processes })).toEqual({ deleted: ['old-scratch', 'fuzz'], skipped: [], kept: ['notes'] });
      expect(asked).toBe(1);
    });

    it('prunes novira-data/work/ alone when logs/ does not exist', { tags: ['condition'] }, () => {
      rmSync(logs, { recursive: true });
      folder('old-scratch', 10);
      expect(pruneAll({ repo, processes: none }).deleted).toEqual(['old-scratch']);
      expect(existsSync(logs)).toBe(false);
    });

    it('deletes nothing in either folder while the processes cannot be listed', { tags: ['error-guessing'] }, () => {
      folder('old-scratch', 10);
      folderIn(logs, 'fuzz', 10);
      expect(pruneAll({ repo, processes: () => null })).toEqual({ deleted: [], skipped: ['old-scratch', 'fuzz'], kept: [] });
    });
  });
});

describe('verify-real-app guards', { tags: [] }, () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'novira-guard-'));
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));
  const layout = (data: string, webview: string) => ({ target: join(tmpdir(), 'tgt-elsewhere'), exe: join(tmpdir(), 'tgt-elsewhere', 'debug', 'novira.exe'), data, webview, comfyCopy: join(repo, 'novira-data', 'work', 'comfy-copy') });
  const work = () => join(repo, 'novira-data', 'work');

  it('accepts folders strictly inside novira-data/work/', { tags: ['boundary'] }, () => {
    expect(() => guard(layout(join(work(), 'verify-data'), join(work(), 'verify-webview')), repo)).not.toThrow();
  });

  it('refuses novira-data/ itself, work/ itself, and anything outside', { tags: ['error-guessing'] }, () => {
    const ok = join(work(), 'verify-webview');
    for (const data of [join(repo, 'novira-data'), work(), join(repo, 'out', 'x'), join(repo, 'novira-data', 'models'), join(repo, 'novira-data', 'workshop'), join(repo, '..', 'elsewhere')]) {
      expect(() => guard(layout(data, ok), repo)).toThrow(/refusing: data folder/);
    }
    for (const webview of [join(repo, 'novira-data'), work(), join(repo, 'out', 'w')]) {
      expect(() => guard(layout(join(work(), 'verify-data'), webview), repo)).toThrow(/refusing: WebView2/);
    }
  });

  it(
    'from a worktree, takes the data folder from the work folder of the main checkout and keeps the build out of both checkouts',
    { tags: ['condition'] },
    () => {
      const tree = join(repo, 'wt');
      const roots = { repo: tree, main: repo, work: work() };
      expect(() => guard(layout(join(work(), 'verify-data'), join(work(), 'verify-webview')), roots)).not.toThrow();
      expect(() => guard(layout(join(tree, 'novira-data', 'work', 'verify-data'), join(work(), 'verify-webview')), roots)).toThrow(/refusing: data folder/);
      for (const target of [join(tree, 'tgt'), join(repo, 'tgt')]) {
        expect(() => guard({ ...layout(join(work(), 'verify-data'), join(work(), 'verify-webview')), target, exe: join(target, 'debug', 'novira.exe') }, roots)).toThrow(/inside the repository/);
      }
    },
  );

  it('writes the user model folder into modelRoots once, keeping other settings', { tags: ['condition'] }, () => {
    const models = join(repo, 'novira-data', 'models');
    mkdirSync(models, { recursive: true });
    const data = join(work(), 'verify-data');
    const L = { data };
    expect(shareModels(L, models)).toBe(true);
    const file = join(data, 'settings.json');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ modelRoots: [models] });
    writeFileSync(file, JSON.stringify({ comfyuiDir: 'C:/copy/ComfyUI', modelRoots: ['D:/other'] }));
    shareModels(L, models);
    shareModels(L, models.toUpperCase());
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ comfyuiDir: 'C:/copy/ComfyUI', modelRoots: ['D:/other', models] });
  });

  it('writes nothing when the user model folder does not exist', { tags: ['condition'] }, () => {
    expect(shareModels({ data: join(work(), 'verify-data') }, join(repo, 'novira-data', 'models'))).toBe(false);
    expect(existsSync(join(work(), 'verify-data'))).toBe(false);
  });

  it('runs the release exe only when asked, and refuses unknown flags', { tags: ['error-guessing'] }, () => {
    expect(verifyLayout().exe).toMatch(/[\\/]debug[\\/]novira\.exe$/);
    expect(verifyLayout({ release: true }).exe).toMatch(/[\\/]release[\\/]novira\.exe$/);
    expect(verifyArgs(['t.mjs', '--release', '--no-engine', '--keep'])).toMatchObject({ release: true, noEngine: true, keep: true, build: false });
    expect(() => verifyArgs(['t.mjs', '--engine'])).toThrow(/usage/);
  });

  it(
    'turns the engine off: ComfyUI at the given closed address, no folder or Python, no Civitai lookup, the rest kept',
    { tags: ['equivalence'] },
    () => {
      const before = { comfyuiDir: 'C:/copy/ComfyUI', comfyuiPython: 'C:/py.exe', comfyuiUrl: 'http://127.0.0.1:8188', civitaiLookup: true, modelRoots: ['D:/m'] };
      expect(engineOff(before, 'http://127.0.0.1:1')).toEqual({ comfyuiUrl: 'http://127.0.0.1:1', civitaiLookup: false, modelRoots: ['D:/m'] });
    },
  );

  it('puts the settings file back as it was after --no-engine, or removes the one it created', { tags: ['state-transition'] }, async () => {
    const data = mkdtempSync(join(tmpdir(), 'novira-engine-off-'));
    try {
      const file = join(data, 'settings.json');
      const original = JSON.stringify({ comfyuiDir: 'C:/copy/ComfyUI', modelRoots: ['D:/m'] }, null, 2) + '\n';
      writeFileSync(file, original);
      const off = await turnEngineOff({ data });
      expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ comfyuiUrl: off.url, civitaiLookup: false });
      expect(JSON.parse(readFileSync(file, 'utf8'))).not.toHaveProperty('comfyuiDir');
      off.restore();
      expect(readFileSync(file, 'utf8')).toBe(original);
      rmSync(file);
      const created = await turnEngineOff({ data });
      expect(existsSync(file)).toBe(true);
      created.restore();
      expect(existsSync(file)).toBe(false);
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  });
});
