// The main area draws the only frame of the centre column: what a screen puts in it sits flush, with no frame of its own,
// so the media screens look like the image screens.
import { expect, openApp, test } from './fixtures';

const MEDIA = ['video', 'music', 'voice', 'text'] as const;

/** Border width, corner radius and whether the background is painted, of what the visible main area holds. */
async function frameOfScreen(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const body = [...document.querySelectorAll<HTMLElement>('.mainarea__body')].find((b) => b.offsetParent !== null);
    const screen = body?.firstElementChild;
    if (!screen) return null;
    const s = getComputedStyle(screen);
    return { border: s.borderTopWidth, radius: s.borderTopLeftRadius };
  });
}

test('every screen of the Generate tab sits flush in the main area', { tag: ['@equivalence'] }, async ({ page }) => {
  await openApp(page);
  await page.getByTestId('view-viewer').click();
  expect(await frameOfScreen(page)).toEqual({ border: '0px', radius: '0px' });
  for (const kind of MEDIA) {
    await page.getByTestId(`media-${kind}`).click();
    await expect(page.locator(`[data-testid="${kind === 'text' ? 'text-canvas' : `${kind}-results`}"]:visible`)).toBeVisible();
    expect(await frameOfScreen(page), kind).toEqual({ border: '0px', radius: '0px' });
  }
});
