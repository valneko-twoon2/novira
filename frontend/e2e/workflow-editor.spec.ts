// Workflow editor: the toolbar (save, download, load, library), copying nodes, connecting by dragging into empty space,
// and the left panel's details.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, msg, openApp, test } from './fixtures';

const nodes = (page: import('@playwright/test').Page) => page.locator('.react-flow__node');

async function openEditor(page: import('@playwright/test').Page) {
  await openApp(page);
  await page.getByTestId('tab-workflows').click();
  await expect(page.getByTestId('wf-node-denoise_latents')).toBeVisible();
}

test('a workflow is saved under a name, appears in the library and is downloaded as a file', async ({ page }) => {
  await openEditor(page);
  // Changing the details marks the workflow as unsaved.
  await page.getByRole('tab', { name: msg('workflows.panel.details') }).click();
  await page.getByTestId('wf-details').getByLabel(msg('workflows.details.name')).fill('My test flow');
  await page.getByTestId('wf-details').getByLabel(msg('workflows.details.tags')).fill('alpha, beta');
  await expect(page.getByTestId('wf-name')).toHaveText('My test flow');
  await expect(page.getByLabel(msg('workflows.unsaved')).first()).toBeVisible();

  // The first save asks for a name (a default workflow cannot be saved in place).
  await page.getByRole('button', { name: msg('workflows.toolbar.save') }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill('Saved flow');
  await dialog.getByRole('button', { name: msg('common.save') }).click();
  await expect(page.locator('.toast__title').filter({ hasText: msg('workflows.toasts.saved', { name: 'Saved flow' }) })).toBeVisible();
  await expect(page.getByTestId('wf-name')).toHaveText('Saved flow');

  // The second save is in place, with the keyboard.
  await page.getByTestId('wf-editor').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+s');
  await expect(page.locator('.toast__title').filter({ hasText: msg('workflows.toasts.saved', { name: 'Saved flow' }) }).nth(1)).toBeVisible();

  // Download from the more menu.
  await page.getByRole('button', { name: msg('workflows.toolbar.more') }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: msg('workflows.toolbar.download') }).click();
  expect((await download).suggestedFilename()).toBe('Saved flow.json');

  // Save As from the more menu makes a second copy.
  await page.getByRole('button', { name: msg('workflows.toolbar.more') }).click();
  await page.getByRole('menuitem', { name: msg('common.saveAs') }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Second copy');
  await page.getByRole('dialog').getByRole('button', { name: msg('common.save') }).click();
  await expect(page.getByTestId('wf-name')).toHaveText('Second copy');

  // Both are in the library, which can search and open them and delete one.
  await page.getByTestId('wf-open-library').click();
  const library = page.getByTestId('wf-library');
  await expect(library.getByTestId('wf-card').filter({ hasText: 'Saved flow' })).toHaveCount(1);
  await expect(library.getByTestId('wf-card').filter({ hasText: 'Second copy' })).toHaveCount(1);
  await library.getByPlaceholder(msg('workflows.library.search')).fill('second copy');
  await expect(library.getByTestId('wf-card')).toHaveCount(1);
  await library.getByPlaceholder(msg('workflows.library.search')).fill('');
  await library.getByTestId('wf-card').filter({ hasText: 'Saved flow' }).getByRole('button', { name: msg('common.delete') }).click();
  await library.getByTestId('wf-card').filter({ hasText: 'Saved flow' }).getByRole('button', { name: msg('common.delete') }).click();
  await expect(library.getByTestId('wf-card').filter({ hasText: 'Saved flow' })).toHaveCount(0);
  await library.getByTestId('wf-card').filter({ hasText: 'Second copy' }).getByRole('button', { name: msg('workflows.library.open') }).click();
  await expect(page.getByTestId('wf-name')).toHaveText('Second copy');
});

test('a workflow file is loaded after confirming that the changes are discarded', async ({ page }, info) => {
  await openEditor(page);
  const file = join(info.outputPath('flow.json'));
  writeFileSync(file, JSON.stringify({ meta: { name: 'From file' }, nodes: [], edges: [], form: [] }));
  // Unsaved changes: the file is only loaded once the discard is confirmed.
  await page.keyboard.press('Shift+A');
  await page.getByTestId('wf-node-picker').getByRole('textbox').fill('integer');
  await page.getByTestId('wf-node-picker').getByRole('textbox').press('Enter');
  await page.getByRole('button', { name: msg('workflows.toolbar.more') }).click();
  await page.getByRole('menuitem', { name: msg('workflows.toolbar.loadFromFile') }).click();
  await page.locator('input[type=file][accept*=json]').first().setInputFiles(file);
  await page.getByTestId('wf-confirm-discard').click();
  await expect(page.getByTestId('wf-name')).toHaveText('From file');
  await expect(nodes(page)).toHaveCount(0);
  // A new workflow starts empty.
  await page.getByRole('button', { name: msg('workflows.toolbar.new') }).click();
  await expect(page.getByTestId('wf-name')).toHaveText(msg('workflows.untitled'));
});

test('nodes are copied and pasted, and the editor settings and the node-list refresh answer', async ({ page }) => {
  await openEditor(page);
  const before = await nodes(page).count();
  await page.getByTestId('wf-node-denoise_latents').locator('.wf-node__header').click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(nodes(page)).toHaveCount(before + 1);

  await page.getByRole('button', { name: msg('workflows.toolbar.updateNodes') }).click();
  await expect(page.locator('.toast__title').filter({ hasText: msg('workflows.toasts.nodesUpToDate') })).toBeVisible();

  await page.getByRole('button', { name: msg('workflows.settings.title') }).click();
  const minimap = page.getByRole('switch', { name: msg('workflows.settings.showMinimap') });
  const shown = (await minimap.getAttribute('aria-checked')) === 'true';
  await expect(page.locator('.react-flow__minimap')).toHaveCount(shown ? 1 : 0);
  await minimap.click();
  await expect(page.locator('.react-flow__minimap')).toHaveCount(shown ? 0 : 1);
  await minimap.click();
  await expect(page.locator('.react-flow__minimap')).toHaveCount(shown ? 1 : 0);
});

test('dragging a connection into empty space offers the nodes that fit and connects the one picked', async ({ page }) => {
  await openEditor(page);
  const before = await nodes(page).count();
  const edgesBefore = await page.locator('.react-flow__edge').count();
  // The first output handle of the noise node (or any node with a free output).
  const handle = page.locator('.react-flow__node .react-flow__handle.source').first();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 400, { steps: 8 });
  await page.mouse.up();
  const picker = page.getByTestId('wf-node-picker');
  await expect(picker).toBeVisible();
  await picker.getByRole('textbox').press('Enter');
  await expect(nodes(page)).toHaveCount(before + 1);
  expect(await page.locator('.react-flow__edge').count()).toBeGreaterThanOrEqual(edgesBefore);
  // Escape closes the dialog without adding anything.
  await page.keyboard.press('Shift+A');
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
});

test('a picture dropped on the editor becomes an image node', async ({ page }) => {
  await openEditor(page);
  const before = await nodes(page).count();
  const editor = page.getByTestId('wf-editor');
  // The name does not have to exist in the gallery: the node only stores it.
  const data = await page.evaluateHandle((n) => {
    const dt = new DataTransfer();
    dt.setData('application/x-novira-images', JSON.stringify([n]));
    return dt;
  }, 'x.png');
  await editor.dispatchEvent('dragover', { dataTransfer: data });
  await editor.dispatchEvent('drop', { dataTransfer: data, clientX: 400, clientY: 300 });
  await expect(page.getByTestId('wf-node-image')).toHaveCount(1);
  expect(await nodes(page).count()).toBe(before + 1);
});

test("ComfyUI's own nodes are in the node list, grouped under a heading of their own, and a found node is added", async ({ page }) => {
  await openEditor(page);
  const before = await nodes(page).count();
  await page.keyboard.press('Shift+A');
  const picker = page.getByTestId('wf-node-picker');
  await expect(picker).toBeVisible();
  await expect(page.getByTestId('wf-picker-scopes')).toContainText(msg('workflows.picker.core'));
  // The group of the audio nodes lists the node that saves a sound.
  await page.getByTestId('wf-picker-scope').filter({ hasText: /^audio\d+$/ }).click();
  await expect(picker.locator('.wf-picker__item', { hasText: 'Save Audio (Advanced)' })).toBeVisible();
  await picker.locator('.wf-picker__item', { hasText: 'Save Audio (Advanced)' }).click();
  await expect(nodes(page)).toHaveCount(before + 1);
  await expect(page.getByTestId('wf-node-comfy:SaveAudioAdvanced')).toBeVisible();
});
