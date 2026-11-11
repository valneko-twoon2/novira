// Ctrl+C copies the picture just chosen in the gallery, also on the canvas screen with the pointer moved away.
import { expect, msg, openApp, showTab, test } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test(
  'Ctrl+C copies the picture chosen in the gallery until something else is pressed',
  { tag: ['@state-transition'] },
  async ({ page }) => {
    await openApp(page);
    await showTab(page, 'canvas');
    const toasts = page.locator('.toast__title', { hasText: msg('gallery.toast.copied') });
    await page.getByTestId('gallery-thumb').nth(2).click();
    // The pointer leaves the grid (over the canvas): the choice still counts.
    await page.mouse.move(700, 450);
    await page.keyboard.press('ControlOrMeta+c');
    await expect(toasts).toHaveCount(1);
    expect(await page.evaluate(async () => (await navigator.clipboard.read())[0]?.types)).toContain('image/png');
    // Pressing the canvas hands the keys back to it.
    await page.mouse.click(700, 450);
    await page.keyboard.press('ControlOrMeta+c');
    await page.waitForTimeout(400);
    await expect(toasts).toHaveCount(1);
  },
);
