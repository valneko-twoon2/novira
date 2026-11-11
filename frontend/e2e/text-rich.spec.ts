// "Generate with AI" on the Text screen: the prompt and the run paint the letters; the candidates, the stale notice after a text
// change, undo, going back to the plain fill, a failed run and saving a picture that has the AI fill.
import { expect, msg, openApp, test } from './fixtures';

async function openText(page: Parameters<typeof openApp>[0]) {
  await openApp(page);
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('media-text').click();
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await page.getByTestId('text-add-text').click();
  await expect(page.getByTestId('text-rich')).toBeVisible();
  const count = page.getByRole('spinbutton', { name: msg('params.invoke.iterations') });
  await count.fill('2');
  await count.blur();
}

test('finishing a text layer makes candidates, and a changed text asks for a new run', { tag: ['@state-transition'] }, async ({ page }) => {
  await openText(page);
  await page.getByTestId('positive-prompt').fill('gold, sparkles');

  await page.getByTestId('invoke-button').click();
  const candidates = page.getByTestId('text-rich-candidate');
  await expect(candidates).toHaveCount(2, { timeout: 30_000 });
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('text-rich-stale')).toHaveCount(0);

  // Another candidate becomes the fill.
  await candidates.nth(1).click();
  await expect(candidates.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'false');

  // A new text is a new lettering: the picture is not used, and the section says so.
  await page.getByTestId('text-content').fill('NOVIRA');
  await expect(page.getByTestId('text-rich-stale')).toBeVisible();

  // Undoing the edit brings the picture back with no new job.
  await page.getByTestId('text-canvas').getByRole('button', { name: msg('text.undo') }).click();
  await expect(page.getByTestId('text-rich-stale')).toHaveCount(0);
  await expect(candidates).toHaveCount(2);

  // Back to the plain fill removes the AI picture from the layer.
  await page.getByTestId('text-rich-clear').click();
  await expect(candidates).toHaveCount(0);
});

test(
  'the seed row of the Generate screen: a random run shows the seed it used, and a fixed seed stays as it is',
  { tag: ['@condition'] },
  async ({ page }) => {
    // Two runs, each given 30 s: under a full parallel run the test's own 30 s ran out before the second one ended.
    test.setTimeout(90_000);
    await openText(page);
    const seed = page.getByRole('spinbutton', { name: msg('params.seed.label') });
    const candidates = page.getByTestId('text-rich-candidate');
    await page.getByTestId('invoke-button').click();
    await expect(candidates).toHaveCount(2, { timeout: 30_000 });
    // The random run left its seed in the (now disabled) box; fixing it keeps that number.
    const used = await seed.inputValue();
    await page.getByTestId('seed-fixed').click();
    await expect(seed).toHaveValue(used);
    await page.getByTestId('text-rich-clear').click();
    await page.getByTestId('invoke-button').click();
    await expect(candidates).toHaveCount(2, { timeout: 30_000 });
    await expect(seed).toHaveValue(used);
  },
);

test('a busy button draws its spinner in the label color, so it shows on the blue fills', { tag: ['@regression'] }, async ({ page }) => {
  await openText(page);
  // The mock run ends too fast to catch the spinner, so a busy button of each blue scheme is put on the page with the app's styles.
  const colors = await page.evaluate(() =>
    ['invoke', 'accent'].map((scheme) => {
      const button = document.createElement('button');
      button.className = `ui-btn ui-btn--solid ui-btn--${scheme}`;
      button.disabled = true;
      const spinner = document.createElement('span');
      spinner.className = 'ui-spinner';
      button.append(spinner);
      document.body.append(button);
      const result = { label: getComputedStyle(button).color, ring: getComputedStyle(spinner).borderTopColor };
      button.remove();
      return result;
    }),
  );
  for (const { label, ring } of colors) expect(ring).toBe(label);
});

test('the picture can be saved with the AI fill and a failed run changes nothing', { tag: ['@error-guessing'] }, async ({ page }) => {
  // Two waits of 30 s each, as in the seed test.
  test.setTimeout(90_000);
  await openText(page);
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('text-rich-candidate')).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId('text-save').click();
  await expect(page.getByText(msg('text.saved'))).toBeVisible();

  await page.getByTestId('text-rich-clear').click();
  await page.getByTestId('positive-prompt').fill('[fail]');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByText(msg('text.rich.failed'))).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('text-rich-candidate')).toHaveCount(0);
  await expect(page.getByTestId('invoke-button')).toBeEnabled();
});

test(
  'the Text screen has the queue controls of the Generate screen: the count decides how many are made, and the caret adds to the front',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openText(page);
    const count = page.getByRole('spinbutton', { name: msg('params.invoke.iterations') });
    await count.fill('3');
    await count.blur();
    await page.getByRole('button', { name: msg('params.invoke.moreOptions') }).click();
    await page.getByRole('menuitem', { name: msg('params.invoke.addFront') }).click();
    await expect(page.getByTestId('text-rich-candidate')).toHaveCount(3, { timeout: 30_000 });
    await page.getByRole('button', { name: msg('params.invoke.queueMenu') }).click();
    await expect(page.getByRole('menuitem', { name: msg('params.invoke.openQueue') })).toBeVisible();
  },
);

test('the prompts of the Text screen are its own: the image form keeps what it had', { tag: ['@scenario'] }, async ({ page }) => {
  await openText(page);
  await page.getByTestId('positive-prompt').fill('molten gold');
  await page.getByTestId('negative-prompt').fill('blurry');
  await expect(page.getByTestId('positive-open-book')).toHaveCount(0);
  await page.getByTestId('media-image').click();
  await expect(page.getByTestId('positive-prompt')).not.toHaveValue('molten gold');
  await page.getByTestId('media-text').click();
  await expect(page.getByTestId('positive-prompt')).toHaveValue('molten gold');
});
