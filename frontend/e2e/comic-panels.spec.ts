// The comic panels: a panel is carried about the page by a press anywhere on it, and a press outside the page lets go of
// it; the paper of the page sets the page's proportions, and undo and redo take back a prompt by the buttons and by the
// keys. A failed draw is shown on its panel, the page view zooms with its bar, and a panel cut by a line drawn across it is
// shown with its corners. The prompt boxes hold the selected panel's prompts, and a panel's picture is turned, enlarged,
// scaled with Alt and the wheel, and taken out with Delete. A panel's pose is set from the ready-made list in the toolbar
// or from its 3D rough, and a balloon of the list is added as it is drawn.
import type { Page } from '@playwright/test';
import { chooseFirstModel, expect, msg, openApp, showTab, test } from './fixtures';

/** Makes a comic from the foot of the comic chooser's list, named in its dialog, and shows its pages. */
async function newComic(page: Page, name: string) {
  await page.getByTestId('comic-project-picker').click();
  await page.getByTestId('comic-new').click();
  await page.getByTestId('name-dialog-input').fill(name);
  await page.getByTestId('name-dialog-ok').click();
  // A new comic opens with no model chosen.
  await chooseFirstModel(page);
}

test('a panel is carried by a press anywhere on it, and a press beside the page lets go of it', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Moves');
  await expect(page.getByTestId('comic-panel-2')).toBeVisible();
  await expect(page.getByTestId('comic-panel-grip')).toHaveCount(0);

  // Choosing a panel adds the panel tools' row above the page, which moves the page down: measure after the choice.
  await page.getByTestId('comic-panel-2').click();
  await expect(page.getByTestId('comic-rotate')).toBeVisible();
  const before = await page.getByTestId('comic-panel-2').boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 40, before!.y + before!.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  const after = await page.getByTestId('comic-panel-2').boundingBox();
  expect(after!.x).toBeCloseTo(before!.x + 40, -1);
  expect(after!.y).toBeCloseTo(before!.y - 60, -1);
  await expect(page.getByTestId('comic-rotate')).toBeVisible();

  // A press on the empty view beside the page lets go of the panel, and no other panel is chosen in its place.
  const view = await page.getByTestId('comic-scroll').boundingBox();
  await page.mouse.click(view!.x + 4, view!.y + view!.height / 2);
  await expect(page.getByTestId('comic-rotate')).toHaveCount(0);
  await expect(page.getByTestId('comic-corner')).toHaveCount(0);
});

test('undo and redo take back a panel prompt, by the buttons and by the keys', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Undo');
  await expect(page.getByTestId('comic-panel-1')).toBeVisible();

  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('positive-prompt').fill('first panel');
  await page.getByTestId('comic-panel-2').click();
  await page.getByTestId('positive-prompt').fill('second panel');
  await expect(page.getByTestId('comic-panel-2')).toContainText('second panel');

  await page.getByTestId('comic-undo').click();
  await expect(page.getByTestId('comic-panel-2')).not.toContainText('second panel');
  await expect(page.getByTestId('comic-panel-1')).toContainText('first panel');

  // The keys act on the comic only while focus is not in a text field, so focus the button first.
  await page.getByTestId('comic-redo').focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('comic-panel-2')).toContainText('second panel');
  await page.getByTestId('comic-undo').focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('comic-panel-2')).not.toContainText('second panel');
});

test('the paper of a page sets its proportions', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Paper');
  await expect(page.getByTestId('comic-page')).toBeVisible();

  await page.getByTestId('comic-page-settings').click();
  await page.getByRole('combobox', { name: msg('comic.page.size') }).click();
  await page.getByRole('option', { name: /B5/ }).click();
  const box = await page.getByTestId('comic-page').boundingBox();
  expect(box).not.toBeNull();
  // B5 is 182 by 257 mm: the page is 1.412 times as high as it is wide.
  expect(box!.height / box!.width).toBeCloseTo(1.412, 2);
});

test('a panel whose picture could not be made says so on the panel', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Failure');
  await expect(page.getByTestId('comic-panel-1')).toBeVisible();

  // A prompt with [fail] makes the mock's generation fail.
  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('positive-prompt').fill('[fail] a lighthouse');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('comic-panel-1')).toContainText(msg('comic.draw.failed'), { timeout: 30_000 });
});

test('the page view zooms with its bar, and the reset goes back to 100%', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Zoom');
  await expect(page.getByTestId('comic-page')).toBeVisible();

  const before = await page.getByTestId('comic-page').boundingBox();
  await page.getByRole('button', { name: msg('common.zoomIn') }).click();
  await expect(page.getByTestId('comic-zoom-value')).toHaveText('150%');
  const after = await page.getByTestId('comic-page').boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width * 1.4);

  await page.getByRole('button', { name: msg('comic.zoom.reset') }).click();
  await expect(page.getByTestId('comic-zoom-value')).toHaveText('100%');
});

test('a panel is cut by a line drawn across it: the page gets a panel more, and the cut panel shows its corners', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Cuts');
  await expect(page.getByTestId('comic-panel-3')).toBeVisible();

  // The cut tool is on while the line is drawn; a line from the left edge of the top panel to its right edge cuts it in two.
  await page.getByTestId('comic-cut').click();
  const box = await page.getByTestId('comic-page').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.04, box!.y + box!.height * 0.12);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.96, box!.y + box!.height * 0.3, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId('comic-cut').click();

  // The new panel is the last one, and the panel that was cut is selected, so its corners show (how many depends on the panels it meets).
  await expect(page.getByTestId('comic-panel-4')).toBeVisible();
  await expect(page.getByTestId('comic-corner').first()).toBeVisible();
});

test('the prompt boxes hold the selected panel prompts, and the Generate tab gets its own back', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a castle on Generate');
  await showTab(page, 'comic');
  await newComic(page, 'Prompts');
  await expect(page.getByTestId('comic-panel-1')).toBeVisible();

  // With no panel chosen yet, the boxes hold the first panel's (empty) prompt.
  await expect(page.getByTestId('positive-prompt')).toHaveValue('');
  await page.getByTestId('positive-prompt').fill('first panel');
  await page.getByTestId('comic-panel-2').click();
  await expect(page.getByTestId('positive-prompt')).toHaveValue('');
  await page.getByTestId('positive-prompt').fill('second panel');
  await page.getByTestId('comic-panel-1').click();
  await expect(page.getByTestId('positive-prompt')).toHaveValue('first panel');

  await showTab(page, 'generate');
  await expect(page.getByTestId('positive-prompt')).toHaveValue('a castle on Generate');
});

test("a panel's picture is turned from the toolbar and taken out of the panel with Delete", async ({ page }) => {
  await openApp(page);
  await showTab(page, 'comic');
  await newComic(page, 'Picture');
  // The comic screen keeps its gallery behind a tab of its side column.
  await page.getByTestId('comic-side-tab-gallery').click();
  await page.getByTestId('gallery-thumb').first().dragTo(page.getByTestId('comic-panel-1'));
  const picture = page.getByTestId('comic-panel-1').getByTestId('comic-panel-image');
  await expect(picture).toBeVisible();

  // A press on the picture is the panel's; a double click takes the picture.
  await picture.dblclick();
  await expect(page.getByTestId('comic-picture-handles')).toBeVisible();
  await page.getByTestId('comic-image-rotate-right').click();
  await expect(picture).toHaveAttribute('style', /rotate\(90deg\)/);

  // The picture is enlarged and centred from the toolbar too.
  const before = await picture.boundingBox();
  await page.getByTestId('comic-image-scale-up').click();
  await page.getByTestId('comic-image-center').click();
  const after = await picture.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);

  // Alt and the mouse wheel over the panel scale the picture as well.
  const panel = await page.getByTestId('comic-panel-1').boundingBox();
  await page.mouse.move(panel!.x + panel!.width / 2, panel!.y + panel!.height / 2);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Alt');
  await expect.poll(async () => (await picture.boundingBox())!.width).toBeGreaterThan(after!.width);

  // The toolbar has one trash button, for what is selected: here the picture.
  await expect(page.getByTestId('comic-image-clear')).toHaveCount(0);
  await expect(page.getByTestId('comic-delete')).toHaveAttribute('aria-label', msg('comic.panel.imageClear'));
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('comic-panel-1').getByTestId('comic-panel-image')).toHaveCount(0);
});

test('a balloon is added in the middle of its panel and dragged alone, even over a selected picture', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'comic');
  await newComic(page, 'Drag');
  // The comic screen keeps its gallery behind a tab of its side column.
  await page.getByTestId('comic-side-tab-gallery').click();
  const panel = page.getByTestId('comic-panel-1');
  await page.getByTestId('gallery-thumb').first().dragTo(panel);
  const picture = panel.getByTestId('comic-panel-image');
  await expect(picture).toBeVisible();
  await panel.click();
  await page.getByTestId('comic-bubbles').click();
  await page.getByTestId('comic-add-speech').click();
  await page.keyboard.press('Escape');
  const balloon = page.getByTestId('comic-bubble');
  const box = (await panel.boundingBox())!;
  const at = (await balloon.boundingBox())!;
  // Its middle is the panel's middle.
  expect(Math.abs(at.x + at.width / 2 - (box.x + box.width / 2))).toBeLessThan(3);
  expect(Math.abs(at.y + at.height / 2 - (box.y + box.height / 2))).toBeLessThan(3);

  // The picture is selected (its outline lies over the panel); a drag on the balloon still takes the balloon alone.
  await page.mouse.dblclick(box.x + 20, box.y + 20);
  await expect(page.getByTestId('comic-picture-handles')).toBeVisible();
  const pictureBefore = (await picture.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + at.width / 2 - 60, at.y + at.height / 2 + 40, { steps: 6 });
  await expect(page.getByTestId('comic-bubble-selection')).toBeVisible();
  await expect(page.getByTestId('comic-rotate')).toHaveCount(0);
  await page.mouse.up();
  const moved = (await balloon.boundingBox())!;
  expect(Math.round(moved.x - at.x)).toBe(-60);
  expect(Math.round(moved.y - at.y)).toBe(40);
  expect(await panel.boundingBox()).toEqual(box);
  expect(await picture.boundingBox()).toEqual(pictureBefore);
});

test('a balloon of the list, drawn as it looks, is added to the panel and edited beside the page', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Balloons');
  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('comic-bubbles').click();
  await expect(page.getByTestId('comic-add-explosion').locator('.comic-balloon__line').first()).toBeAttached();
  await page.getByTestId('comic-add-explosion').click();
  await page.getByRole('textbox', { name: msg('comic.bubble.text') }).fill('Boom');
  await expect(page.getByTestId('comic-bubble')).toHaveClass(/comic-bubble--explosion/);
  await expect(page.getByTestId('comic-bubble')).toContainText('Boom');
  // Its outline is shaped freely by its points.
  await page.getByTestId('comic-bubble-shape').click();
  await expect(page.getByTestId('comic-bubble-point').first()).toBeVisible();
});

test('the pose of a panel is set from the ready-made list in the toolbar', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Pose');
  // The panel's tools show while a panel is selected.
  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('comic-pose-tools').click();
  await page.getByTestId('comic-pose-preset-apply').click();
  await expect(page.getByTestId('comic-pose-remove')).toBeVisible();
});

test('a panel is posed from its 3D rough, a box beside the person, which bakes its pose and depth pictures', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Rough');
  await page.getByTestId('comic-panel-1').click();
  await page.getByTestId('comic-pose-tools').click();
  await expect(page.getByTestId('comic-rough-state')).toHaveText(msg('comic.rough.help'));
  await page.getByTestId('comic-rough-open').click();
  await expect(page.getByTestId('comic-rough')).toBeVisible();
  await page.getByTestId('comic-rough-add-box').click();
  await expect(page.getByTestId('comic-rough-things').getByRole('listitem')).toHaveCount(2);
  // The browser draws the 3D view (WebGL).
  await expect(page.getByTestId('comic-rough-failed')).toHaveCount(0);
  await page.getByTestId('comic-rough-apply').click();
  await expect(page.getByTestId('comic-rough')).toHaveCount(0);
  await page.getByTestId('comic-pose-tools').click();
  await expect(page.getByTestId('comic-rough-state')).toHaveText(msg('comic.rough.inUse'));
  await expect(page.getByTestId('comic-pose-remove')).toBeVisible();
  // A pose put in another way leaves the rough's depth behind.
  await page.getByTestId('comic-pose-preset-apply').click();
  await expect(page.getByTestId('comic-rough-state')).toHaveText(msg('comic.rough.dropped'));
});
