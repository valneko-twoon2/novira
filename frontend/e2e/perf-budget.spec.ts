// Time budgets of the frequent actions, on the mock backend in a development build (slower than the app's own build, so the
// limits are loose: they catch a screen that does several times more work than it did, not a few milliseconds). Each failure
// names the action and where to look (see perfBudget.ts). The numbers measured when the budgets were set are in the test
// names' comments; docs/tests/01-ui.md lists what is covered.
import { expect, openApp, test } from './fixtures';
import { costInPage, median, withinBudget, type Budget } from './perfBudget';

// A 2x display with a normal window, as on a laptop: canvases hold four times the pixels.
test.use({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });

async function openText(page: Parameters<typeof openApp>[0]) {
  await openApp(page);
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('media-text').click();
  await expect(page.getByTestId('text-panel')).toBeVisible();
}

const COLOR_BURST: Budget = {
  what: 'Changing the text colour with the picker (8 changes in one frame, as a fast drag sends)',
  ms: 120,
  look: 'ui/ColorInput.tsx (changes must fold to one per frame), then what a text-scene change redraws: features/text/useScenePreview.ts, TextCanvas.tsx, the panels that read useTextEditor',
};

// Measured 4 ms; 110 ms when every change redrew the screen.
test('changing the text colour in a fast drag stays within its budget', { tag: ['@boundary'] }, async ({ page }) => {
  await openText(page);
  for (let i = 0; i < 5; i++) await page.getByTestId('text-add-text').click();
  await expect(page.getByTestId('text-panel').locator('input[type=color]').first()).toBeVisible();
  const costs = await costInPage(
    page,
    (run) => {
      const input = document.querySelector<HTMLInputElement>('[data-testid=text-panel] input[type=color]')!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      for (let k = 0; k < 8; k++) {
        set.call(input, '#' + (((run * 8 + k) * 1000 + 0x223344) & 0xffffff).toString(16).padStart(6, '0'));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    20,
  );
  withinBudget(COLOR_BURST, median(costs.map((c) => c.blocked)));
});

const MEDIA_SWITCH: Budget = {
  what: 'Switching between the Image and Text screens',
  ms: 200,
  look: 'app/Workspace.tsx (OpenedMedia keeps each screen mounted), app/RightColumn.tsx (the gallery must stay mounted), what the shown screen runs on show',
};

// Measured 25-90 ms on the mock's small gallery (55-90 ms before the screens were kept mounted; the app's gallery holds thousands of pictures, which the old switch built again each time).
test('switching between the Image and Text screens stays within its budget', { tag: ['@boundary'] }, async ({ page }) => {
  await openText(page);
  await page.getByTestId('media-image').click();
  await expect(page.getByTestId('model-picker')).toBeVisible();
  const costs = await costInPage(
    page,
    (run) => {
      const id = run % 2 === 0 ? 'media-text' : 'media-image';
      document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.click();
    },
    10,
  );
  // Both directions: coming back to Image was the slower one.
  withinBudget(MEDIA_SWITCH, Math.max(median(costs.filter((_, i) => i % 2 === 0).map((c) => c.painted)), median(costs.filter((_, i) => i % 2 === 1).map((c) => c.painted))));
});

const TAB_SWITCH: Budget = {
  what: 'Switching between the main screens (Generate, Queue, Models)',
  ms: 150,
  look: 'app/App.tsx (Screens keeps opened screens mounted), the shown screen\'s effects that run on show, the stores it subscribes to',
};

// Measured 35 ms.
test('switching between the main screens stays within its budget', { tag: ['@boundary'] }, async ({ page }) => {
  await openApp(page);
  const order = ['tab-queue', 'tab-models', 'tab-generate'];
  // Each screen is opened once first: the budget is for coming back to it, which is what a user does all day.
  for (const id of order) await page.getByTestId(id).click();
  const costs = await costInPage(
    page,
    (run) => {
      const ids = ['tab-queue', 'tab-models', 'tab-generate'];
      document.querySelector<HTMLElement>(`[data-testid="${ids[run % 3]}"]`)!.click();
    },
    9,
  );
  withinBudget(TAB_SWITCH, median(costs.map((c) => c.painted)));
});

const ADD_LAYER: Budget = {
  what: 'Adding a text layer to a scene that already has several',
  ms: 200,
  look: 'state/text/textEditor.ts (history copies), features/text/useScenePreview.ts (the redraw), TextLayersPanel.tsx',
};

test('adding a text layer stays within its budget', { tag: ['@boundary'] }, async ({ page }) => {
  await openText(page);
  for (let i = 0; i < 6; i++) await page.getByTestId('text-add-text').click();
  const costs = await costInPage(
    page,
    () => {
      document.querySelector<HTMLElement>('[data-testid="text-add-text"]')!.click();
    },
    6,
  );
  withinBudget(ADD_LAYER, median(costs.map((c) => c.painted)));
});

const MOSAIC_GROWTH: Budget = {
  what: 'Painting a mosaic stroke after many others (the last strokes against the first, in one layer)',
  ms: 2,
  look: 'ui/canvasDraw/entityRender.ts (a new stroke must be drawn onto the last render, not every object again: drawMosaic copies the whole canvas four times)',
};

// Measured about 1x (flat); 3x or more when every stroke redrew all the earlier mosaics.
test('painting more mosaic strokes does not make each one slower', { tag: ['@boundary'] }, async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs'));
  await page.getByTestId('ref-image').click();
  await page.getByTestId('ref-to-canvas').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  await page.getByTestId('canvas-tool-mosaic').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const times: number[] = [];
  for (let i = 0; i < 14; i++) {
    const start = Date.now();
    await page.mouse.move(cx - 80, cy + (i % 7) * 10);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + (i % 7) * 10, { steps: 8 });
    await page.mouse.up();
    times.push(Date.now() - start);
  }
  withinBudget(MOSAIC_GROWTH, median(times.slice(-5)) / Math.max(1, median(times.slice(0, 5))));
});

const PROMPT_BOOK_OPEN: Budget = {
  what: 'Opening the prompt book with the about 1000 words of the seed',
  ms: 300,
  look: 'features/params/promptbook/PromptBookList.tsx (only the rows near the visible part may be rendered)',
};

// Measured 60-140 ms; 530-690 ms when every word of the book was drawn at once.
test('opening the prompt book stays within its budget', { tag: ['@boundary'] }, async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('positive-open-book')).toBeVisible();
  const costs = await costInPage(
    page,
    (run) => {
      if (run % 2 === 0) document.querySelector<HTMLElement>('[data-testid=positive-open-book]')!.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    },
    12,
  );
  withinBudget(PROMPT_BOOK_OPEN, median(costs.filter((_, i) => i % 2 === 0).map((c) => c.painted)));
});
