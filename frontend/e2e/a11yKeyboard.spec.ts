// Keyboard checks that axe does not make, on the mock backend: Tab through every main tab (bounded) and require that focus is
// drawn on every stop, that every visible control is a stop, that no positive tabindex bends the order, and that the menus and
// dialogs hold focus inside while open, let go on Escape and give focus back to what opened them. A fault that exists today is
// listed in a11yKeyboardKnown.ts; the lists only get shorter (an entry that no longer happens fails the run until it is removed).
import type { Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';
import { expectedTabStops, readFocus, type FocusInfo } from './a11yKeyboard';
import { KNOWN_NO_FOCUS_RING, KNOWN_UNREACHED, KNOWN_ESCAPE } from './a11yKeyboardKnown';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;
/** Tab presses per screen; the loop ends earlier when focus comes back to where it started. */
const MAX_STEPS = 300;
/** Presses that must stay inside an open dialog. */
const TRAP_STEPS = 60;
/** How many times the order may jump back up the screen (a new panel starts at the top again). */
const MAX_BACK_JUMPS = 12;

interface Walk {
  stops: FocusInfo[];
  wrapped: boolean;
}

/** Presses Tab from the page start until focus returns to the first stop or the step bound is reached. */
async function walk(page: Page): Promise<Walk> {
  // A focus ring that fades in would be read half drawn.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: FocusInfo[] = [];
  // Tab starts after the last click, so the first pass ends at the page end (focus goes to the browser, read as null) and the
  // second pass covers the part before the click; it ends when a stop comes round again.
  let ends = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    await page.keyboard.press('Tab');
    const now = await readFocus(page);
    if (!now) {
      if (++ends >= 4) return { stops, wrapped: true };
      continue;
    }
    if (stops.some((s) => s.order === now.order)) return { stops, wrapped: true };
    stops.push(now);
  }
  return { stops, wrapped: false };
}

function report(kind: string, surface: string, items: string[]): void {
  if (process.env.A11Y_REPORT) for (const k of items) console.log(`A11Y-KB ${kind} | ${surface} | ${k}`);
}

/** Fails on an item beyond the known list, and on a known item that no longer happens. */
function ratchet(what: string, surface: string, found: string[], known: string[] | undefined): void {
  report(what, surface, found);
  const set = new Set(known ?? []);
  expect(found.filter((k) => !set.has(k)), `${what} on "${surface}" beyond a11yKeyboardKnown.ts`).toEqual([]);
  expect([...set].filter((k) => !found.includes(k)), `known ${what} on "${surface}" that no longer happens (delete the entry)`).toEqual([]);
}

for (const tab of TABS) {
  test(`${tab} tab: Tab reaches every control, draws focus and keeps its order`, async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page);
    await showTab(page, tab);
    await page.waitForTimeout(300);
    const before = await expectedTabStops(page);
    const { stops, wrapped } = await walk(page);
    // Only what is there both before and after the walk: a list that loads more as it scrolls changes its own buttons.
    const after = new Set(await expectedTabStops(page));
    const expected = before.filter((k) => after.has(k));
    if (process.env.A11Y_REPORT) console.log(`A11Y-KB walk | ${tab} | ${stops.length} stops: ${stops.map((s) => s.key).join(' > ')}`);
    expect(stops.length, 'Tab found nothing to focus').toBeGreaterThan(3);
    expect(wrapped, `Tab did not come back to the start within ${MAX_STEPS} presses (a trap or a very long page)`).toBe(true);
    expect(stops.filter((s) => s.tabindex !== null && s.tabindex > 0).map((s) => s.key), 'a positive tabindex bends the order').toEqual([]);

    ratchet('no focus indicator', tab, [...new Set(stops.filter((s) => !s.indicator).map((s) => s.key))].sort(), KNOWN_NO_FOCUS_RING[tab]);

    const visited = new Set(stops.map((s) => s.key));
    ratchet('control not reached by Tab', tab, [...new Set(expected.filter((k) => !visited.has(k)))].sort(), KNOWN_UNREACHED[tab]);

    let back = 0;
    for (let i = 1; i < stops.length; i++) if (stops[i]!.top < stops[i - 1]!.top - 200 && stops[i]!.left < stops[i - 1]!.left) back++;
    expect(back, 'Tab jumps back up and to the left too often (focus order far from reading order)').toBeLessThanOrEqual(MAX_BACK_JUMPS);
  });
}

async function openSettingsMenuItem(page: Page, key: string): Promise<void> {
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('menuitem', { name: msg(key) }).click();
}

interface Layer {
  /** The control that opens it. */
  opener: (page: Page) => ReturnType<Page['locator']>;
  open: (page: Page) => Promise<void>;
  /** True when the layer is modal: Tab must never leave it. */
  modal: boolean;
  shown: (page: Page) => ReturnType<Page['locator']>;
}

/** The whole dialog, title and close button included (the test ids name only its body). */
const DIALOG = (p: Page) => p.getByRole('dialog');

const SETTINGS_BUTTON = (p: Page) => p.getByRole('button', { name: msg('app.nav.settingsMenu') });

const LAYERS: Record<string, Layer> = {
  'settings menu': { opener: SETTINGS_BUTTON, open: async (p) => { await SETTINGS_BUTTON(p).click(); }, modal: false, shown: (p) => p.getByRole('menu') },
  'settings dialog': { opener: SETTINGS_BUTTON, open: (p) => openSettingsMenuItem(p, 'app.nav.settings'), modal: true, shown: (p) => p.getByTestId('settings-modal') },
  'hotkeys dialog': { opener: SETTINGS_BUTTON, open: (p) => openSettingsMenuItem(p, 'app.nav.hotkeys'), modal: true, shown: (p) => p.getByTestId('hotkeys-modal') },
  'about dialog': { opener: SETTINGS_BUTTON, open: (p) => openSettingsMenuItem(p, 'app.nav.about'), modal: true, shown: (p) => p.getByTestId('about-modal') },
  'preset list': { opener: (p) => p.getByTestId('preset-trigger'), open: async (p) => { await p.getByTestId('preset-trigger').click(); }, modal: false, shown: (p) => p.getByRole('dialog') },
  'model picker': { opener: (p) => p.getByTestId('model-picker'), open: async (p) => { await p.getByTestId('model-picker').click(); }, modal: false, shown: (p) => p.getByTestId('model-picker-list') },
};

for (const [name, layer] of Object.entries(LAYERS)) {
  test(`${name}: Escape closes it and gives focus back to the opener`, async ({ page }) => {
    await openApp(page);
    await layer.open(page);
    await expect(layer.shown(page)).toBeVisible();
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closed = !(await layer.shown(page).isVisible());
    const known = KNOWN_ESCAPE[name] ?? [];
    if (process.env.A11Y_REPORT) console.log(`A11Y-KB escape | ${name} | closed=${closed}`);
    if (known.includes('does not close')) {
      expect(closed, `"${name}" now closes on Escape (delete the entry in a11yKeyboardKnown.ts)`).toBe(false);
      return;
    }
    expect(closed, `"${name}" stays open after Escape (keyboard trap)`).toBe(true);
    const back = await layer.opener(page).evaluate((el) => el === document.activeElement);
    if (process.env.A11Y_REPORT) console.log(`A11Y-KB focus-return | ${name} | back=${back} now=${(await readFocus(page))?.key ?? 'page'}`);
    if (known.includes('focus not returned')) expect(back, `"${name}" now returns focus (delete the entry in a11yKeyboardKnown.ts)`).toBe(false);
    else expect(back, `focus is not on the opener of "${name}" after it closed`).toBe(true);
  });
}

for (const [name, layer] of Object.entries(LAYERS).filter(([, l]) => l.modal)) {
  test(`${name}: Tab and Shift+Tab stay inside while it is open`, async ({ page }) => {
    await openApp(page);
    await layer.open(page);
    await expect(layer.shown(page)).toBeVisible();
    await page.waitForTimeout(200);
    const outside: string[] = [];
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < TRAP_STEPS; i++) {
        await page.keyboard.press(key);
        const inside = await DIALOG(page).first().evaluate((root) => root.contains(document.activeElement));
        if (!inside) outside.push(`${key} #${i + 1}: ${(await readFocus(page))?.key ?? 'page'}`);
      }
    }
    expect(outside.slice(0, 5), `focus left the open "${name}"`).toEqual([]);
  });
}
