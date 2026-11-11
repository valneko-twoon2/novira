// Visual regression of the Generate screen: the whole screen and its parts (prompt boxes, header, sections, pickers, the
// large prompt editor), then what one press of Invoke leaves in the viewer and in the Candidates view.
import { galleryDefaults, msg } from '../fixtures';
import { expect, inEachTheme, openDesktop, snap, test } from './shared';

const SCREEN = 'generate';

inEachTheme((theme) => {
  test('whole screen', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await snap(page, SCREEN, theme, 'screen');
  });

  test('start screen', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await snap(page, SCREEN, theme, 'start', page.getByTestId('launchpad'));
  });

  test('panel header (preset, seed, run buttons)', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await snap(page, SCREEN, theme, 'panel-header', page.getByTestId('panel-header'));
  });

  test('prompt boxes', { tag: ['@boundary'] }, async ({ page }) => {
    await openDesktop(page);
    await snap(page, SCREEN, theme, 'prompts', page.getByTestId('prompts'));
  });

  test('prompt boxes with text and as tags', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('positive-prompt').fill('a cat on a roof, smiling, (blue eyes:1.2), night sky');
    await page.getByTestId('negative-prompt').fill('blurry, low quality');
    await snap(page, SCREEN, theme, 'prompts-filled', page.getByTestId('prompts'));
    await page.getByTestId('positive-tag-view').click();
    await page.getByTestId('negative-tag-view').click();
    await snap(page, SCREEN, theme, 'prompts-tags', page.getByTestId('prompts'));
  });

  test('prompt section folded', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('prompts').locator('.ui-section__toggle').click();
    await snap(page, SCREEN, theme, 'prompts-folded', page.getByTestId('prompts'));
  });

  test('image section', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    const section = page.locator('.ui-section', { has: page.getByRole('button', { name: msg('params.image.title') }) }).first();
    await snap(page, SCREEN, theme, 'image-section', section);
  });

  test('model picker open', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('model-picker').click();
    await expect(page.getByTestId('model-picker-list')).toBeVisible();
    await snap(page, SCREEN, theme, 'model-picker');
  });

  test('preset list open', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('panel-header').locator('.ui-preset__card').click();
    await snap(page, SCREEN, theme, 'preset-list');
  });

  test('large prompt editor', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('positive-prompt').fill('a cat on a roof, smiling, night sky');
    await page.getByTestId('positive-expand').click();
    await expect(page.getByTestId('big-positive')).toBeVisible();
    await snap(page, SCREEN, theme, 'prompt-editor');
  });

  test('a picture in the viewer', { tag: ['@scenario'] }, async ({ page }) => {
    await galleryDefaults(page, { newPicturesToCandidates: false });
    await openDesktop(page, '?scenario=empty');
    await page.getByTestId('seed-fixed').click();
    await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
    await page.getByTestId('invoke-button').click();
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
    await expect(page.getByTestId('image-viewer')).toBeVisible();
    // Wait until the queue is idle again, so the invoke button is back to its resting look.
    await expect(page.getByTestId('invoke-button')).toHaveText(msg('params.invoke.invoke'));
    await snap(page, SCREEN, theme, 'viewer');
  });

  test('candidates', { tag: ['@scenario'] }, async ({ page }) => {
    await galleryDefaults(page, { newPicturesToCandidates: true });
    await openDesktop(page, '?scenario=empty');
    await page.getByTestId('seed-fixed').click();
    await page.getByTestId('positive-prompt').fill('a harbour at dawn');
    await page.getByLabel(msg('params.invoke.iterations')).fill('3');
    await page.getByTestId('invoke-button').click();
    await expect(page.getByTestId('drafts-grid')).toBeVisible();
    await expect(page.getByTestId('draft-cell')).toHaveCount(3);
    await expect(page.getByTestId('draft-cell').locator('img')).toHaveCount(3, { timeout: 20_000 });
    await expect(page.getByTestId('invoke-button')).toHaveText(msg('params.invoke.invoke'));
    await snap(page, SCREEN, theme, 'candidates');
  });
});
