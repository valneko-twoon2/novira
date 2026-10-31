// Accessibility scan (axe-core, WCAG 2 A and AA rules) of the browser build against the mock backend: every main tab, the
// menus and dialogs a person reaches from them, and the phone layout. Colour contrast is left to the theme tokens and the
// visual checks (axe cannot judge the gradients, and the hidden screens stay mounted), so it is not one of the rules here.
// A rule that is known to fail on a surface is listed in a11yKnown.ts with the most nodes it may still report: the scan
// fails on anything new or worse, and the list only gets shorter.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';
import { KNOWN } from './a11yKnown';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;
const PHONE_VIEWPORT = { width: 412, height: 915 };

/** Scans what is on the page and fails on a rule that reports more nodes than the known list allows for `surface`. */
async function scan(page: Page, surface: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).disableRules(['color-contrast']).analyze();
  const found = Object.fromEntries(result.violations.map((v) => [v.id, v.nodes.length]));
  if (process.env.A11Y_REPORT) {
    for (const v of result.violations) console.log(`A11Y ${surface} ${v.id} ${v.nodes.length} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  const known = KNOWN[surface] ?? {};
  const worse = Object.entries(found).filter(([id, n]) => n > (known[id] ?? 0));
  expect(worse, `violations of "${surface}" beyond the known ones (a11yKnown.ts)`).toEqual([]);
}

for (const tab of TABS) {
  test(`${tab} tab has no new accessibility violations`, async ({ page }) => {
    await openApp(page);
    await showTab(page, tab);
    await scan(page, tab);
  });
}

async function openMenuItem(page: Page, key: string): Promise<void> {
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('menuitem', { name: msg(key) }).click();
}

/** The menus and dialogs: each is opened on top of the Generate tab and scanned with what is behind it. */
const SURFACES: Record<string, (page: Page) => Promise<void>> = {
  'settings menu': async (page) => {
    await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
    await expect(page.getByRole('menu')).toBeVisible();
  },
  'settings dialog': async (page) => {
    await openMenuItem(page, 'app.nav.settings');
    await expect(page.getByTestId('settings-modal')).toBeVisible();
  },
  'hotkeys dialog': async (page) => {
    await openMenuItem(page, 'app.nav.hotkeys');
    await expect(page.getByTestId('hotkeys-modal')).toBeVisible();
  },
  'about dialog': async (page) => {
    await openMenuItem(page, 'app.nav.about');
    await expect(page.getByTestId('about-modal')).toBeVisible();
  },
  'model picker': async (page) => {
    await page.getByTestId('model-picker').click();
    await expect(page.getByTestId('model-picker-list')).toBeVisible();
  },
  'preset list': async (page) => {
    await page.getByTestId('preset-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  },
  'picture menu': async (page) => {
    await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
  },
  'picture viewer': async (page) => {
    await page.getByTestId('gallery-thumb').first().click();
    await page.getByRole('tab', { name: msg('app.views.viewer'), exact: true }).click();
    await expect(page.getByTestId('viewer-toolbar')).toBeVisible();
  },
  'assistant window': async (page) => {
    await page.getByTestId('agent-open').click();
    await expect(page.getByTestId('agent-window')).toBeVisible();
  },
};

for (const [name, open] of Object.entries(SURFACES)) {
  test(`${name} has no new accessibility violations`, async ({ page }) => {
    await openApp(page);
    await open(page);
    await page.waitForTimeout(300);
    await scan(page, name);
  });
}

test.describe('phone layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto('/');
    await expect(page.getByTestId('phone-shell')).toBeVisible({ timeout: 20_000 });
  });

  test('generate tab has no new accessibility violations', async ({ page }) => {
    await scan(page, 'phone generate');
  });

  test('images tab and a picture have no new accessibility violations', async ({ page }) => {
    await page.getByTestId('phone-nav-images').click();
    await expect(page.getByTestId('phone-thumb').first()).toBeVisible();
    await scan(page, 'phone images');
    await page.getByTestId('phone-thumb').nth(1).click();
    await expect(page.getByTestId('phone-view-image')).toBeVisible();
    await scan(page, 'phone picture');
  });
});
