// The bell at the bottom-right keeps every notification of the session. Deleting pictures does not pop toasts up over the
// gallery: the deletions go under the bell, whose count grows, and opening it lists them newest first.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

const thumbs = (page: Page) => page.getByTestId('gallery-thumb');

async function deleteFirst(page: Page): Promise<void> {
  await thumbs(page).first().click();
  await page.getByTestId('gallery-panel').hover();
  await page.keyboard.press('Delete');
  await page.getByTestId('confirm-delete-images').click();
}

test('deletions go under the bell, which counts them and lists them when opened', { tag: ['@scenario'] }, async ({ page }) => {
  await openApp(page);
  const bell = page.getByTestId('notification-bell');
  await expect(bell).toBeVisible();
  await expect(page.getByTestId('notification-count')).toHaveCount(0);

  await deleteFirst(page);
  await expect(thumbs(page)).toHaveCount(3);
  await deleteFirst(page);
  await expect(thumbs(page)).toHaveCount(2);
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.getByTestId('notification-count')).toHaveText('2');

  await bell.click();
  const list = page.getByTestId('notification-list');
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toContainText(msg('gallery.toast.deleted.one', { count: 1 }));
  // Each deletion shows the picture it took away.
  await expect(list.getByRole('listitem').first().getByTestId('notification-pictures').locator('img')).toHaveCount(1);
  await expect(page.getByTestId('notification-count')).toHaveCount(0);

  // Taking the latest deletion back from the list brings one picture back, and the button goes away.
  await list.getByRole('listitem').first().getByRole('button', { name: msg('gallery.undoDelete.action'), exact: true }).click();
  await expect(thumbs(page)).toHaveCount(3);
  await expect(list.getByRole('listitem').first().getByRole('button', { name: msg('gallery.undoDelete.action'), exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: msg('app.notifications.clear') }).click();
  // Clearing closes the popup.
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('button', { name: msg('app.notifications.clear') })).toHaveCount(0);
  await page.getByTestId('notification-bell').click();
  await expect(page.getByText(msg('app.notifications.empty'))).toBeVisible();
});

test.describe('a notification that is not quiet', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('still pops up, and is kept under the bell', { tag: ['@condition'] }, async ({ page }) => {
    await openApp(page);
    await page.getByTestId('gallery-thumb').nth(2).click();
    await page.keyboard.press('ControlOrMeta+c');
    await expect(page.locator('.toast__title', { hasText: msg('gallery.toast.copied') })).toHaveCount(1);
    await expect(page.getByTestId('notification-count')).toHaveText('1');
    await page.getByTestId('notification-bell').click();
    await expect(page.getByTestId('notification-list').getByRole('listitem').first()).toContainText(msg('gallery.toast.copied'));
  });
});
