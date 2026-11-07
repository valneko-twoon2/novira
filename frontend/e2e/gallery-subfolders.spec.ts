// A board can hold subfolders: a folder is made from the board's menu, pictures move into it from the picture's menu,
// the board shows the folder as a tile with its latest picture, the tile opens it, and the way back is a tile too.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

const thumbs = (page: Page) => page.getByTestId('gallery-thumb');
const board = (page: Page, name: string) => page.getByTestId('board-row').filter({ hasText: name });

async function makeFolder(page: Page, parent: string, name: string): Promise<void> {
  await board(page, parent).click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.boards.addSubfolder') }).click();
  const input = page.locator('.gboard__rename');
  await input.fill(name);
  await input.press('Enter');
}

test('a subfolder is made, takes a picture, shows as a tile in its board and opens', async ({ page }) => {
  await openApp(page);
  await board(page, 'Landscapes').click();
  await expect(thumbs(page)).toHaveCount(3);
  await expect(page.getByTestId('gallery-folder')).toHaveCount(0);

  await makeFolder(page, 'Landscapes', 'Night');
  await expect(board(page, 'Night')).toHaveClass(/is-sub/);
  await board(page, 'Landscapes').click();
  await expect(page.getByTestId('gallery-folder')).toHaveCount(1);
  await expect(page.getByTestId('gallery-folder')).toContainText('Night');

  // A picture dragged onto the tile moves into the folder and leaves the board's own pictures; the tile shows it.
  await thumbs(page).first().dragTo(page.getByTestId('gallery-folder'));
  await expect(thumbs(page)).toHaveCount(2);
  await expect(page.getByTestId('gallery-folder').locator('img')).toHaveCount(1);
  await expect(page.getByTestId('gallery-folder')).toContainText('1');

  // The tile opens the folder, which shows the way back instead of its own tiles.
  await page.getByTestId('gallery-folder').click();
  await expect(thumbs(page)).toHaveCount(1);
  await expect(page.getByTestId('gallery-folder')).toHaveCount(0);
  await page.getByTestId('gallery-folder-up').click();
  await expect(thumbs(page)).toHaveCount(2);
});

test('a subfolder cannot hold subfolders, and deleting its board deletes it', async ({ page }) => {
  await openApp(page);
  await makeFolder(page, 'Landscapes', 'Night');
  await board(page, 'Night').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: msg('gallery.boards.addSubfolder') })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await board(page, 'Landscapes').click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.boards.delete') }).click();
  await expect(page.getByText(msg('gallery.boards.deleteSubfoldersHint'))).toBeVisible();
  await page.getByRole('button', { name: msg('gallery.boards.deleteBoardOnly') }).click();
  await expect(board(page, 'Night')).toHaveCount(0);
  await expect(board(page, 'Landscapes')).toHaveCount(0);
});
