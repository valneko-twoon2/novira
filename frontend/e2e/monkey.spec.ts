// Monkey test: random clicks, double and right clicks, typing, keys and drags on whatever the open screen shows, one
// run per main screen of the mock app, from a fixed seed. After every action no area may have failed (an ErrorBoundary
// showing), the app must still be there, and the page must have logged no error (the `errors` fixture). Each screen is
// run with the mock's library and with an empty one (no models, pictures or boards), where empty states hide. A failure names
// the seed and the actions that led to it, so the same run can be repeated.
// NOVIRA_MONKEY_SEED changes the seed, NOVIRA_MONKEY_ACTIONS the number of actions per screen (default 60).
import type { Page } from '@playwright/test';
import { openApp, showTab, test } from './fixtures';

const SEED = Number(process.env.NOVIRA_MONKEY_SEED) || 20261031;
const ACTIONS = Number(process.env.NOVIRA_MONKEY_ACTIONS) || 60;

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;

/** What a monkey can act on. Links are left out (they leave the app); file inputs open nothing in a headless browser. */
const TARGETS = [
  'button:not([disabled])',
  '[role=tab]',
  '[role=menuitem]',
  '[role=option]',
  '[role=switch]',
  '[role=checkbox]',
  '[role=slider]',
  '[role=button]',
  'input:not([type=file]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'canvas',
].join(',');

const KEYS = ['Escape', 'Enter', 'Tab', 'Shift+Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Delete', 'Backspace', 'Home', 'End', 'PageDown', 'Control+z', 'Control+Shift+z', 'Control+a', 'Control+Enter', '1', '2', '5', '8', 'b', 'e', 'v', 'f', 'h', 'x', '[', ']'];

const TEXTS = ['', 'a', 'cat, 1girl', '0', '-1', '99999999', '1e309', 'NaN', '   ', '[fail]', '{{x}}', '{a|b}', '__wild__', '<b>x</b>', '../../x', '日本語のテキスト', '🙂👍', 'x'.repeat(3000), '\\', '"\'`', '‮'];

/** xorshift32: the same seed gives the same run. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}

interface Target {
  tag: string;
  type: string;
  label: string;
}

/** Marks every target a user could hit right now (in the window, not covered) and describes it. */
async function targets(page: Page): Promise<Target[]> {
  return page.evaluate((selector) => {
    for (const el of document.querySelectorAll('[data-monkey]')) el.removeAttribute('data-monkey');
    const out: { tag: string; type: string; label: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
      const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) continue;
      el.setAttribute('data-monkey', String(out.length));
      const label = el.dataset.testid ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
      out.push({ tag: el.tagName.toLowerCase(), type: (el as HTMLInputElement).type ?? '', label });
    }
    return out;
  }, TARGETS);
}

const TYPED = new Set(['text', 'search', 'number', 'url', 'email', 'password', 'textarea']);

/** One random action; returns what it did, for the log. A target that went away before the action is only noted. */
async function act(page: Page, next: () => number): Promise<string> {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const roll = next();
  if (roll < 0.12) {
    const key = pick(KEYS);
    await page.keyboard.press(key);
    return `press ${key}`;
  }
  if (roll < 0.17) {
    const dy = Math.round((next() - 0.5) * 1600);
    await page.mouse.move(next() * 1600, next() * 960);
    await page.mouse.wheel(0, dy);
    return `wheel ${dy}`;
  }
  const all = await targets(page);
  if (all.length === 0) return 'nothing to act on';
  const index = Math.floor(next() * all.length);
  const target = all[index]!;
  const el = page.locator(`[data-monkey="${index}"]`);
  const what = `${target.tag}${target.type ? `[${target.type}]` : ''} "${target.label}"`;
  const timeout = 1500;
  try {
    if (target.tag === 'select') {
      const count = await el.locator('option').count();
      if (count > 0) await el.selectOption({ index: Math.floor(next() * count) }, { timeout });
      return `select in ${what}`;
    }
    if (target.tag === 'textarea' || (target.tag === 'input' && TYPED.has(target.type))) {
      const text = target.type === 'number' ? String(Math.round((next() - 0.3) * 5000)) : pick(TEXTS);
      await el.fill(text, { timeout });
      if (next() < 0.3) await el.press('Enter', { timeout });
      return `type ${JSON.stringify(text.slice(0, 20))}${text.length > 20 ? `…(${text.length})` : ''} into ${what}`;
    }
    if (target.tag === 'canvas') {
      const box = await el.boundingBox();
      if (!box) return `canvas gone ${what}`;
      const [x0, y0, x1, y1] = [next(), next(), next(), next()].map((f, i) => (i % 2 ? box.y + f * box.height : box.x + f * box.width));
      await page.mouse.move(x0!, y0!);
      await page.mouse.down();
      await page.mouse.move(x1!, y1!, { steps: 5 });
      await page.mouse.up();
      return `drag on ${what}`;
    }
    const how = next();
    if (how < 0.1) {
      await el.dblclick({ timeout });
      return `double click ${what}`;
    }
    if (how < 0.18) {
      await el.click({ button: 'right', timeout });
      return `right click ${what}`;
    }
    await el.click({ timeout });
    return `click ${what}`;
  } catch {
    return `(could not act on ${what})`;
  }
}

const RUNS = TABS.flatMap((tab) => [
  { tab, query: '', library: 'the mock library' },
  { tab, query: '?scenario=empty', library: 'an empty library' },
]);

for (const [n, { tab, query, library }] of RUNS.entries()) {
  test(`random actions on the ${tab} screen with ${library} break nothing`, async ({ page, errors }, testInfo) => {
    // An action takes well under a second alone, up to about three with six workers on a busy machine.
    test.setTimeout(30_000 + ACTIONS * 3_000);
    const seed = SEED + n;
    const next = random(seed);
    // A page the app opens (a source page, a model's site) is closed: only the app is under test.
    page.context().on('page', (other) => void other.close());
    await openApp(page, query);
    await showTab(page, tab);
    const log: string[] = [];
    try {
      for (let i = 0; i < ACTIONS; i++) {
        const started = Date.now();
        log.push(await act(page, next));
        if (process.env.NOVIRA_MONKEY_TRACE) console.log(`${i + 1}. ${log.at(-1)} (${Date.now() - started} ms)`);
        const failed = await page.getByTestId('error-boundary').count();
        // A reload the screen asked for (after a data change) takes the app away for a moment.
        const app = await page
          .locator('.app')
          .waitFor({ timeout: 20_000 })
          .then(
            () => true,
            () => false,
          );
        if (failed > 0 || !app || errors.length > 0) {
          const why = failed > 0 ? `an area failed: ${await page.getByTestId('error-boundary').first().innerText()}` : !app ? 'the app is gone' : errors.join('\n');
          throw new Error(`seed ${seed}, action ${i + 1}: ${why}\n${log.map((a, k) => `${k + 1}. ${a}`).join('\n')}`);
        }
      }
    } finally {
      // Also on a time-out: the action after the last one logged is the one that did not return.
      await testInfo.attach('actions', { body: `seed ${seed}\n${log.map((a, k) => `${k + 1}. ${a}`).join('\n')}`, contentType: 'text/plain' });
    }
  });
}
