// The preset card at the top of the left panel is the same size on every screen that has one, whatever buttons sit
// beside it (the Generate screen has a second one, the random run).
import { expect, openApp, test } from './fixtures';

test('the preset card is as large on the image, video, music, voice and text screens', async ({ page }) => {
  await openApp(page);
  const sizes: Record<string, string> = {};
  for (const kind of ['image', 'video', 'music', 'voice', 'text']) {
    await page.getByTestId('tab-generate').click();
    await page.getByTestId(`media-${kind}`).click();
    const card = page.locator('.pp-head .ui-preset__card:visible').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    sizes[kind] = `${Math.round(box!.width)}x${Math.round(box!.height)}`;
  }
  expect(new Set(Object.values(sizes)).size, JSON.stringify(sizes)).toBe(1);
});
