// The pictures of a model that has several: the Models screen keeps one frame size whatever shape the picture has, and the
// enlarged view of a Generate tab model goes through all of them. The mock gives Juggernaut XL three pictures of three shapes.
import { expect, msg, openApp, showTab, test } from './fixtures';

test('the Models screen keeps the picture frame the same size for pictures of other shapes', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'models');
  await page.locator('.mm-card-item', { hasText: 'Juggernaut XL v9' }).first().click();
  await expect(page.getByTestId('mm-gallery')).toBeVisible();
  const frame = page.locator('.mm-detail__cover');
  const first = await frame.boundingBox();
  expect(first).not.toBeNull();
  // A fixed portrait frame, whole picture inside it.
  expect(first!.height / first!.width).toBeCloseTo(1.5, 1);

  for (const shown of ['2 / 3', '3 / 3', '1 / 3']) {
    await page.getByTestId('mm-gallery-next').click();
    await expect(page.getByTestId('mm-gallery-count')).toHaveText(shown);
    const box = await frame.boundingBox();
    expect(Math.round(box!.width)).toBe(Math.round(first!.width));
    expect(Math.round(box!.height)).toBe(Math.round(first!.height));
  }
});

test('the enlarged picture of the Generate tab model goes through every picture', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('model-picker').click();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item', { hasText: 'Juggernaut XL v9' }).click();
  await page.getByTitle(msg('params.model.zoomHint')).first().click();
  const zoom = page.getByTestId('cover-zoom');
  await expect(zoom).toBeVisible();
  await expect(page.getByTestId('cover-zoom-count')).toHaveText('1 / 3');
  const firstSrc = await zoom.locator('img').getAttribute('src');

  await page.getByTestId('cover-zoom-next').click();
  await expect(page.getByTestId('cover-zoom-count')).toHaveText('2 / 3');
  expect(await zoom.locator('img').getAttribute('src')).not.toBe(firstSrc);
  await page.getByTestId('cover-zoom-next').click();
  await page.getByTestId('cover-zoom-next').click();
  await expect(page.getByTestId('cover-zoom-count')).toHaveText('1 / 3');
  await page.getByTestId('cover-zoom-prev').click();
  await expect(page.getByTestId('cover-zoom-count')).toHaveText('3 / 3');
});
