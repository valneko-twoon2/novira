// The pure parts of the start-up measurement (tools/perf-startup.mjs): medians, blocking time of long tasks, which backend
// call waited for which, the options, and the summary of a Chrome trace.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { blocking, median, medians, parseArgs, recorded, traceSummary, waitedFor } from '../../tools/perf-startup.mjs';

describe('median', () => {
  it('takes the middle of an odd count and the upper middle of an even one, unsorted input', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(3);
  });

  it('skips missing values and is null for none', () => {
    expect(median([null, 2, undefined, Number.NaN])).toBe(2);
    expect(median([])).toBeNull();
  });

  it('medians per key, rounded to a tenth, null where no run has a number', () => {
    expect(medians([{ a: 1.04, b: null }, { a: 2.06 }, { a: 3 }])).toEqual({ a: 2.1, b: null });
  });
});

describe('blocking', () => {
  const tasks = [
    { start: 10, duration: 50 },
    { start: 100, duration: 120 },
    { start: 400, duration: 80 },
  ];

  it('counts the time over 50 ms of each task, the longest and the total', () => {
    expect(blocking(tasks)).toEqual({ count: 3, tbt: 100, longest: 120, total: 250 });
  });

  it('takes only the tasks that start inside the window, the end excluded', () => {
    expect(blocking(tasks, 100, 400)).toEqual({ count: 1, tbt: 70, longest: 120, total: 120 });
    expect(blocking(tasks, 401)).toEqual({ count: 0, tbt: 0, longest: 0, total: 0 });
  });
});

describe('waitedFor', () => {
  it('names the call that ended just before a call started, when nothing else was running', () => {
    const calls = [
      { name: 'bootstrap', start: 10, end: 300 },
      { name: 'load_canvas', start: 302, end: 320 },
      { name: 'list_comics', start: 321, end: 340 },
    ];
    expect(waitedFor(calls).map((c: { after: string | null }) => c.after)).toEqual([null, 'bootstrap', 'load_canvas']);
  });

  it('sees calls that overlap as parallel, and a late call after a gap as not waiting', () => {
    const calls = [
      { name: 'b', start: 12, end: 40 },
      { name: 'a', start: 10, end: 300 },
      { name: 'late', start: 900, end: 950 },
    ];
    expect(waitedFor(calls).map((c: { name: string; after: string | null }) => [c.name, c.after])).toEqual([
      ['a', null],
      ['b', null],
      ['late', null],
    ]);
  });
});

describe('parseArgs', () => {
  it('reads labelled and plain builds and the switches', () => {
    const o = parseArgs(['--via', 'mock', '--dist', 'base=/x/a', '--dist', '/x/b', '--runs', '9', '--switch', '--keep-floor', '--trace']);
    expect(o.via).toBe('mock');
    expect(o.dists.map((d: { label: string }) => d.label)).toEqual(['base', 'b']);
    expect([o.runs, o.switch, o.keepFloor, o.trace]).toEqual([9, true, true, true]);
  });

  it('refuses an unknown option, a wrong mode and a run count below one', () => {
    expect(() => parseArgs(['--fast'])).toThrow(/unknown option/);
    expect(() => parseArgs(['--via', 'tauri'])).toThrow(/server or mock/);
    expect(() => parseArgs(['--runs', '0'])).toThrow(/positive/);
  });
});

describe('traceSummary', () => {
  const thread = { name: 'thread_name', ph: 'M', pid: 1, tid: 7, args: { name: 'CrRendererMain' } };
  const nav = { name: 'navigationStart', ph: 'R', pid: 1, tid: 7, ts: 1_000_000 };
  const x = (name: string, ms: number, dur: number, tid = 7) => ({ name, ph: 'X', pid: 1, tid, ts: 1_000_000 + ms * 1000, dur: dur * 1000 });
  const comp = (message: string, start: number, end: number) => ({ name: 'TimeStamp', ph: 'I', pid: 1, tid: 7, ts: 0, args: { data: { track: 'Components ⚛', message, start, end } } });

  it('sums the main thread by event inside the window and leaves other threads out', () => {
    const s = traceSummary([thread, nav, x('Layout', 5, 2), x('Layout', 10, 3), x('Paint', 2000, 9), x('Layout', 6, 50, 8)], 0, 1000);
    expect(s.events).toEqual({ Layout: 5 });
  });

  it('gives each component its own time, nested children taken out', () => {
    const s = traceSummary([thread, nav, comp('App', 0, 10_000), comp('Grid', 2000, 8000), comp('Thumb', 3000, 4000)]);
    expect(s.components).toEqual({ Grid: 5, App: 4, Thumb: 1 });
  });

  it('is empty without a renderer thread that navigated', () => {
    expect(traceSummary([x('Layout', 1, 1)])).toEqual({ events: {}, components: {} });
  });
});

describe('recorded', () => {
  it('takes the own marks of the app and the first duration of each call, nothing without a recorder', () => {
    const rec = { marks: { 'stores-filled': 300 }, calls: [{ name: 'bootstrap', duration: 40 }, { name: 'bootstrap', duration: 9 }, { name: 'list_fonts', duration: 2 }] };
    expect(recorded(rec)).toEqual({ 'mark stores-filled': 300, 'call bootstrap': 40, 'call list_fonts': 2 });
    expect(recorded(null)).toEqual({});
  });
});
