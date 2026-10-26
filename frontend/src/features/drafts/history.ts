// What the draft history screen shows: the batches of a period and a model, found by their prompt or model, in the
// order asked for, split by the day they were started.
import { getLocale } from '@/i18n';
import type { DraftGroup } from '@/state/drafts';

/** How many of the latest batches are shown as tabs; the rest are on the history screen only. */
export const RECENT_GROUPS = 5;

export type HistoryPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'older';
export type HistorySort = 'newest' | 'oldest';

export const HISTORY_PERIODS: HistoryPeriod[] = ['all', 'today', 'yesterday', 'week', 'older'];

export const dayStart = (time: number) => {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** The start of the calendar day `n` days before `now`'s (a calendar day, so a day of 23 or 25 hours counts once). */
const daysBack = (now: number, n: number) => {
  const d = new Date(dayStart(now));
  d.setDate(d.getDate() - n);
  return d.getTime();
};

/** Whether a batch started at `time` falls in `period`, counted in calendar days back from `now` ("week" is the last 7 days). */
export function inPeriod(time: number, period: HistoryPeriod, now = Date.now()): boolean {
  const day = dayStart(time);
  switch (period) {
    case 'all':
      return true;
    case 'today':
      return day === daysBack(now, 0);
    case 'yesterday':
      return day === daysBack(now, 1);
    case 'week':
      return day > daysBack(now, 7);
    case 'older':
      return day <= daysBack(now, 7);
  }
}

/** The models the batches were drawn with, the most used first (then by name), with how many batches each. */
export function historyModels(groups: DraftGroup[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.params.modelName, (counts.get(g.params.modelName) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface HistoryQuery {
  period: HistoryPeriod;
  /** One model's batches only; null for every model. */
  model: string | null;
  /** Words that must all be in the prompts or the model name (any case). */
  text: string;
  sort: HistorySort;
}

/** The batches the query asks for, split by day in the order asked for (within a day too). */
export function historyDays(groups: DraftGroup[], q: HistoryQuery, now = Date.now()): { day: number; groups: DraftGroup[] }[] {
  const words = q.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = groups
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => inPeriod(g.createdAt, q.period, now) && (q.model === null || g.params.modelName === q.model))
    .filter(({ g }) => {
      const hay = [g.params.positivePrompt, g.params.negativePrompt ?? '', g.params.modelName].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    // Batches started in the same instant keep their order of starting.
    .sort((a, b) => (q.sort === 'newest' ? b.g.createdAt - a.g.createdAt || b.i - a.i : a.g.createdAt - b.g.createdAt || a.i - b.i));
  const days = new Map<number, DraftGroup[]>();
  for (const { g } of shown) {
    const day = dayStart(g.createdAt);
    days.set(day, [...(days.get(day) ?? []), g]);
  }
  return [...days].map(([day, list]) => ({ day, groups: list }));
}

/** "Today" and "yesterday" in the UI language, else the date with its weekday. */
export function dayLabel(day: number, now = Date.now()): string {
  const apart = Math.round((day - dayStart(now)) / 86_400_000);
  if (apart >= -1 && apart <= 0) return new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(apart, 'day');
  const sameYear = new Date(day).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(getLocale(), { year: sameYear ? undefined : 'numeric', month: 'short', day: 'numeric', weekday: 'short' }).format(day);
}

export const timeLabel = (time: number) => new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit' }).format(time);
