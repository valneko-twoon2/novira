// Visual regression of the settings dialog and of the gallery column on the right.
import { msg } from '../fixtures';
import { expect, inEachTheme, openDesktop, settle, snap, test } from './shared';

inEachTheme((theme) => {
  test('settings dialog', async ({ page }) => {
    await openDesktop(page);
    await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
    await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await snap(page, 'settings', theme, 'dialog');
    // The dialog dims the side bar, and the colour threshold (0.2) lets a change of the bar under the dim pass, so the bar is
    // also checked on its own with a strict threshold.
    await settle(page);
    await expect(page.locator('.sidenav')).toHaveScreenshot(['settings', theme, 'dialog-sidebar.png'], { animations: 'disabled', caret: 'hide', threshold: 0 });
  });

  test('gallery column', async ({ page }) => {
    await openDesktop(page);
    await expect(page.getByTestId('gallery-thumb').first()).toBeVisible();
    await snap(page, 'gallery', theme, 'column', page.getByTestId('gallery-panel'));
  });
});
