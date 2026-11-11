// Visual regression of the screens that are one tab each: canvas, upscaling, workflows, models, browse, queue,
// extensions and the log, with the parts that carry the most of each.
import { msg, showTab } from '../fixtures';
import { expect, inEachTheme, openDesktop, snap, test } from './shared';

inEachTheme((theme) => {
  const open = async (page: Parameters<typeof openDesktop>[0], tab: string) => {
    await openDesktop(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await showTab(page, tab);
  };

  test('canvas', { tag: ['@scenario'] }, async ({ page }) => {
    await open(page, 'canvas');
    await snap(page, 'canvas', theme, 'screen');
    await snap(page, 'canvas', theme, 'view', page.getByTestId('canvas-view'));
  });

  test('upscaling', { tag: ['@scenario'] }, async ({ page }) => {
    await open(page, 'upscaling');
    await snap(page, 'upscaling', theme, 'screen');
  });

  test('workflows', { tag: ['@scenario'] }, async ({ page }) => {
    await open(page, 'workflows');
    await snap(page, 'workflows', theme, 'screen');
    await snap(page, 'workflows', theme, 'editor', page.getByTestId('wf-editor'));
  });

  test('models', { tag: ['@scenario'] }, async ({ page }) => {
    await open(page, 'models');
    await expect(page.getByTestId('mm-item').first()).toBeVisible();
    await snap(page, 'models', theme, 'screen');
    await snap(page, 'models', theme, 'first-card', page.getByTestId('mm-item').first());
  });

  test('browse', { tag: ['@scenario'] }, async ({ page }) => {
    await open(page, 'browse');
    // Search results arrive after a short mock delay, and each cover picture loads on its own.
    await expect(page.getByTestId('browse-card').first()).toBeVisible();
    await expect(page.locator('.browse-skeleton')).toHaveCount(0);
    await snap(page, 'browse', theme, 'screen');
    await snap(page, 'browse', theme, 'filters', page.getByTestId('browse-filters'));
    await snap(page, 'browse', theme, 'first-card', page.getByTestId('browse-card').first());
  });

  test('queue with a failed and a finished job', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page, '?scenario=empty');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.getByTestId('seed-fixed').click();
    for (const prompt of ['[fail] a lighthouse', 'a lighthouse on a cliff at dusk']) {
      await page.getByTestId('positive-prompt').fill(prompt);
      await page.getByTestId('invoke-button').click();
    }
    await expect(page.getByTestId('invoke-button')).toHaveText(msg('params.invoke.invoke'), { timeout: 20_000 });
    await showTab(page, 'queue');
    await expect(page.getByTestId('queue-item')).toHaveCount(2);
    await snap(page, 'queue', theme, 'screen');
    await snap(page, 'queue', theme, 'list', page.getByTestId('queue-list'));
  });

  test('extensions', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    // Not a work tab: it has no aria-selected, so showTab does not apply.
    await page.getByTestId('tab-extensions').click();
    await expect(page.getByTestId('tab-extensions')).toHaveAttribute('aria-pressed', 'true');
    await snap(page, 'extensions', theme, 'screen');
  });

  test('log', { tag: ['@scenario'] }, async ({ page }) => {
    await openDesktop(page);
    await page.getByTestId('devlog-open').click();
    await expect(page.getByTestId('devlog')).toBeVisible();
    await snap(page, 'log', theme, 'screen');
  });
});
