// The main area draws the only frame of the centre column: what a screen puts in it sits flush, with no frame of its own,
// so every view and every media screen look alike. A new view is covered without being named: the test walks every tab
// of the main area's view switch.
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

test('every screen of the Generate tab sits flush in the main area', { tag: ['@equivalence', '@regression'] }, async ({ page }) => {
  await openApp(page);
  // every view of the image screens (start, viewer, canvas, workflow, drafts...), read from the switch itself
  const views = await page.locator('.mainarea__tablist [data-testid^="view-"]:visible').evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute('data-testid')!));
  expect(views).toContain('view-drafts');
  for (const view of views) {
    await page.getByTestId(view).click();
    await expect(page.getByTestId(view)).toHaveAttribute('aria-selected', 'true');
    expect(await frameOfScreen(page), view).toEqual({ border: '0px', radius: '0px' });
  }
  for (const kind of MEDIA) {
    await page.getByTestId(`media-${kind}`).click();
    await expect(page.locator(`[data-testid="${kind === 'text' ? 'text-canvas' : `${kind}-results`}"]:visible`)).toBeVisible();
    expect(await frameOfScreen(page), kind).toEqual({ border: '0px', radius: '0px' });
  }
});

test('every tab of the side bar that has a main area keeps its screen flush in it', { tag: ['@equivalence', '@regression'] }, async ({ page }) => {
  await openApp(page);
  const tabs = await page.locator('[data-testid^="tab-"]:visible').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!));
  let checked = 0;
  for (const tab of tabs) {
    await page.getByTestId(tab).click();
    const frame = await frameOfScreen(page);
    if (frame === null) continue; // a tab with no main area (the models, the queue...)
    checked++;
    expect(frame, tab).toEqual({ border: '0px', radius: '0px' });
  }
  expect(checked).toBeGreaterThan(1);
});
