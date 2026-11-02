// The random preset run on the Generate tab: tick two saved presets, queue a number of pictures, and every picture is
// made with one of them while the form keeps the user's own settings.
import { expect, msg, openApp, test } from './fixtures';

test('a random preset run queues the chosen count from the ticked presets and leaves the form as it was', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  const prompt = page.getByTestId('positive-prompt');
  const bar = page.getByTestId('preset-bar');
  const save = async (text: string, name: string) => {
    await prompt.fill(text);
    await bar.getByTestId('preset-quick-save').click();
    await page.getByTestId('name-dialog-input').fill(name);
    await page.getByTestId('name-dialog-ok').click();
    await expect(bar.getByTestId('preset-trigger')).toContainText(name);
  };
  await save('a red fox in the snow', 'Fox');
  await save('a blue whale in the sea', 'Whale');
  await prompt.fill('my own prompt');

  await bar.getByTestId('preset-run-open').click();
  const list = page.getByTestId('preset-run-list');
  const queue = page.getByTestId('preset-run-queue');
  await expect(queue).toBeDisabled();
  await list.getByText('Fox', { exact: true }).click();
  await list.getByText('Whale', { exact: true }).click();
  const count = page.getByLabel(msg('presets.run.count'));
  await count.fill('4');
  await count.press('Enter');
  await expect(queue).toBeEnabled();
  await queue.click();

  await expect(page.getByTestId('gallery-thumb')).toHaveCount(4, { timeout: 30_000 });
  await expect(prompt).toHaveValue('my own prompt');

  // Every queued picture took the prompt of one of the ticked presets, never the form's.
  await page.getByTestId('tab-queue').click();
  const items = page.getByTestId('queue-item');
  await expect(items).toHaveCount(4);
  for (const item of await items.all()) {
    await expect(item).toHaveAttribute('data-status', 'completed');
    await expect(item).toContainText(/a red fox in the snow|a blue whale in the sea/);
  }
});
