// Workflow editor: the graph optimizer button, its undo, and the "tidy automatically" setting.
import { expect, msg, openApp, test } from './fixtures';

test('optimize removes an unconnected node as one undoable step', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-workflows').click();
  const nodes = page.locator('.react-flow__node');
  await expect(page.getByTestId('wf-node-denoise_latents')).toBeVisible();
  const before = await nodes.count();

  // Add a node that leads to no output.
  await page.keyboard.press('Shift+A');
  await page.getByTestId('wf-node-picker').getByRole('textbox').fill('integer');
  await page.getByTestId('wf-node-picker').getByRole('textbox').press('Enter');
  await expect(nodes).toHaveCount(before + 1);

  await page.getByTestId('wf-optimize').click();
  await expect(page.locator('.toast__title').filter({ hasText: msg('workflows.optimize.done') })).toBeVisible();
  await expect(nodes).toHaveCount(before);

  await page.keyboard.press('Control+z');
  await expect(nodes).toHaveCount(before + 1);
  await page.keyboard.press('Control+Shift+z');
  await expect(nodes).toHaveCount(before);

  // Optimized already: nothing left to do.
  await page.getByTestId('wf-optimize').click();
  await expect(page.locator('.toast__title').filter({ hasText: msg('workflows.optimize.nothing') })).toBeVisible();
});

test('tidying automatically is off by default and can be turned on', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-workflows').click();
  await page.getByRole('button', { name: msg('workflows.settings.title') }).click();
  const toggle = page.getByRole('switch', { name: msg('workflows.settings.autoTidy') });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('a long workflow name stays clear of the toolbar buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openApp(page);
  await page.getByTestId('tab-workflows').click();
  const more = page.getByRole('button', { name: msg('workflows.toolbar.more') });
  await more.click();
  await page.getByRole('menuitem', { name: msg('common.saveAs') }).click();
  await page.getByRole('textbox').last().fill('A very long workflow name that used to run over the more menu button of the editor toolbar');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('wf-name')).toContainText('A very long workflow name');

  // The title ends before the buttons on both sides, so the more button can be clicked.
  const bar = await page.locator('.wf-titlebar').boundingBox();
  const left = await more.boundingBox();
  const right = await page.getByRole('button', { name: msg('workflows.settings.title') }).boundingBox();
  expect(bar!.x).toBeGreaterThan(left!.x + left!.width);
  expect(bar!.x + bar!.width).toBeLessThan(right!.x);
  await more.click();
  await expect(page.getByRole('menuitem', { name: msg('common.saveAs') })).toBeVisible();
});

test('the Read Aloud template makes a sound that lands in the gallery', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('tab-workflows').click();
  await page.getByRole('tab', { name: msg('workflows.panel.templates') }).click();
  const card = page.getByTestId('wf-template').filter({ hasText: msg('workflows.templates.voiceRead.title') });
  await card.getByTestId('wf-template-open').click();
  await expect(page.getByTestId('wf-node-voice_speak')).toBeVisible();
  await expect(page.getByTestId('wf-node-comfy:SaveAudioAdvanced')).toBeVisible();

  // The voice engine is not installed yet: the graph waits for it (the reason is in the button's tooltip).
  await expect(page.getByTestId('invoke-button')).toBeDisabled();
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('media-voice').click();
  await page.getByTestId('voice-pack-install').click();
  await expect(page.getByTestId('voice-pack')).toHaveCount(0, { timeout: 25_000 });
  await page.getByTestId('tab-workflows').click();
  await page.getByTestId('invoke-button').click();
  await page.getByTestId('tab-queue').click();
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'completed');
  // A sound has the music note on its thumbnail, whatever the graph that made it.
  await page.getByTestId('tab-generate').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await expect(page.getByTestId('gallery-thumb').locator('.gthumb__play')).toHaveCount(1);
});
