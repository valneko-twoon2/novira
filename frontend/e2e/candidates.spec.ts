// The Candidates view holds what one press of Invoke makes until the user moves the pictures they want to a board; the
// drafts live there too. The setting "Put new pictures in Candidates first" sends pictures straight to a board instead.
import type { Page } from '@playwright/test';
import { expect, galleryDefaults, msg, openApp, test } from './fixtures';

const prompt = (page: Page, text: string) => page.getByTestId('positive-prompt').fill(text);

/** Presses Invoke for `count` pictures of `text` and waits until all are drawn in the Candidates view. */
async function generate(page: Page, text: string, count: number) {
  await prompt(page, text);
  await page.getByTestId('seed-fixed').click();
  await page.getByLabel(msg('params.invoke.iterations')).fill(String(count));
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('drafts-grid')).toBeVisible();
  const cells = page.getByTestId('draft-cell');
  await expect(cells).toHaveCount(count);
  // A picture being drawn shows its progress but cannot be chosen or dragged yet: wait for every picture.
  await expect(cells.locator('img')).toHaveCount(count, { timeout: 30_000 });
  await expect(cells.locator('.dv-busy')).toHaveCount(0, { timeout: 30_000 });
  return cells;
}

test.beforeEach(({ page }) => galleryDefaults(page, { newPicturesToCandidates: true }));

test(
  'a generated picture waits in Candidates and moves to the board by ✓ on it, by the selection bar or by a drag',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page, '?scenario=empty');
    const cells = await generate(page, 'a harbour at dawn', 4);
    // One batch with its header line; nothing reached the gallery.
    await expect(page.getByTestId('drafts-group')).toHaveCount(1);
    await expect(page.getByTestId('drafts-group')).toContainText('a harbour at dawn');
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);
    await expect(page.getByTestId('drafts-selection-bar')).toHaveCount(0);

    // ✓ over a picture (shown on hover) moves that one.
    await cells.first().hover();
    await cells.first().getByTestId('draft-accept').click();
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
    await expect(cells).toHaveCount(3);

    // Two chosen with a click and a Ctrl click move together from the selection bar.
    await cells.nth(0).locator('.dv-img').click();
    await cells.nth(1).locator('.dv-img').click({ modifiers: ['Control'] });
    await expect(page.getByTestId('drafts-selection-bar')).toContainText(msg('drafts.selected.other', { count: 2 }));
    await page.getByTestId('drafts-selection-accept').click();
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(3);
    await expect(cells).toHaveCount(1);
    await expect(page.getByTestId('drafts-selection-bar')).toHaveCount(0);

    // Dragging the last picture onto a board row moves it too, and the emptied batch leaves the flow.
    await cells.first().locator('.dv-img').dragTo(page.getByTestId('board-row').first());
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(4);
    await expect(page.getByTestId('drafts-group')).toHaveCount(0);
  },
);

test('× throws away one picture, the selection or the whole batch, and the rest goes to the trash', { tag: ['@state-transition'] }, async ({ page }) => {
  await openApp(page, '?scenario=empty');
  const cells = await generate(page, 'a lantern in the rain', 4);
  await cells.first().hover();
  await cells.first().getByTestId('draft-discard').click();
  await expect(cells).toHaveCount(3);
  await cells.nth(0).locator('.dv-img').click();
  await cells.nth(1).locator('.dv-img').click({ modifiers: ['Shift'] });
  await page.getByTestId('drafts-selection-discard').click();
  await expect(cells).toHaveCount(1);
  await expect(page.getByRole('button', { name: msg('drafts.closeGroupHeld') })).toHaveCount(1);
  await page.getByTestId('drafts-group-discard').click();
  await expect(page.getByTestId('drafts-grid')).toHaveCount(0);
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);
});

test(
  'the large view goes through the pictures with the keys: → moves, Enter puts on the board, Delete throws away, Esc returns',
  { tag: ['@scenario', '@state-transition'] },
  async ({ page }) => {
    await openApp(page, '?scenario=empty');
    const cells = await generate(page, 'a quiet library', 3);
    await cells.first().locator('.dv-img').dblclick();
    const large = page.getByTestId('drafts-large');
    const strip = page.getByTestId('drafts-strip-thumb');
    await expect(large).toBeVisible();
    await expect(strip).toHaveCount(3);
    await expect(strip.first()).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(strip.nth(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
    await expect(strip).toHaveCount(2);
    // The next one shows: the last of the batch.
    await expect(strip.nth(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Delete');
    await expect(strip).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(large).toHaveCount(0);
    await expect(cells).toHaveCount(1);
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  },
);

test('✓ puts the pictures on the board picked at the top of the view', { tag: ['@scenario'] }, async ({ page }) => {
  await openApp(page);
  const cells = await generate(page, 'a mountain lake', 1);
  await page.getByTestId('drafts-target').click();
  await page.getByRole('option', { name: 'Landscapes' }).click();
  await expect(page.getByTestId('drafts-target')).toContainText('Landscapes');
  // The gallery shows the same board.
  await expect(page.getByTestId('board-row').filter({ hasText: 'Landscapes' })).toHaveClass(/is-selected/);
  await cells.first().hover();
  await cells.first().getByTestId('draft-accept').click();
  await expect(page.getByText(msg('gallery.toast.moved.one', { count: 1, board: 'Landscapes' }))).toBeVisible();
  await expect(page.getByTestId('drafts-group')).toHaveCount(0);
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
