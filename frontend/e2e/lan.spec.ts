// The home network item of the side bar against the mock's pretend home network (`?lan`): absent by default, trusting the
// network once, opening, the pairing code, a phone asking (in the popover, and as a prompt when the popover is closed),
// and none of it on a phone-sized window.
import { expect, msg, openApp, test } from './fixtures';

test('the item is absent unless the page has a home network of its own', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('home-link-open')).toHaveCount(0);
});

test('pressing the item opens a closed home network, trusting it, and shows its code', async ({ page }) => {
  await openApp(page, '?lan');
  await page.getByTestId('home-link-open').click();
  await expect(page.getByTestId('home-link-code')).toBeVisible();
  await expect(page.getByTestId('lan-expires')).toBeVisible();
});

test('a phone that asks is allowed in the popover, listed, and disconnected', async ({ page }) => {
  await openApp(page, '?lan=open');
  await page.getByTestId('home-link-open').click();
  await expect(page.getByTestId('home-link-code')).toBeVisible();
  // The mock phone asks two seconds after the code.
  const asking = page.locator('[data-testid^="lan-pending-"]');
  await expect(asking).toHaveCount(1, { timeout: 15_000 });
  await expect(asking).toContainText('iPhone');
  await expect(asking).toContainText(/\d{3} \d{3}/);
  await page.locator('[data-testid^="lan-allow-"]').click();
  const device = page.locator('[data-testid^="lan-device-"]');
  await expect(device).toContainText('iPhone');
  await expect(asking).toHaveCount(0);
  await page.locator('[data-testid^="lan-revoke-"]').click();
  await expect(device).toHaveCount(0);
});

test('a phone that asks while the popover is closed gets a prompt on this page', async ({ page }) => {
  await openApp(page, '?lan=open');
  // A code is made and the popover closed; the phone asks.
  await page.getByTestId('home-link-open').click();
  await expect(page.getByTestId('home-link-code')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lan-panel')).toHaveCount(0);
  const toast = page.locator('.toast:visible', { hasText: msg('app.lan.wants', { name: 'iPhone' }) });
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await expect(toast).toContainText(/\d{3} \d{3}/);
  await expect(page.getByTestId('home-link-open')).toContainText('1');
  await toast.getByRole('button', { name: msg('app.lan.allow') }).click();
  await expect(toast).toHaveCount(0);
  await page.getByTestId('home-link-open').click();
  await expect(page.locator('[data-testid^="lan-device-"]')).toContainText('iPhone');
});

test('a phone-sized window shows no home network at all', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?lan=open');
  await expect(page.getByTestId('phone-shell')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('home-link-open')).toHaveCount(0);
  await expect(page.locator('.toast:visible')).toHaveCount(0);
});
