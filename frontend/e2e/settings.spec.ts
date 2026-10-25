// The settings menu in the side navigation: settings, hotkeys and about dialogs, theme and language.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

async function openMenuItem(page: Page, itemKey: string): Promise<void> {
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await page.getByRole('menuitem', { name: msg(itemKey) }).click();
}

test('the settings menu opens the hotkeys and about dialogs', async ({ page }) => {
  await openApp(page);
  await openMenuItem(page, 'app.nav.hotkeys');
  await expect(page.getByTestId('hotkeys-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hotkeys-modal')).toHaveCount(0);

  await openMenuItem(page, 'app.nav.about');
  await expect(page.getByTestId('about-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('about-modal')).toHaveCount(0);
});

test('the about dialog keeps its size on both tabs, shows the license in full and a package license in place', async ({ page }) => {
  await openApp(page);
  await openMenuItem(page, 'app.nav.about');
  const about = page.getByRole('dialog', { name: msg('settings.about.title') });
  await expect(about.getByTestId('about-license-text')).toContainText('Version 2.0, January 2004');
  const onLicense = await about.boundingBox();
  await about.getByRole('tab', { name: msg('settings.about.oss.title') }).click();
  await expect(page.getByTestId('about-oss-list')).toBeVisible();
  expect(await about.boundingBox()).toEqual(onLicense);

  await page.getByRole('textbox', { name: msg('settings.about.oss.search') }).fill('zustand');
  const row = page.getByTestId('about-oss-list').getByRole('listitem').first();
  await row.getByRole('button', { name: msg('settings.about.oss.showLicense') }).click();
  await expect(row.getByTestId('about-license-text')).toContainText('MIT License');
  expect(await about.boundingBox()).toEqual(onLicense);

  await about.getByRole('tab', { name: msg('settings.about.license.title') }).click();
  await expect(about.getByTestId('about-license-text')).toContainText('Version 2.0, January 2004');
  expect(await about.boundingBox()).toEqual(onLicense);
});

test('switching the theme applies at once and survives a reload', async ({ page }) => {
  await openApp(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await openMenuItem(page, 'app.nav.settings');
  await expect(page.getByTestId('settings-modal')).toBeVisible();
  await page.getByRole('combobox', { name: msg('settings.theme.label') }).click();
  await page.getByRole('option', { name: msg('settings.theme.light') }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 });
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('switching the language to English relabels the screen', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-label', msg('app.tabs.generate'));

  await openMenuItem(page, 'app.nav.settings');
  await page.getByRole('combobox', { name: msg('settings.language.label') }).click();
  await page.getByRole('option', { name: msg('settings.language.en') }).click();

  await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-label', msg('app.tabs.generate', {}, 'en'));
  await expect(page.getByRole('combobox', { name: msg('settings.language.label', {}, 'en') })).toBeVisible();
});

for (const [locale, nameKey] of [
  ['zh-CN', 'settings.language.zhcn'],
  ['zh-TW', 'settings.language.zhtw'],
  ['ko', 'settings.language.ko'],
  ['ru', 'settings.language.ru'],
  ['es', 'settings.language.es'],
  ['pt-BR', 'settings.language.ptbr'],
  ['fr', 'settings.language.fr'],
  ['de', 'settings.language.de'],
] as const) {
  test(`switching the language to ${locale} relabels the screen and survives a reload`, async ({ page }) => {
    await openApp(page);
    await openMenuItem(page, 'app.nav.settings');
    await page.getByRole('combobox', { name: msg('settings.language.label') }).click();
    await page.getByRole('option', { name: msg(nameKey) }).click();

    await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-label', msg('app.tabs.generate', {}, locale));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.reload();
    await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-label', msg('app.tabs.generate', {}, locale));
  });
}
