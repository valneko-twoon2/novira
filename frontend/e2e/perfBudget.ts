// Time budgets for the screens' frequent actions. A budget is a few times what the action takes on a normal machine, so a slow
// CI runner does not trip it and a real slowdown (an action that redraws more than it must) does. When one fails, the message
// says what to look at; measure with the browser's profiler (CDP `Profiler`) before changing anything.
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export interface Budget {
  /** What was measured, as a user would say it. */
  what: string;
  /** The limit in milliseconds. */
  ms: number;
  /** Where to look when it is over. */
  look: string;
}

/** What one run of an action cost: the time its code ran (`blocked`, the page cannot answer meanwhile) and until it was painted. */
export interface Cost {
  blocked: number;
  painted: number;
}

/** The median, so one slow frame (garbage collection) does not decide. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Fails with the budget's own words when `measured` is over it. */
export function withinBudget(budget: Budget, measured: number): void {
  const rounded = Math.round(measured);
  expect(rounded, `${budget.what} took ${rounded} ms (budget ${budget.ms} ms). Look at: ${budget.look}`).toBeLessThanOrEqual(budget.ms);
}

/**
 * Runs `act` in the page `times` times, one after another, and returns what each run cost. `act` is given the run number and
 * runs inside the page, so it must be self-contained.
 */
export async function costInPage(page: Page, act: (run: number) => void | Promise<void>, times: number): Promise<Cost[]> {
  return page.evaluate(
    async ([source, count]) => {
      const run = new Function(`return (${source})`)() as (n: number) => void | Promise<void>;
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const out: { blocked: number; painted: number }[] = [];
      for (let n = 0; n < count; n++) {
        const start = performance.now();
        await run(n);
        const blocked = performance.now() - start;
        await frame();
        await frame();
        out.push({ blocked, painted: performance.now() - start });
        // Let what the action started settle (timers, loading), so the next run is measured on its own.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return out;
    },
    [act.toString(), times] as const,
  );
}
