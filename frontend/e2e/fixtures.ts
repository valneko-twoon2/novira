// Shared fixtures for the end-to-end tests: error collection, app start-up and catalog lookups.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

type Locale = 'ja' | 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'es' | 'pt-BR' | 'fr' | 'de';

/** Every message of a language, merged from the per-area catalog files. */
function loadCatalog(locale: Locale): Record<string, string> {
  const dir = fileURLToPath(new URL(`../src/i18n/locales/${locale}/`, import.meta.url));
  return Object.assign(
    {},
    ...readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as Record<string, string>),
  );
}

const CATALOGS: Record<Locale, Record<string, string>> = {
  ja: loadCatalog('ja'),
  en: loadCatalog('en'),
  'zh-CN': loadCatalog('zh-CN'),
  'zh-TW': loadCatalog('zh-TW'),
  ko: loadCatalog('ko'),
  ru: loadCatalog('ru'),
  es: loadCatalog('es'),
  'pt-BR': loadCatalog('pt-BR'),
  fr: loadCatalog('fr'),
  de: loadCatalog('de'),
};

/** The displayed text for a message key (default language `ja`), with `{name}` placeholders filled in. */
export function msg(key: string, vars: Record<string, string | number> = {}, locale: Locale = 'ja'): string {
  const text = CATALOGS[locale][key] ?? CATALOGS.ja[key];
  if (text === undefined) throw new Error(`Unknown message key: ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/**
 * Opens the app (optionally with a query string such as `?scenario=empty`) and waits until the start-up screen is gone.
 * The shell appears only after the backend's start-up data (gallery, workflow library) is in the stores.
 */
export async function openApp(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('splash')).toHaveCount(0);
  await chooseFirstModel(page);
}

/** Opens a screen from the side bar; the comic is a mode of the Generate entry, so it takes the entry and then the comic icon of its media row. */
export async function showTab(page: Page, tab: string): Promise<void> {
  if (tab === 'comic' || tab === 'generate') {
    await page.getByTestId('tab-generate').click();
    const comic = page.getByTestId('media-comic');
    const comicShown = (await comic.getAttribute('aria-selected')) === 'true';
    // The entry reopens the mode shown last; Generate from the comic goes back through the image icon.
    if (tab === 'comic' && !comicShown) await comic.click();
    if (tab === 'generate' && comicShown) await page.getByTestId('media-image').click();
    await expect(comic).toHaveAttribute('aria-selected', String(tab === 'comic'));
    return;
  }
  await page.getByTestId(`tab-${tab}`).click();
  await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
}

/** Opens the app on the canvas tab with a model chosen (the app starts on the Generate tab). */
export async function openCanvas(page: Page, query = ''): Promise<void> {
  await openApp(page, query);
  await page.getByTestId('tab-canvas').click();
  await expect(page.getByTestId('canvas-view')).toBeVisible();
  await chooseFirstModel(page);
}

/**
 * The app opens with no main model chosen, so a test that generates picks one the way a user does. Does nothing when the screen
 * has no model picker, or when the picker is disabled (an empty models folder, `?scenario=empty`).
 */
export async function chooseFirstModel(page: Page): Promise<void> {
  const picker = page.getByTestId('model-picker');
  if ((await picker.count()) === 0 || (await picker.isDisabled())) return;
  await picker.click();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().click();
}

interface Fixtures {
  /** Console errors and uncaught page errors seen during the test. Checked automatically when the test ends. */
  errors: string[];
  /** Records browser coverage when E2E_COVERAGE is set; does nothing otherwise. */
  v8coverage: void;
}

export const test = base.extend<Fixtures>({
  // A screen once opened stays mounted while another one is shown (hidden; src/app/App.tsx), so the same test id can be on
  // the page twice. A test id on the page means the one on the open screen: the hidden ones are left out.
  page: async ({ page }, provide) => {
    const byTestId = page.getByTestId.bind(page);
    page.getByTestId = (testId) => byTestId(testId).filter({ visible: true });
    await provide(page);
  },
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
      });
      await use(errors);
      expect(errors, 'the page logged errors').toEqual([]);
    },
    { auto: true },
  ],
  // With E2E_COVERAGE=1 (`npm run coverage:e2e`) every test records the browser's JavaScript coverage. `scripts/coverage-report.mjs` turns the raw files into a report.
  v8coverage: [
    async ({ page }, use) => {
      if (!process.env.E2E_COVERAGE) return use();
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      const entries = await page.coverage.stopJSCoverage();
      const dir = fileURLToPath(new URL('../../novira-data/work/coverage/e2e-raw/', import.meta.url));
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}${randomUUID()}.json`, JSON.stringify(entries.filter((e) => e.url.includes('/src/'))));
    },
    { auto: true },
  ],
});

export { expect };
