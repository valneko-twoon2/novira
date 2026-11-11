import type { Page } from '@playwright/test';
import { expect, openApp, showTab, test } from './fixtures';

const SCREENS = ['generate', 'canvas', 'upscaling'] as const;

/** The widths of the shown image screen's columns and handles, to the fraction of a pixel. */
async function columns(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const ws = [...document.querySelectorAll<HTMLElement>('.workspace')].find((e) => e.offsetParent !== null);
    return ws ? [...ws.children].map((c) => Math.round(c.getBoundingClientRect().width * 100) / 100) : [];
  });
}

async function widthsOnEveryScreen(page: Page): Promise<number[][]> {
  const out: number[][] = [];
  for (const tab of SCREENS) {
    await showTab(page, tab);
    await expect.poll(() => columns(page)).toHaveLength(5);
    out.push(await columns(page));
  }
  return out;
}

test('every image screen shows the columns last dragged on another one, to the fraction of a pixel', { tag: ['@scenario'] }, async ({ page }) => {
  await openApp(page);
  // Each screen stays mounted once opened and sized its columns then.
  for (const tab of SCREENS) await showTab(page, tab);
  await showTab(page, 'generate');

  const handle = page.locator('.workspace .resize-handle:visible').first();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 37.3, box.y + 200, { steps: 5 });
  await page.mouse.up();

  const [generate, ...others] = await widthsOnEveryScreen(page);
  expect(generate?.[0]).toBeGreaterThan(400);
  for (const w of others) expect(w).toEqual(generate);

  await page.setViewportSize({ width: 1333, height: 900 });
  const [first, ...rest] = await widthsOnEveryScreen(page);
  for (const w of rest) expect(w).toEqual(first);
});
