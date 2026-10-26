import { describe, expect, it } from 'vitest';
import type { DraftGroup } from '@/state/drafts';
import { historyDays, historyModels, inPeriod } from './history';

const NOW = new Date(2026, 9, 26, 15, 0).getTime();
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();
const group = (id: string, createdAt: number, modelName = 'Anima', positivePrompt = 'a cat') => ({ id, createdAt, params: { modelName, positivePrompt, negativePrompt: 'blurry' }, candidates: [] }) as unknown as DraftGroup;
const ids = (days: { groups: DraftGroup[] }[]) => days.map((d) => d.groups.map((g) => g.id));
const all = { period: 'all', model: null, text: '', sort: 'newest' } as const;

describe('draft history', () => {
  it('counts the periods in calendar days back from now', () => {
    expect(inPeriod(at(26, 0), 'today', NOW)).toBe(true);
    expect(inPeriod(at(25, 23), 'today', NOW)).toBe(false);
    expect(inPeriod(at(25, 23), 'yesterday', NOW)).toBe(true);
    expect(inPeriod(at(24), 'yesterday', NOW)).toBe(false);
    // The last 7 days are today and the 6 before it; the 7th day back is earlier.
    expect(inPeriod(at(20), 'week', NOW)).toBe(true);
    expect(inPeriod(at(19), 'week', NOW)).toBe(false);
    expect(inPeriod(at(19), 'older', NOW)).toBe(true);
    expect(inPeriod(at(20), 'older', NOW)).toBe(false);
  });

  it('splits by day, newest or oldest first, keeping the starting order of batches of the same instant', () => {
    const groups = [group('a', at(25, 9)), group('b', at(26, 8)), group('c', at(25, 9)), group('d', at(25, 18))];
    expect(ids(historyDays(groups, all, NOW))).toEqual([['b'], ['d', 'c', 'a']]);
    expect(ids(historyDays(groups, { ...all, sort: 'oldest' }, NOW))).toEqual([['a', 'c', 'd'], ['b']]);
  });

  it('narrows by period, model and every word of the text, in the prompts or the model name', () => {
    const groups = [group('a', at(26), 'Anima', 'a cat on a roof'), group('b', at(26), 'SDXL', 'a dog'), group('c', at(18), 'Anima', 'a cat in snow')];
    expect(ids(historyDays(groups, { ...all, period: 'today' }, NOW)).flat()).toEqual(['b', 'a']);
    expect(ids(historyDays(groups, { ...all, model: 'Anima' }, NOW)).flat()).toEqual(['a', 'c']);
    expect(ids(historyDays(groups, { ...all, text: 'CAT  snow' }, NOW)).flat()).toEqual(['c']);
    expect(ids(historyDays(groups, { ...all, text: 'sdxl' }, NOW)).flat()).toEqual(['b']);
    expect(ids(historyDays(groups, { ...all, text: 'blurry' }, NOW)).flat()).toEqual(['b', 'a', 'c']);
    expect(historyDays(groups, { ...all, text: 'horse' }, NOW)).toEqual([]);
  });

  it('lists the models the most used first, then by name', () => {
    const groups = [group('a', 1, 'SDXL'), group('b', 2, 'Anima'), group('c', 3, 'Anima'), group('d', 4, 'Flux')];
    expect(historyModels(groups)).toEqual([
      { name: 'Anima', count: 2 },
      { name: 'Flux', count: 1 },
      { name: 'SDXL', count: 1 },
    ]);
  });
});
