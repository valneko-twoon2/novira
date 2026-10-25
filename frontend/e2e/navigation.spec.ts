// Start-up and moving between the main screens from the side navigation.
import { expect, openApp, showTab, test } from './fixtures';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;

/** Something each screen always shows (a test id, or a CSS selector when it starts with `.`), so a blank or crashed screen fails the test. */
const SCREEN_MARKERS: Record<(typeof TABS)[number], string> = {
  generate: 'parameters-panel',
  comic: 'comic-workspace',
  canvas: 'canvas-view',
  upscaling: '.pp-upimg',
  workflows: 'wf-editor',
  models: 'model-manager',
  browse: 'browse',
  queue: 'queue-tab',
};

test('app boots past the splash into the generate tab', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('parameters-panel')).toBeVisible();
  await expect(page.getByTestId('gallery-panel')).toBeVisible();
  await expect(page.getByTestId('invoke-button')).toBeEnabled();
});

test('every side-nav tab renders its screen', async ({ page }) => {
  await openApp(page);
  for (const tab of TABS) {
    await showTab(page, tab);
    const marker = SCREEN_MARKERS[tab];
    await expect((marker.startsWith('.') ? page.locator(marker) : page.getByTestId(marker)).first()).toBeVisible();
  }
});

// The number keys follow the side bar (NAV_HOTKEYS in state/ui.ts): 1 to 8.
test('number keys switch tabs', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('7');
  await expect(page.getByTestId('tab-queue')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('queue-tab')).toBeVisible();
  await page.keyboard.press('5');
  await expect(page.getByTestId('tab-models')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('3');
  await expect(page.getByTestId('tab-upscaling')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pp-upimg')).toBeVisible();
  await page.keyboard.press('8');
  // Extensions sits at the foot of the side bar as a toggle button, not as a tab.
  await expect(page.getByTestId('tab-extensions')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-selected', 'true');
});
