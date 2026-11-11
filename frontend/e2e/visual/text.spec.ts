// Visual regression of the Text screen: the whole screen, with a layer, and its parts (canvas, layers, background, settings).
import { msg } from '../fixtures';
import { expect, inEachTheme, openDesktop, snap, test } from './shared';

const SCREEN = 'text';

inEachTheme((theme) => {
  const openText = async (page: Parameters<typeof openDesktop>[0]) => {
    await openDesktop(page);
    await page.getByTestId('tab-generate').click();
    await page.getByTestId('media-text').click();
    await expect(page.getByTestId('text-panel')).toBeVisible();
  };

  test('whole screen', { tag: ['@scenario'] }, async ({ page }) => {
    await openText(page);
    await snap(page, SCREEN, theme, 'screen');
  });

  test('left panel', { tag: ['@scenario'] }, async ({ page }) => {
    await openText(page);
    await snap(page, SCREEN, theme, 'panel', page.getByTestId('text-panel'));
  });

  test('background section', { tag: ['@scenario'] }, async ({ page }) => {
    await openText(page);
    await snap(page, SCREEN, theme, 'background', page.getByTestId('text-background'));
    await page.getByTestId('text-background').getByText(msg('text.bg.color'), { exact: true }).click();
    await snap(page, SCREEN, theme, 'background-color', page.getByTestId('text-background'));
  });

  test('with a text layer and a bubble', { tag: ['@scenario'] }, async ({ page }) => {
    await openText(page);
    await page.getByTestId('text-add-text').click();
    await page.getByTestId('text-add-bubble').click();
    await page.getByRole('menuitem', { name: msg('text.shape.cloud') }).click();
    await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(2);
    await snap(page, SCREEN, theme, 'with-layers');
    await snap(page, SCREEN, theme, 'layers', page.getByTestId('text-layers'));
    await snap(page, SCREEN, theme, 'layer-settings', page.getByTestId('text-props'));
  });
});
