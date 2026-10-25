// The comic screen: a project is made, its first panel is drawn from a prompt, and a balloon is placed on the page.
import type { Page } from '@playwright/test';
import { chooseFirstModel, expect, msg, openApp, showTab, test } from './fixtures';

/** Makes a comic from the foot of the comic chooser's list, named in its dialog. */
async function newComic(page: Page, name: string) {
  await page.getByTestId('comic-project-picker').click();
  await page.getByTestId('comic-new').click();
  await page.getByTestId('name-dialog-input').fill(name);
  await page.getByTestId('name-dialog-ok').click();
  // A fresh start has no model chosen.
  await chooseFirstModel(page);
}

test('a comic project is made, a panel is drawn into its frame, and a balloon is placed on the page', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await expect(page.getByText(msg('comic.editor.emptyTitle'))).toBeVisible();

  await newComic(page, 'Harbour');
  await expect(page.getByTestId('comic-page')).toBeVisible();
  await expect(page.getByTestId('comic-panel-1')).toBeVisible();

  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  // The picture is put into its own panel when the queue has made it.
  await expect(page.getByTestId('comic-panel-1').locator('img')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('comic-bubbles').click();
  await page.getByTestId('comic-add-speech').click();
  await page.getByRole('textbox', { name: msg('comic.bubble.text') }).fill('Hello');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('comic-bubble')).toHaveText('Hello');
});

test('a panel is drawn from its prompt in the side panel, and a balloon takes another kind, a tail turned by its handle, and vertical text', async ({
  page,
}) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Bay');

  await page.getByTestId('comic-panel-2').click();
  await expect(page.getByTestId('invoke-bar')).toBeVisible();
  await page.getByTestId('positive-prompt').fill('a sailing boat at sunrise');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('comic-panel-2').locator('img')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('comic-bubbles').click();
  await page.getByTestId('comic-add-thought').click();
  await page.keyboard.press('Escape');
  const bubble = page.getByTestId('comic-bubble');
  await expect(bubble).toHaveClass(/comic-bubble--thought/);

  // The handle at the tail's tip turns the tail when it is dragged.
  const handle = page.getByTestId('comic-bubble-tail');
  const before = await handle.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + 80, before!.y + 30, { steps: 6 });
  await page.mouse.up();
  const after = await handle.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x + 20);

  // A double click opens the balloon's editor beside the page: turning the tail off removes the handle; the text can run vertically.
  await bubble.dblclick();
  await expect(page.getByTestId('comic-bubble-editor')).toBeVisible();
  await page.getByTestId('comic-bubble-tail-toggle').click();
  await expect(page.getByTestId('comic-bubble-tail')).toHaveCount(0);
  await page.getByTestId('comic-bubble-vertical').click();
  await expect(bubble).toHaveClass(/is-vertical/);
});
