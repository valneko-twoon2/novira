// Visual regression of the side bar's network item and its dialogs (the home network, closed, and with Windows calling the
// network public), against the mock's pretend home network.
import { expect, inEachTheme, openDesktop, snap, test } from './shared';

inEachTheme((theme) => {
  test('side bar with the network item', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await expect(page.getByTestId('home-link-open')).toBeVisible();
    await snap(page, 'network', theme, 'sidebar', page.locator('.sidenav'));
  });

  test('home network dialog, closed', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page, '?lan');
    await page.getByTestId('home-link-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snap(page, 'network', theme, 'home-closed');
  });

  test('home network dialog, with the public-network warning', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page, '?lan=public');
    await page.getByTestId('home-link-open').click();
    await expect(page.getByTestId('lan-public')).toBeVisible();
    await expect(page.getByTestId('home-link-code')).toBeVisible();
    await snap(page, 'network', theme, 'home-public');
  });
});
