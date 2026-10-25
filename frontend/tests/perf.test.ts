// The pure parts of the speed measurement (tools/perf.mjs): its options, the noise rule of a comparison, the metrics read
// from each part's output, the IPC table, and the process check that proves the app started no engine.
import { describe, expect, it } from 'vitest';
import {
  appMetrics,
  appStartNumbers,
  backendMetrics,
  baselineName,
  busyPercent,
  compareMetrics,
  compareTable,
  descendants,
  engineProcesses,
  ipcRows,
  judge,
  loadLine,
  normalizeRoots,
  num,
  parseArgs,
  startupMetrics,
  startupUnit,
  stats,
  // @ts-expect-error -- plain ESM script without types
} from '../../tools/perf.mjs';

describe('options', () => {
  it('has the defaults and passes the start-up options through', () => {
    expect(parseArgs(['all'])).toMatchObject({ command: 'all', runs: 7, save: null, compare: null, build: true, startup: [] });
    const o = parseArgs(['startup', '--runs', '3', '--via', 'mock', '--switch', '--save', 'base', '--compare', 'old', '--no-build']);
    expect(o).toMatchObject({ runs: 3, save: 'base', compare: 'old', build: false, startup: ['--via', 'mock', '--switch'] });
  });

  it('refuses an unknown command or option, a bad run count, a missing value and a compare without a baseline', () => {
    expect(() => parseArgs(['speed'])).toThrow(/usage/);
    expect(() => parseArgs(['all', '--fast'])).toThrow(/unknown option/);
    for (const runs of ['0', '1.5', 'x']) expect(() => parseArgs(['all', '--runs', runs])).toThrow(/--runs/);
    expect(() => parseArgs(['all', '--save'])).toThrow(/needs a value/);
    expect(() => parseArgs(['compare'])).toThrow(/usage/);
    expect(parseArgs(['compare', 'base', 'now']).positional).toEqual(['base', 'now']);
  });

  it('takes only names that stay a file in the baseline folder', () => {
    expect(baselineName('base-1.2_x')).toBe('base-1.2_x');
    for (const bad of ['../x', 'a/b', 'a b', '.hidden', '']) expect(() => baselineName(bad)).toThrow(/not a usable name/);
  });
});

describe('noise rule', () => {
  const base = [100, 104, 98, 110, 101, 99, 103];

  it('takes the median, lowest and highest, skipping what is not a number', () => {
    expect(stats([3, null, 1, 2, Number.NaN])).toEqual({ n: 3, median: 2, min: 1, max: 3 });
    expect(stats([])).toEqual({ n: 0, median: null, min: null, max: null });
  });

  it('does not flag a run of the same code: the median stays inside the baseline range', () => {
    expect(judge('ms', base, [102, 99, 107, 100, 103, 101, 98]).flag).toBe('');
  });

  it('flags a time outside the range only when it also moved by 10 % and 2 ms', () => {
    expect(judge('ms', base, [125, 126, 124])).toMatchObject({ flag: 'slower', diff: 24 });
    expect(judge('ms', base, [80, 81, 79]).flag).toBe('faster');
    // Outside the range but under 10 %.
    expect(judge('ms', base, [111, 111, 111]).flag).toBe('');
    // 50 % but under 2 ms: a sub-millisecond call.
    expect(judge('ms', [0.2, 0.21, 0.19], [0.3, 0.31, 0.3]).flag).toBe('');
    expect(judge('ms', [0.2, 0.21, 0.19], [2.5, 2.6, 2.4]).flag).toBe('slower');
  });

  it('says higher or lower for counts, and changed for a size beyond 1 %', () => {
    expect(judge('count', [3, 3, 3], [5, 5, 5]).flag).toBe('higher');
    expect(judge('count', [3, 4, 3], [4, 4, 4]).flag).toBe('');
    expect(judge('bytes', [1000], [1005]).flag).toBe('');
    expect(judge('bytes', [1000], [1020]).flag).toBe('changed');
    expect(judge('chars', [1000], [900]).flag).toBe('changed');
  });

  it('marks a metric only one side has as new or gone', () => {
    expect(judge('ms', [], [1]).flag).toBe('new');
    expect(judge('ms', [1], []).flag).toBe('gone');
  });

  it('compares every key of either side and writes a table with the flag in bold', () => {
    const rows = compareMetrics({ a: { unit: 'ms', samples: base }, gone: { unit: 'ms', samples: [1] } }, { a: { unit: 'ms', samples: [130, 131] }, fresh: { unit: 'bytes', samples: [5] } });
    expect(rows.map((r: { key: string; flag: string }) => [r.key, r.flag])).toEqual([
      ['a', 'slower'],
      ['fresh', 'new'],
      ['gone', 'gone'],
    ]);
    const table = compareTable(rows);
    expect(table).toContain('| a | ms | 101.0 (98.0–110.0) | 131.0 (130.0–131.0) | 30.0 | 30 | **slower** |');
    expect(table).toContain('| fresh | bytes | - |');
  });

  it('never flags a metric that times other programs, and says so', () => {
    const [row] = compareMetrics({ 'backend agent_status call': { unit: 'ms', samples: [46, 47, 45] } }, { 'backend agent_status call': { unit: 'ms', samples: [270, 272, 268] } });
    expect(row).toMatchObject({ flag: '', note: 'other programs' });
    expect(compareTable([row])).toContain('| other programs |');
  });

  it('prints small numbers with more decimals', () => {
    expect([num(0.01234), num(3.456), num(123.45), num(null), num(5.5, 0)]).toEqual(['0.012', '3.46', '123.5', '-', '6']);
  });
});

describe('metrics of each part', () => {
  it('writes forward-slash model roots as this system would, and leaves other settings alone', () => {
    const resolve = (p: string) => p.replace(/\//g, '\\');
    expect(normalizeRoots({ modelRoots: ['E:/models', 'D:\\other'], civitaiLookup: false }, resolve)).toEqual({ modelRoots: ['E:\\models', 'D:\\other'], civitaiLookup: false });
    expect(normalizeRoots({ theme: 'dark' })).toEqual({ theme: 'dark' });
  });

  it('reads the backend example: open steps, the total, and each command with its size', () => {
    const m = backendMetrics({
      open: { database: [1, 2] },
      openTotal: [20, 21],
      commands: { bootstrap: { call: [2, 3], json: [1, 1], dispatch: [5, 6], bytes: 300 }, update_images: { call: [1], json: [0], dispatch: null, bytes: 10 } },
    });
    expect(m['backend open database']).toEqual({ unit: 'ms', samples: [1, 2] });
    expect(m['backend open total'].samples).toEqual([20, 21]);
    expect(m['backend bootstrap dispatch'].samples).toEqual([5, 6]);
    expect(m['backend bootstrap bytes']).toEqual({ unit: 'bytes', samples: [300] });
    expect(m).not.toHaveProperty(['backend update_images dispatch']);
  });

  it('reads perf-startup runs per build, with units by name, and the screen switches', () => {
    const raw = { current: { starts: [{ n: 1 }, { n: 2 }], switches: [{ 'cold tab-canvas': 30 }] } };
    const numbers = (s: { n: number }) => ({ appShown: 100 * s.n, bootstrapKB: 3000, callsTotal: 9, heapUsedMB: 16 });
    const m = startupMetrics(raw, numbers);
    expect(m['startup current appShown']).toEqual({ unit: 'ms', samples: [100, 200] });
    expect(m['startup current bootstrapKB'].unit).toBe('kB');
    expect(m['startup current callsTotal'].unit).toBe('count');
    expect(m['startup current heapUsedMB'].unit).toBe('MB');
    expect(m['startup current switch cold tab-canvas'].samples).toEqual([30]);
    expect(startupUnit('startCallsEnd')).toBe('ms');
  });

  it('reads one app start: marks, navigation, the reveal after the splash was opened, and the first time of each call', () => {
    const start = {
      marks: { 'stores-filled': 300, 'shell-visible': 2500, 'first-thumbnail': 2600 },
      nav: { responseEnd: 20, dcl: 60 },
      paint: { 'first-contentful-paint': 80 },
      clickAt: 2450,
      calls: [
        { name: 'bootstrap', duration: 40 },
        { name: 'bootstrap', duration: 10 },
      ],
    };
    expect(appStartNumbers(start)).toEqual({ 'stores-filled': 300, 'shell-visible': 2500, 'first-thumbnail': 2600, responseEnd: 20, domContentLoaded: 60, firstContentfulPaint: 80, reveal: 50, 'shown-to-thumbnail': 100, 'call bootstrap': 40 });
  });

  it('collects the app runs, the page start after spawn, and sizes from the recorded run only', () => {
    const page = (d: number) => ({ timeOrigin: 1000 + d, marks: { 'stores-filled': d }, calls: [{ name: 'bootstrap', duration: d }] });
    const m = appMetrics([
      { startedAt: 500, cold: page(10), warm: page(5) },
      { startedAt: 500, cold: page(20), warm: page(6), recorded: { calls: [{ name: 'bootstrap', duration: 9, size: 4000 }, { name: 'bootstrap', size: 1 }] } },
    ]);
    expect(m['app cold page-start'].samples).toEqual([510, 520]);
    expect(m['app warm call bootstrap'].samples).toEqual([5, 6]);
    expect(m['app size bootstrap']).toEqual({ unit: 'chars', samples: [4000] });
  });

  it('puts the window time of each call beside the backend time and their difference', () => {
    const s = (...samples: number[]) => ({ unit: 'ms', samples });
    const rows = ipcRows({ 'app cold call bootstrap': s(60), 'app warm call bootstrap': s(30), 'backend bootstrap call': s(2), 'backend bootstrap json': s(3), 'app size bootstrap': { unit: 'chars', samples: [9] }, 'app cold call list_fonts': s(4) });
    expect(rows).toEqual([
      { name: 'bootstrap', cold: 60, warm: 30, service: 5, overhead: 25, size: 9 },
      { name: 'list_fonts', cold: 4, warm: null, service: null, overhead: null, size: null },
    ]);
  });
});

describe('engine check', () => {
  const list = [
    { pid: 10, ppid: 1, name: 'novira.exe' },
    { pid: 11, ppid: 10, name: 'msedgewebview2.exe' },
    { pid: 12, ppid: 11, name: 'msedgewebview2.exe' },
    { pid: 20, ppid: 1, name: 'python.exe' },
  ];

  it('finds every process below the app, and none of the others', () => {
    expect(descendants(list, 10)).toEqual([
      { pid: 11, name: 'msedgewebview2.exe' },
      { pid: 12, name: 'msedgewebview2.exe' },
    ]);
    expect(engineProcesses(descendants(list, 10))).toEqual([]);
  });

  it('names a python under the app as an engine', () => {
    const started = [...list, { pid: 30, ppid: 10, name: 'python.exe' }];
    expect(engineProcesses(descendants(started, 10))).toEqual([{ pid: 30, name: 'python.exe' }]);
  });
});

describe('machine load', () => {
  const cpu = (idle: number, user: number) => ({ times: { user, nice: 0, sys: 0, idle, irq: 0 } });

  it('is the busy share of all processors between two readings', () => {
    expect(busyPercent([cpu(100, 0), cpu(100, 0)], [cpu(190, 10), cpu(130, 70)])).toBe(40);
    expect(busyPercent([cpu(5, 5)], [cpu(5, 5)])).toBeNull();
  });

  it('puts the baseline and the new load of each part on one line', () => {
    expect(loadLine({ app: { before: 3, during: 12 } }, { app: { before: 30, during: 41 }, backend: { before: 2, during: 9 } })).toBe(
      'Processor load: app 3 % before, 12 % during then 30 % before, 41 % during; backend not noted then 2 % before, 9 % during.',
    );
  });
});
