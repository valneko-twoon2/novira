// The prompt boxes' tag view, icon buttons and dynamic prompts of the negative prompt, on the mock backend.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

/** The prompt's text box, also while the tag view hides it (the page's test id lookup keeps only visible elements). */
const promptText = (page: Page, kind: 'positive' | 'negative') => page.locator(`[data-testid="${kind}-prompt"]`).first();

test('a tag is renamed, its strength changed and reset from its popover, and removed', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('1girl, smile, (blush:1.3)');
  await page.getByTestId('positive-tag-view').click();
  const tags = page.getByTestId('positive-tag');
  await expect(tags).toHaveCount(3);
  await expect(tags.nth(2)).toContainText('1.30');

  // Rename: Enter saves it, the popover stays open and the strength is kept.
  await tags.nth(2).click();
  const name = page.getByTestId('positive-tag-name');
  await expect(name).toHaveValue('blush');
  await name.fill('flushed');
  await name.press('Enter');
  await expect(tags.nth(2)).toContainText('flushed');
  await expect(tags.nth(2)).toContainText('1.30');
  await expect(name).toBeVisible();

  // The reset and remove buttons are icons with a name, side by side, and no text.
  const reset = page.getByRole('button', { name: msg('params.prompt.tagReset') });
  const remove = page.getByRole('button', { name: msg('params.prompt.tagRemove') });
  await expect(reset).toHaveText('');
  await expect(remove).toHaveText('');
  const [a, b] = [await reset.boundingBox(), await remove.boundingBox()];
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  expect(b!.x).toBeGreaterThan(a!.x);

  await reset.click();
  await expect(promptText(page, 'positive')).toHaveValue('1girl, smile, flushed');
  await expect(reset).toBeDisabled();
  await remove.click();
  await expect(promptText(page, 'positive')).toHaveValue('1girl, smile');
});

test('dragging a strength does not move the tags: the chip keeps its width', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a, b, c');
  await page.getByTestId('positive-tag-view').click();
  const tags = page.getByTestId('positive-tag');
  await tags.nth(0).click();
  const slider = page.getByRole('slider', { name: msg('params.prompt.tagStrength') });
  await slider.focus();
  const widths: number[] = [];
  const nextX: number[] = [];
  for (let i = 0; i < 12; i++) {
    await slider.press('ArrowRight');
    widths.push((await tags.nth(0).boundingBox())!.width);
    nextX.push((await tags.nth(1).boundingBox())!.x);
  }
  // From 1.05 to 1.60 in steps of 0.05, passing every digit pattern, the chip and what follows it stay put.
  expect(new Set(widths.map((w) => Math.round(w))).size).toBe(1);
  expect(new Set(nextX.map((x) => Math.round(x))).size).toBe(1);
  await expect(promptText(page, 'positive')).toHaveValue('(a:1.6), b, c');
});

test('each prompt switches between its text and its tags with two buttons', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  for (const kind of ['positive', 'negative']) {
    await expect(page.getByTestId(`${kind}-text-view`)).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId(`${kind}-tag-view`).click();
    await expect(page.getByTestId(`${kind}-tags`)).toBeVisible();
    await expect(page.getByTestId(`${kind}-tag-view`)).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId(`${kind}-text-view`).click();
    await expect(page.getByTestId(`${kind}-tags`)).toHaveCount(0);
  }
});

test('the prompt headers have icons only: describe, dynamic prompts and presets', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await expect(page.getByTestId('prompt-caption')).toHaveText('');
  await expect(page.getByTestId('positive-open-book')).toHaveText('');
  await expect(page.getByTestId('negative-open-book')).toHaveText('');
  await expect(page.getByTestId('dynamic-prompts')).toBeVisible();
  await expect(page.getByTestId('dynamic-prompts-negative')).toBeVisible();
});

test('a dynamic negative prompt is previewed and every combination is drawn', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a lighthouse');
  await page.getByTestId('negative-prompt').fill('{blurry|dark}, lowres');
  await page.getByTestId('dynamic-prompts-negative').click();
  const list = page.getByTestId('dynamic-prompts-list').locator('li');
  await expect(list).toHaveCount(2);
  await expect(list.nth(0)).toHaveText('blurry, lowres');
  await expect(list.nth(1)).toHaveText('dark, lowres');
  await page.keyboard.press('Escape');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 30_000 });
});

test('an unknown wildcard in the negative prompt blocks Invoke', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a lighthouse');
  await page.getByTestId('negative-prompt').fill('__nothing__');
  await expect(page.getByTestId('invoke-button')).toBeDisabled();
  await expect(page.getByTestId('generation-reason')).toHaveText(msg('params.readiness.wildcardUnknown', { name: '__nothing__' }));
});
