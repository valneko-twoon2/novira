// A deleted picture can be brought back (the toast, the header button, Ctrl+Z) and deleted again (the header button,
// Ctrl+Shift+Z). The mock holds a deleted picture in its trash as the backend does.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

const thumbs = (page: Page) => page.getByTestId('gallery-thumb');

async function deleteFirst(page: Page): Promise<void> {
  await thumbs(page).first().click();
  await page.getByTestId('gallery-panel').hover();
  await page.keyboard.press('Delete');
  await page.getByTestId('confirm-delete-images').click();
}

test('the toast and the header button bring a deleted picture back, and delete it again', async ({ page }) => {
  await openApp(page);
  await expect(thumbs(page)).toHaveCount(4);
  await expect(page.getByTestId('gallery-undo-delete')).toBeDisabled();
  await expect(page.getByTestId('gallery-redo-delete')).toBeDisabled();

  await deleteFirst(page);
  await expect(thumbs(page)).toHaveCount(3);
  await expect(page.getByTestId('gallery-undo-delete')).toBeEnabled();

  // The toast's own button takes this deletion back.
  await page.getByRole('button', { name: msg('gallery.undoDelete.action'), exact: true }).click();
  await expect(thumbs(page)).toHaveCount(4);
  await expect(page.getByTestId('gallery-count')).toHaveText('4');
  await expect(page.getByTestId('gallery-undo-delete')).toBeDisabled();
  await expect(page.getByTestId('gallery-redo-delete')).toBeEnabled();

  // Taking it back is itself undone by "delete again".
  await page.getByTestId('gallery-redo-delete').click();
  await expect(thumbs(page)).toHaveCount(3);
  await expect(page.getByTestId('gallery-redo-delete')).toBeDisabled();

  await page.getByTestId('gallery-undo-delete').click();
  await expect(thumbs(page)).toHaveCount(4);
});

test('Ctrl+Z over the gallery brings a deletion back and Ctrl+Shift+Z deletes it again', async ({ page }) => {
  await openApp(page);
  await deleteFirst(page);
  await expect(thumbs(page)).toHaveCount(3);

  await page.getByTestId('gallery-panel').hover();
  await page.keyboard.press('Control+z');
  await expect(thumbs(page)).toHaveCount(4);
  await page.keyboard.press('Control+Shift+z');
  await expect(thumbs(page)).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(thumbs(page)).toHaveCount(4);
});

test('deleting a board with its pictures can be taken back; they return uncategorized', async ({ page }) => {
  await openApp(page);
  await expect(thumbs(page)).toHaveCount(4);
  const row = page.getByTestId('board-row').filter({ hasText: 'Characters' });
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.boards.delete') }).click();
  await page.getByTestId('delete-board-and-images').click();
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId('gallery-undo-delete')).toBeEnabled();

  await page.getByTestId('gallery-undo-delete').click();
  // The board is gone, so its two pictures come back to Uncategorized, which now holds six.
  await expect(thumbs(page)).toHaveCount(6);
});
