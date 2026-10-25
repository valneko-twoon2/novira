// Reusing a generated picture from the gallery menu: as a video's first frame, a workflow image input, a text background.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

async function openMenu(page: Page) {
  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
}

test('a picture becomes the source image of an image-to-video clip', async ({ page }) => {
  await openApp(page);
  await openMenu(page);
  await page.getByRole('menuitem', { name: msg('gallery.menu.sendToVideo') }).click();
  await expect(page.getByTestId('media-video')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('video-mode-image')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vv-source__preview img')).toBeVisible();
});

test('a picture is added to the workflow as an image input node', async ({ page }) => {
  await openApp(page);
  await openMenu(page);
  await page.getByRole('menuitem', { name: msg('gallery.menu.sendToWorkflow') }).click();
  await expect(page.getByTestId('tab-workflows')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('wf-node-image').first()).toBeVisible();
  await expect(page.getByText(msg('workflows.toast.imageAdded'))).toBeVisible();
});

test('a picture becomes the background of the text editor', async ({ page }) => {
  await openApp(page);
  await openMenu(page);
  await page.getByRole('menuitem', { name: msg('gallery.menu.sendToText') }).click();
  await expect(page.getByTestId('media-text')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('text-background').getByRole('button', { name: msg('text.bg.image') })).toHaveAttribute('aria-pressed', 'true');
});
