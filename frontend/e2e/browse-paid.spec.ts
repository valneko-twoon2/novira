// Models that cost money on Civitai: a price filter, a badge with the end of early access, and no install button.
import { expect, msg, openApp, showTab, test } from './fixtures';

test('the price filter lists paid models, each with a badge and a download that cannot be pressed', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'browse');
  await expect(page.getByTestId('browse-card').first()).toBeVisible();

  await page.getByTestId('browse-filters').click();
  await page.getByTestId('browse-filter-price').click();
  await page.getByRole('option', { name: msg('browse.filter.paid') }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('browse-filters-count')).toHaveText('1');

  const cards = page.getByTestId('browse-card');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.getByTestId('browse-paid-badge')).toHaveCount(count);
  await expect(page.getByTestId('browse-paid-locked')).toHaveCount(count);
  await expect(page.getByTestId('browse-paid-locked').first()).toBeDisabled();
  await expect(page.getByTestId('browse-paid-locked').first()).toHaveText(msg('browse.paid.locked'));

  // The detail says why, and an early access names the day it ends.
  await cards.first().click();
  await expect(page.getByTestId('browse-drawer')).toBeVisible();
  await expect(page.getByTestId('browse-paid-note')).toBeVisible();
  await expect(page.getByTestId('browse-drawer').getByTestId('browse-paid-locked').first()).toBeDisabled();
});

test('the free filter leaves no paid model, and the badge names the end date of an early access', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'browse');
  await page.getByTestId('browse-filters').click();
  await page.getByTestId('browse-filter-price').click();
  await page.getByRole('option', { name: msg('browse.filter.free') }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('browse-card').first()).toBeVisible();
  await expect(page.getByTestId('browse-paid-badge')).toHaveCount(0);

  // Paid again: some badge is an early access with its end.
  await page.getByTestId('browse-filters').click();
  await page.getByTestId('browse-filter-price').click();
  await page.getByRole('option', { name: msg('browse.filter.paid') }).click();
  await page.keyboard.press('Escape');
  const until = page.getByTestId('browse-paid-badge').filter({ hasText: '〜' });
  await expect(until.first()).toBeVisible();
  await expect(until.first()).toContainText('2099');
});
