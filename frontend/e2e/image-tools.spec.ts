// The picture tools of the "fix" group: run at once from the picture menu with the last settings, the result compared
// with the original in the viewer, the band's "change the settings and run again", the gear that opens the settings
// without running, and a job that goes on when the band is closed.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';

/** One picture in an empty gallery, made with a fixed seed. */
async function onePicture(page: Page, prompt = 'a girl with brown hair standing in a field') {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill(prompt);
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
}

/** Opens the menu of the original picture (the oldest, last in the grid) and picks an item by its words. */
async function fromMenu(page: Page, key: string) {
  await page.getByTestId('gallery-thumb').last().click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg(key), exact: true }).click();
}

const status = (page: Page) => page.getByTestId('tool-band-status');

test(
  'a menu item runs the tool at once, the viewer compares the result, and the band runs it again with changed settings',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await onePicture(page);
    await fromMenu(page, 'cutout.menu');
    await expect(page.getByTestId('tool-band')).toHaveAttribute('data-tool', 'cutout');
    await expect(status(page)).toHaveAttribute('data-status', 'done', { timeout: 20_000 });
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);
    await expect(page.getByTestId('viewer-compare')).toBeVisible();
    await expect(page.getByTestId('tool-band-used')).toContainText(msg('cutout.background.alpha'));

    // Change the settings and run again: a second result, with the settings it used.
    await page.getByTestId('tool-band-edit').click();
    const slider = page.getByTestId('tool-band').locator('.ui-slidernum').first();
    const before = await slider.boundingBox();
    await page.getByTestId('tool-band-cutout-background').click();
    await page.getByRole('option', { name: msg('cutout.background.white') }).click();
    // The choice does not move what stands beside it.
    expect((await slider.boundingBox())?.x).toBe(before?.x);
    await page.getByTestId('tool-band-run').click();
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(3, { timeout: 20_000 });
    await expect(status(page)).toHaveAttribute('data-status', 'done');
    await expect(page.getByTestId('tool-band-used')).toContainText(msg('cutout.background.white'));

    // The menu now runs with the settings used last.
    await fromMenu(page, 'cutout.menu');
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(4, { timeout: 20_000 });
    await expect(page.getByTestId('tool-band-used')).toContainText(msg('cutout.background.white'));
  },
);

test('the gear beside a menu item opens the settings in the band without running', { tag: ['@condition'] }, async ({ page }) => {
  await onePicture(page);
  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
  await page.getByTestId('menu-tool-settings-facefix').click();
  await expect(page.getByTestId('tool-band')).toHaveAttribute('data-tool', 'facefix');
  // Run stands at the right end of the band for every tool.
  const run = await page.getByTestId('tool-band-run').boundingBox();
  await page.getByTestId('tool-band-tool-caption').click();
  await expect(page.getByTestId('tool-band')).toHaveAttribute('data-tool', 'caption');
  expect((await page.getByTestId('tool-band-run').boundingBox())?.x).toBe(run?.x);
  await page.getByTestId('tool-band-tool-facefix').click();
  // The picture's own prompt is the starting point, and nothing has run.
  await expect(page.getByTestId('tool-band-face-prompt')).toHaveValue('a girl with brown hair standing in a field');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await expect(page.getByTestId('image-viewer').locator('img').first()).toBeVisible();

  await page.getByTestId('tool-band-run').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('viewer-compare')).toBeVisible();
  await expect(page.getByTestId('tool-band-used')).toContainText('bbox/');
});

test('closing the band while its job waits does not cancel the job', { tag: ['@state-transition'] }, async ({ page }) => {
  await onePicture(page);
  // Hold the queue so the job is still waiting when the band closes.
  await showTab(page, 'queue');
  await page.getByTestId('queue-pause').click();
  await showTab(page, 'generate');

  await fromMenu(page, 'facefix.menu');
  await expect(status(page)).toHaveAttribute('data-status', 'running');
  await expect(page.getByTestId('tool-band-cancel')).toBeVisible();
  await page.getByTestId('tool-band-close').click();
  await expect(page.getByTestId('tool-band')).toHaveCount(0);

  await showTab(page, 'queue');
  await page.getByTestId('queue-resume').click();
  await showTab(page, 'generate');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByText(msg('facefix.saved'))).toBeVisible();
});
