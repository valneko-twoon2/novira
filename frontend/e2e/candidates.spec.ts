// The Candidates view holds what one press of Invoke makes until the user moves the pictures they want to a board; the
// drafts live there too. The setting "Put new pictures in Candidates first" sends pictures straight to a board instead.
import { expect, galleryDefaults, msg, openApp, test } from './fixtures';

const prompt = (page: Parameters<typeof openApp>[0], text: string) => page.getByTestId('positive-prompt').fill(text);

test.beforeEach(({ page }) => galleryDefaults(page, { newPicturesToCandidates: true }));

test(
  'a generated picture waits in Candidates, leaves the boards alone, and moves to the board by the button or a drag',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page, '?scenario=empty');
    await prompt(page, 'a harbour at dawn');
    await page.getByTestId('seed-fixed').click();
    await page.getByLabel(msg('params.invoke.iterations')).fill('3');
    await page.getByTestId('invoke-button').click();

    // The start screen gives way to the Candidates view, and the pictures come in as they are drawn.
    const grid = page.getByTestId('drafts-grid');
    await expect(grid).toBeVisible();
    // Every cell is there from the start; a picture being drawn shows its progress but cannot be chosen or dragged yet,
    // so the steps below wait for all three to be done (a slow machine is still drawing the later ones).
    const cells = page.getByTestId('draft-cell');
    await expect(cells).toHaveCount(3);
    await expect(cells.filter({ hasText: msg('drafts.badge.finished') })).toHaveCount(3, { timeout: 30_000 });
    // Nothing reached the gallery: the board is empty, and the viewer shows nothing new.
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);

    // Choosing a picture and moving it to the board.
    await cells.first().locator('.dv-img').click();
    await page.getByTestId('drafts-adopt').click();
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
    await expect(cells).toHaveCount(2);

    // Dragging a picture onto a board row moves it too, and the board row is the target.
    await cells.first().locator('.dv-img').dragTo(page.getByTestId('board-row').first());
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);

    // Double click opens a candidate large in the viewer, as a draft does.
    await cells.first().locator('.dv-img').dblclick();
    await expect(page.getByTestId('viewer-image')).toBeVisible();
  },
);

test('the rest of a batch goes to the trash, and closing the batch does the same', { tag: ['@state-transition'] }, async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await prompt(page, 'a lantern in the rain');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('draft-cell').first().locator('img')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('drafts-discard').click();
  await expect(page.getByTestId('drafts-grid')).toHaveCount(0);
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);

  await prompt(page, 'a lantern in the rain, again');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('draft-cell').first().locator('img')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: msg('drafts.closeGroupHeld') }).first().click();
  await expect(page.getByTestId('drafts-grid')).toHaveCount(0);
});

test('with the setting off a picture goes straight to its board', { tag: ['@condition'] }, async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('tab-generate').click();
  await page.getByRole('button', { name: msg('gallery.settings.title') }).first().click();
  await page.getByRole('switch', { name: msg('gallery.settings.newToCandidates') }).click();
  await page.keyboard.press('Escape');
  await prompt(page, 'a quiet street');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1, { timeout: 20_000 });
});
