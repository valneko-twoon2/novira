// The screens of the user manual. Each scene opens the mock app (`query` is added to the address, for example
// `?scenario=empty`), does what a reader would do, and takes one picture with `s.shot()` or `s.shot(element)`.
// The manual chapters show a scene with `![what it shows](shot:<id>)`; tests/manual.test.ts keeps both sides in step:
// every id used in a chapter is listed here, and every scene listed here is used by a chapter.
//
// What a scene gets (see makeContext in ../manual.mjs): `page` (Playwright), `locale`, `msg(key, vars)` (the text of
// a message in the language being shot), `testid(id)`, `dialog()`, `menuItem(key)`, `tab(name)`, `generate(prompt, count)`,
// `settle()`, `hideText(text)` (hides something that exists only in the mock), `shot(element?)`. A scene may also set `settings` (saved settings for this scene only).
// Write steps with test ids and message keys, never with literal words, so one scene works in every language.
// This file imports nothing, so tests can read the list without a browser.

const PROMPT = 'a lighthouse on a cliff at dusk, calm sea, warm light';
const EMPTY = '?scenario=empty';

/** Makes one picture from an empty gallery and shows it in the viewer. */
async function withPicture(s, prompt = PROMPT) {
  await s.generate(prompt);
  await s.testid('gallery-thumb').first().click();
  await s.testid('image-viewer').waitFor();
}

/** Opens the settings menu at the bottom of the side navigation and chooses an entry. */
async function fromSettingsMenu(s, itemKey) {
  await s.page.getByRole('button', { name: s.msg('app.nav.settingsMenu') }).click();
  await s.menuItem(itemKey).click();
}

/** Adds a balloon with one line to the selected panel from the toolbar's balloon popover; its editor opens beside the page. */
async function comicBalloon(s) {
  await s.testid('comic-bubbles').click();
  await s.testid('comic-add-speech').click();
  await s.page.getByRole('textbox', { name: s.msg('comic.bubble.text') }).fill('Hello!');
}

/** A comic project named Harbour (made from the foot of the comic chooser's list), with its first panel drawn from a prompt. */
async function comicPage(s) {
  await s.tab('comic');
  await s.testid('comic-project-picker').click();
  await s.testid('comic-new').click();
  await s.testid('name-dialog-input').fill('Harbour');
  await s.testid('name-dialog-ok').click();
  // The prompt boxes hold the selected panel's prompts.
  await s.testid('comic-panel-1').click();
  await s.testid('positive-prompt').fill(PROMPT);
  await s.testid('invoke-button').click();
  await s.testid('comic-panel-1').locator('img').waitFor({ timeout: 30_000 });
}

/** Scrolls the left panel of the comic screen (the scrolling box around the draw buttons) to its top or its end. */
async function comicLeftScroll(s, where) {
  await s.testid('invoke-bar').evaluate((el, to) => {
    let box = el.parentElement;
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
    box?.scrollTo(0, to === 'end' ? box.scrollHeight : 0);
  }, where);
}

/** Turns the page into the phone layout: the window of a phone held upright, which the layout follows. */
async function onPhone(s) {
  await s.page.setViewportSize({ width: 412, height: 915 });
  await s.testid('phone-shell').waitFor();
}

/** Picks the first model on the phone's Generate tab. */
async function phoneModel(s) {
  await s.testid('model-picker').click();
  await s.testid('model-picker-list').locator('.pp-picker__item').first().click();
}

/** @type {Array<{ id: string, query?: string, settings?: Record<string, unknown>, run: (s: any) => Promise<void> }>} */
export const SCENES = [
  // --- the main screens -------------------------------------------------------------------------------------------------
  { id: 'generate', run: (s) => s.shot() },
  {
    id: 'generate-prompt',
    query: EMPTY,
    run: async (s) => {
      await s.testid('positive-prompt').fill(PROMPT);
      await s.testid('seed-fixed').click();
      await s.shot();
    },
  },
  {
    id: 'generate-result',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s);
      await s.shot();
    },
  },
  {
    id: 'invoke-menu',
    query: EMPTY,
    run: async (s) => {
      await s.testid('positive-prompt').fill(PROMPT);
      await s.page.getByRole('button', { name: s.msg('params.invoke.moreOptions') }).click();
      await s.shot();
    },
  },
  {
    id: 'canvas',
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-view').waitFor();
      await s.shot();
    },
  },
  {
    id: 'canvas-add-layer',
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-add-layer').click();
      await s.shot();
    },
  },
  {
    id: 'canvas-layer-menu',
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-add-layer').click();
      await s.menuItem('canvas.add.raster').click();
      await s.testid('canvas-entity').first().click({ button: 'right' });
      await s.shot();
    },
  },
  {
    id: 'canvas-pose',
    query: EMPTY,
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-tool-pose').click();
      const box = await s.testid('canvas-stage').boundingBox();
      await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await s.testid('canvas-entity').first().waitFor();
      await s.page.mouse.move(box.x + 8, box.y + 8);
      await s.shot();
    },
  },
  {
    id: 'canvas-pose-from-image',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s, 'a girl standing with her arms raised, white background 19');
      await s.testid('gallery-thumb').first().click({ button: 'right' });
      await s.menuItem('canvas.poseFromImage.menu').click();
      await s.testid('pose-from-image-dialog').waitFor();
      await s.testid('pose-from-image-run').click();
      await s.testid('pose-from-image-result').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'canvas-pose-presets',
    query: EMPTY,
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-tool-pose').click();
      await s.testid('canvas-pose-presets').click();
      await s.testid('canvas-pose-category-panel.two').click();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'canvas-pose-3d',
    query: EMPTY,
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-tool-pose').click();
      const box = await s.testid('canvas-stage').boundingBox();
      await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await s.testid('canvas-entity').first().waitFor();
      await s.testid('canvas-pose-3d').click();
      await s.testid('pose3d-apply').waitFor();
      await s.page.waitForFunction(() => !document.querySelector('[data-testid="pose3d-apply"]').disabled);
      // Turn the body a little by dragging the background of the 3D view.
      const view = await s.testid('pose3d-canvas').boundingBox();
      await s.page.mouse.move(view.x + 30, view.y + view.height - 30);
      await s.page.mouse.down();
      await s.page.mouse.move(view.x + 100, view.y + view.height - 50, { steps: 6 });
      await s.page.mouse.up();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'upscaling',
    run: async (s) => {
      await s.tab('upscaling');
      await s.testid('parameters-panel').waitFor();
      await s.shot();
    },
  },
  {
    id: 'workflows',
    run: async (s) => {
      await s.tab('workflows');
      await s.testid('wf-editor').waitFor();
      await s.shot();
    },
  },
  {
    id: 'workflows-library',
    run: async (s) => {
      await s.tab('workflows');
      await s.testid('wf-open-library').click();
      await s.testid('wf-library').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'workflows-add-node',
    run: async (s) => {
      await s.tab('workflows');
      await s.page.keyboard.press('Shift+A');
      await s.testid('wf-node-picker').waitFor();
      await s.shot();
    },
  },
  {
    id: 'models',
    run: async (s) => {
      await s.tab('models');
      await s.testid('model-manager').waitFor();
      await s.shot();
    },
  },
  {
    id: 'models-detail',
    run: async (s) => {
      await s.tab('models');
      await s.testid('mm-item').first().click();
      await s.testid('mm-model-view').waitFor();
      await s.shot();
    },
  },
  {
    id: 'browse',
    run: async (s) => {
      await s.tab('browse');
      await s.testid('browse-card').first().waitFor();
      await s.page.locator('.browse-skeleton').first().waitFor({ state: 'detached' }).catch(() => undefined);
      await s.shot();
    },
  },
  {
    id: 'queue',
    settings: { mockStepDelay: 700 },
    run: async (s) => {
      await s.testid('positive-prompt').fill(PROMPT);
      for (let i = 0; i < 3; i++) await s.testid('invoke-button').click();
      await s.tab('queue');
      await s.testid('queue-item').first().waitFor();
      await s.shot();
    },
  },

  {
    // A picture that ran out of GPU memory: the notice above the gallery with its two ways out.
    id: 'out-of-memory',
    query: EMPTY,
    run: async (s) => {
      await s.testid('positive-prompt').fill(`${PROMPT} [oom]`);
      await s.testid('invoke-button').click();
      const notice = s.testid('gallery-generating').getByTestId('oom-notice');
      await notice.getByTestId('oom-low-memory').waitFor();
      await s.shot(notice);
    },
  },

  // --- the generate screen ----------------------------------------------------------------------------------------------
  {
    id: 'model-picker',
    run: async (s) => {
      await s.page.locator('.pp-model button').first().click().catch(() => undefined);
      await s.shot();
    },
  },
  {
    id: 'prompt-book',
    run: async (s) => {
      await s.page.getByRole('button', { name: s.msg('params.promptBook.open') }).first().click();
      await s.testid('prompt-book').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'wildcards',
    run: async (s) => {
      await s.testid('positive-prompt').fill('1girl, __hair-color__, __expression__, {standing|sitting}');
      await s.testid('dynamic-prompts').click();
      await s.testid('open-wildcards').click();
      await s.testid('wildcards-dialog').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'hires-fix',
    query: EMPTY,
    run: async (s) => {
      const toggle = s.page.getByRole('button', { name: s.msg('params.hires.title') });
      const section = s.page.locator('.ui-section', { has: toggle });
      await toggle.click();
      await s.page.getByRole('switch', { name: s.msg('params.hires.enable') }).click();
      await section.scrollIntoViewIfNeeded();
      await s.shot(section);
    },
  },
  {
    id: 'presets',
    run: async (s) => {
      await s.testid('preset-trigger').first().click();
      await s.shot();
    },
  },
  {
    id: 'media-video',
    run: async (s) => {
      await s.testid('media-video').click();
      await s.testid('video-panel').waitFor();
      await s.shot();
    },
  },
  {
    id: 'media-music',
    run: async (s) => {
      await s.testid('media-music').click();
      await s.testid('music-tags').waitFor();
      await s.shot();
    },
  },
  {
    id: 'media-voice',
    run: async (s) => {
      await s.testid('media-voice').click();
      await s.testid('voice-text').waitFor();
      await s.shot();
    },
  },
  {
    id: 'media-logo',
    run: async (s) => {
      await s.testid('media-logo').click();
      await s.testid('logo-text').waitFor();
      await s.shot();
    },
  },
  {
    id: 'media-text',
    run: async (s) => {
      await s.testid('media-text').click();
      await s.testid('text-panel').waitFor();
      await s.testid('text-add-text').click();
      await s.shot();
    },
  },

  // --- the gallery and the viewer ---------------------------------------------------------------------------------------
  {
    id: 'viewer',
    run: async (s) => {
      await s.testid('gallery-thumb').first().dblclick();
      await s.testid('image-viewer').waitFor();
      await s.shot();
    },
  },
  {
    id: 'viewer-metadata',
    run: async (s) => {
      await s.testid('gallery-thumb').first().dblclick();
      await s.testid('toggle-metadata').click();
      await s.testid('viewer-metadata').waitFor();
      await s.shot();
    },
  },
  {
    id: 'viewer-compare',
    run: async (s) => {
      await s.testid('gallery-thumb').nth(0).dblclick();
      await s.testid('image-viewer').waitFor();
      await s.testid('gallery-thumb').nth(1).click({ button: 'right' });
      await s.menuItem('gallery.menu.compare').click();
      await s.testid('viewer-compare').waitFor();
      await s.shot();
    },
  },
  {
    id: 'gallery-menu',
    run: async (s) => {
      await s.testid('gallery-thumb').first().click({ button: 'right' });
      await s.menuItem('gallery.menu.trim').waitFor();
      await s.shot();
    },
  },
  {
    id: 'gallery-multi-menu',
    run: async (s) => {
      await s.testid('gallery-thumb').nth(0).click();
      await s.testid('gallery-thumb').nth(1).click({ modifiers: ['Control'] });
      await s.testid('gallery-thumb').nth(1).click({ button: 'right' });
      await s.menuItem('gallery.menu.batch').waitFor();
      await s.shot();
    },
  },
  {
    id: 'gallery-date',
    run: async (s) => {
      await s.testid('gallery-date-filter').click();
      await s.testid('gallery-date-calendar').waitFor();
      await s.shot();
    },
  },

  {
    id: 'share-export',
    run: async (s) => {
      await s.testid('gallery-thumb').nth(0).click();
      await s.testid('gallery-thumb').nth(1).click({ modifiers: ['Control'] });
      await s.testid('gallery-thumb').nth(1).click({ button: 'right' });
      await s.menuItem('share.menu').click();
      await s.testid('share').waitFor();
      await s.testid('share-format-jpeg').click();
      await s.shot(s.dialog());
    },
  },

  // --- fixing and deriving pictures -------------------------------------------------------------------------------------
  {
    id: 'derive-menu',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s);
      await s.testid('viewer-derive').click();
      await s.shot();
    },
  },
  {
    id: 'derive',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s);
      await s.testid('viewer-derive').click();
      await s.menuItem('gallery.derive.custom').click();
      await s.testid('derive-dialog').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'cutout',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s);
      await s.testid('viewer-cutout').click();
      await s.testid('cutout-stage').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'segment',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s);
      await s.testid('viewer-segment').click();
      await s.testid('seg-stage').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'facefix',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s, 'a girl with brown hair standing in a field');
      await s.testid('viewer-facefix').click();
      await s.testid('facefix-dialog').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'character',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s, 'a girl in a blue skirt');
      await s.testid('viewer-character').click();
      await s.testid('character-dialog').waitFor();
      await s.testid('character-name').fill('Mia');
      await s.testid('character-tags').fill('brown hair, blue skirt');
      await s.shot(s.dialog());
    },
  },
  {
    id: 'caption',
    query: EMPTY,
    run: async (s) => {
      await withPicture(s, 'a girl with blue hair smiling, white background');
      await s.testid('viewer-caption').click();
      await s.testid('caption-dialog').waitFor();
      await s.testid('caption-run').click();
      await s.testid('caption-result').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'xyplot',
    query: EMPTY,
    run: async (s) => {
      await s.testid('positive-prompt').fill(PROMPT);
      await s.page.getByRole('button', { name: s.msg('params.invoke.moreOptions') }).click();
      await s.menuItem('xyplot.menu').click();
      await s.testid('xyplot-dialog').waitFor();
      const pick = async (axis, key, values) => {
        await s.testid(`xyplot-${axis}`).getByRole('combobox').click();
        await s.page.getByRole('option', { name: s.msg(key) }).click();
        await s.testid(`xyplot-${axis}-values`).fill(values);
      };
      await pick('x', 'xyplot.axis.cfgScale', '3, 5, 7');
      await pick('y', 'xyplot.axis.steps', '10, 20');
      await s.shot(s.dialog());
    },
  },
  {
    id: 'pose',
    query: EMPTY,
    run: async (s) => {
      await s.tab('canvas');
      await s.testid('canvas-add-layer').click();
      await s.menuItem('pose.menu').click();
      await s.testid('pose-dialog').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'drafts',
    run: async (s) => {
      await s.testid('positive-prompt').fill(PROMPT);
      await s.testid('view-drafts').click();
      await s.testid('drafts-view').waitFor();
      await s.testid('drafts-start').click();
      await s.testid('draft-cell').first().waitFor({ timeout: 30_000 });
      await s.shot();
    },
  },
  {
    id: 'batch',
    run: async (s) => {
      await s.testid('gallery-thumb').nth(0).click();
      await s.testid('gallery-thumb').nth(1).click({ modifiers: ['Control'] });
      await s.testid('gallery-thumb').nth(1).click({ button: 'right' });
      await s.menuItem('gallery.menu.batch').click();
      await s.testid('batch').waitFor();
      await s.shot(s.dialog());
    },
  },

  // --- the comic screen ------------------------------------------------------------------------------------------------------
  {
    id: 'comic',
    query: EMPTY,
    run: async (s) => {
      await s.tab('comic');
      await s.testid('comic-editor').waitFor();
      await s.shot();
    },
  },
  {
    id: 'comic-project',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      await comicBalloon(s);
      await s.page.keyboard.press('Escape');
      // The comic chooser at the top of the left panel, opened: each comic with its first page and its page count.
      await comicLeftScroll(s, 'top');
      await s.testid('comic-project-picker').click();
      await s.testid('comic-project-list').waitFor();
      await s.shot();
    },
  },
  {
    id: 'comic-pose',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      await s.testid('comic-pose-tools').click();
      await s.testid('comic-pose').click();
      await s.testid('pose-dialog').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'comic-image',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      // Panel 1's picture is now in the gallery; drop it on the (empty) panel 2 of the page, and select it.
      await s.testid('gallery-thumb').first().dragTo(s.testid('comic-panel-2'));
      const picture = s.testid('comic-panel-2').getByTestId('comic-panel-image');
      await picture.waitFor();
      await picture.click();
      // Fit the whole picture in the panel (its handles are then on the page), then turn it a little by the handle above it.
      await s.testid('comic-image-contain').click();
      const knob = await s.testid('comic-picture-rotate').boundingBox();
      await s.page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
      await s.page.mouse.down();
      await s.page.mouse.move(knob.x + knob.width * 6, knob.y + knob.height, { steps: 8 });
      await s.page.mouse.up();
      await s.testid('comic-panel-2').scrollIntoViewIfNeeded();
      await s.shot();
    },
  },
  {
    id: 'comic-presets',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      await s.testid('comic-panel-2').click();
      await s.testid('comic-pose-tools').click();
      // The second category of the ready-made poses (by position, so no word of any language is needed).
      await s.page.getByRole('combobox', { name: s.msg('comic.panel.poseCategory') }).click();
      await s.page.getByRole('option').nth(1).click();
      await s.shot();
    },
  },
  {
    id: 'comic-templates',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      await s.testid('comic-page-templates').click();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'comic-shapes',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      // Cut the first panel on a slant: the cut tool, then a line drawn across the page from its left edge to its right one.
      await s.testid('comic-cut').click();
      await s.testid('comic-page').scrollIntoViewIfNeeded();
      const box = await s.testid('comic-page').boundingBox();
      await s.page.mouse.move(box.x + box.width * 0.04, box.y + box.height * 0.12);
      await s.page.mouse.down();
      await s.page.mouse.move(box.x + box.width * 0.96, box.y + box.height * 0.3, { steps: 10 });
      await s.page.mouse.up();
      await s.testid('comic-cut').click();
      // Selecting the first panel shows its corners on the page.
      await s.testid('comic-panel-1').click();
      await s.shot();
    },
  },
  {
    id: 'comic-balloon',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      // The balloon popover, with the balloon's whole row in view.
      await comicBalloon(s);
      await s.shot();
    },
  },
  {
    id: 'comic-balloon-list',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      // The balloon popover: every kind drawn as it looks.
      await s.testid('comic-bubbles').click();
      await s.testid('comic-add-flash').waitFor();
      await s.shot();
    },
  },
  {
    id: 'comic-balloon-shape',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      await s.testid('comic-bubbles').click();
      await s.testid('comic-add-explosion').click();
      await s.page.getByRole('textbox', { name: s.msg('comic.bubble.text') }).fill('!?');
      // Show the points of the outline, and pull one of them out so the shape is plainly changed.
      await s.testid('comic-bubble-shape').click();
      const point = await s.testid('comic-bubble-point').nth(3).boundingBox();
      await s.page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
      await s.page.mouse.down();
      await s.page.mouse.move(point.x + 70, point.y + 40, { steps: 6 });
      await s.page.mouse.up();
      await s.shot();
    },
  },
  {
    id: 'comic-tail',
    query: EMPTY,
    run: async (s) => {
      await comicPage(s);
      // Panel 1: a speech balloon whose text runs vertically.
      await comicBalloon(s);
      await s.testid('comic-bubble-vertical').click();
      await s.page.keyboard.press('Escape');
      // Panel 2: drawn from its prompt in the side panel, then a thought balloon, left selected so the handle at its tail's tip shows.
      await s.testid('comic-panel-2').click();
      await s.testid('positive-prompt').fill('a sailing boat at sunrise');
      await s.testid('invoke-button').click();
      await s.testid('comic-panel-2').locator('img').waitFor({ timeout: 30_000 });
      await s.testid('comic-bubbles').click();
      await s.testid('comic-add-thought').click();
      await s.page.getByRole('textbox', { name: s.msg('comic.bubble.text') }).fill('Hmm...');
      // The largest text size (the last choice), so the balloon and its handle are easy to see.
      await s.page.getByRole('combobox', { name: s.msg('comic.bubble.size') }).click();
      await s.page.getByRole('option').last().click();
      await s.testid('comic-bubble-tail').waitFor();
      // Escape closes the balloon editor and keeps the balloon chosen, so the page shows it and the handle at its tail's tip.
      await s.page.keyboard.press('Escape');
      await s.shot();
    },
  },

  // --- the assistant, settings and help ---------------------------------------------------------------------------------
  {
    id: 'agent',
    run: async (s) => {
      await s.testid('agent-open').click();
      await s.testid('agent-window').waitFor();
      await s.shot();
    },
  },
  {
    id: 'agent-server',
    run: async (s) => {
      await s.testid('agent-open').click();
      await s.testid('agent-window').waitFor();
      await s.testid('agent-choose-openai').click();
      await s.testid('agent-endpoint-preset-ollama').click();
      await s.testid('agent-endpoint-models-found').waitFor();
      await s.testid('agent-endpoint-model').fill('qwen3:8b');
      await s.testid('agent-endpoint-test').click();
      await s.testid('agent-endpoint-result').waitFor();
      await s.shot();
    },
  },
  {
    id: 'settings',
    run: async (s) => {
      await fromSettingsMenu(s, 'app.nav.settings');
      await s.testid('settings-modal').waitFor();
      await s.testid('settings-tab-general').click();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'settings-backup',
    run: async (s) => {
      await fromSettingsMenu(s, 'app.nav.settings');
      await s.testid('settings-tab-data').click();
      await s.testid('settings-backup').scrollIntoViewIfNeeded();
      await s.hideText(s.msg('share.backup.mockNote'));
      await s.shot(s.dialog());
    },
  },
  {
    id: 'restore-confirm',
    run: async (s) => {
      await fromSettingsMenu(s, 'app.nav.settings');
      await s.testid('settings-tab-data').click();
      await s.testid('backup-restore').click();
      await s.testid('restore-confirm').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'hotkeys',
    run: async (s) => {
      await fromSettingsMenu(s, 'app.nav.hotkeys');
      await s.testid('hotkeys-modal').waitFor();
      await s.shot(s.dialog());
    },
  },
  {
    id: 'about',
    run: async (s) => {
      await fromSettingsMenu(s, 'app.nav.about');
      await s.testid('about-modal').waitFor();
      await s.hideText(s.msg('settings.about.mockNote'));
      await s.shot(s.dialog());
    },
  },
  // --- the phone layout -------------------------------------------------------------------------------------------------
  {
    id: 'phone-generate',
    query: EMPTY,
    run: async (s) => {
      await onPhone(s);
      await phoneModel(s);
      await s.testid('positive-prompt').fill(PROMPT);
      await s.shot();
    },
  },
  {
    id: 'phone-picture',
    run: async (s) => {
      await onPhone(s);
      await s.testid('phone-nav-images').click();
      await s.testid('phone-thumb').nth(1).click();
      await s.testid('phone-view-info').click();
      await s.testid('phone-view-meta').waitFor();
      await s.shot();
    },
  },
  {
    id: 'phone-queue',
    query: EMPTY,
    // Slow steps, so the first picture is still being drawn and the second waits.
    settings: { mockStepDelay: 700 },
    run: async (s) => {
      await onPhone(s);
      await phoneModel(s);
      await s.testid('positive-prompt').fill(PROMPT);
      await s.testid('invoke-button').click();
      await s.testid('invoke-button').click();
      await s.testid('phone-nav-queue').click();
      await s.page.locator('[data-testid="phone-queue-item"][data-status="in_progress"] img').waitFor();
      await s.shot();
    },
  },
  {
    id: 'phone-chat',
    query: EMPTY,
    run: async (s) => {
      // Signing in is the computer's: in the desktop window first, then the phone's chat screen.
      await s.testid('agent-open').click();
      await s.testid('agent-choose-claude').click();
      await s.testid('agent-input').waitFor({ timeout: 10_000 });
      await s.page.getByRole('button', { name: s.msg('agent.close') }).click();
      await onPhone(s);
      await s.testid('phone-chat-open').click();
      await s.page.getByRole('button', { name: s.msg('agent.suggestion.anime') }).click();
      await s.page.locator('[data-testid="agent-msg-assistant"]:not(.agent-msg--thinking)').waitFor({ timeout: 15_000 });
      await s.shot();
    },
  },
];
