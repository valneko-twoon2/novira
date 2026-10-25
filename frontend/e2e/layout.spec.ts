// The layout scan: every screen of the browser mock and the dialogs that are cheap to open, in ja and en, dark and light,
// checked for the faults people kept finding by eye (layoutRules.ts): a control sticking out of its box or the window, text
// cut off or shortened to "…" where it should not be, buttons and fields with no gap between them, boxes that overlap.
// The same pass checks that text fits (textFit.ts): no label cut off, sticking out of its button or broken in two, and no
// tooltip, menu or dialog running out of the window; on the main screens also every tooltip a control shows and every
// menu, popover or picker it opens. Add a surface here when a screen or dialog is added.
//
// Each surface is opened once per language. Every step is measured in the dark theme, then the theme is switched in
// place to light and the layout measured again (layoutScan.ts, measureInTheme): the themes differ only in colours
// (theme/tokens.css), so the boxes are the same and only the rules that look at colours (which boxes are drawn, so which
// can touch) can find something new. Text fit, tooltips and menus depend on the boxes only, so they run in the dark theme.
//
// Runs as the `layout` Playwright project through `node tools/layout-scan.mjs`, which records a pass for the pre-commit
// hook. LAYOUT_LOCALES picks the languages (`ja,en` by default, `all` for every language the app has).
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';
import { layoutFaults, type LayoutFault } from './layoutRules';
import { findLayoutFaults, measureInTheme, snapshotLayout } from './layoutScan';
import { checkOpeners, findFitProblems, sweepTooltips, type FitProblem } from './textFit';

type Locale = 'ja' | 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'ru' | 'es' | 'pt-BR' | 'fr' | 'de';
const ALL_LOCALES: Locale[] = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'ru', 'es', 'pt-BR', 'fr', 'de'];
const wanted = (process.env.LAYOUT_LOCALES ?? 'ja,en').trim();
const LOCALES = (wanted === 'all' ? ALL_LOCALES : wanted.split(',').map((l) => l.trim())).filter((l): l is Locale => (ALL_LOCALES as string[]).includes(l));
/** LAYOUT_SHOTS names a folder (under novira-data/work/) that gets a screenshot of every step scanned, to look at by eye. */
const SHOTS = process.env.LAYOUT_SHOTS;

/** What a step checks besides the layout in both themes and the text fit. */
interface StepChecks {
  /** Show and check every tooltip of the screen. */
  tooltips?: boolean;
  /** Open and check every menu, popover and picker of the screen (and these extra buttons). Changes the screen, so it is the last step. */
  openers?: boolean | string[];
  /** Text fit only: the state before the folded sections are opened. */
  fitOnly?: boolean;
  /** Also the tooltips and openers of the parts every screen shares (SHARED); only the Generate tab sets it. */
  shared?: boolean;
}

/**
 * The parts that look the same on every screen: the side bar, the gallery panel and the Invoke bar. Their layout is
 * measured on every screen, but their tooltips and menus only once (on the Generate tab): opening them again on each
 * screen took a fifth of the scan and finds nothing new.
 */
const SHARED = '.sidenav, [data-testid="gallery-panel"], [data-testid="invoke-bar"]';

type Scan = (step: string, checks?: StepChecks) => Promise<void>;

/** A surface: how to bring it up; `scan` is called once it shows (several times for a surface with steps). */
type Surface = (page: Page, locale: Locale, scan: Scan) => Promise<void>;

/** The tooltips and the openers of a main screen. */
const ALL: StepChecks = { tooltips: true, openers: true };

async function openSettingsMenu(page: Page, locale: Locale): Promise<void> {
  await page.getByRole('button', { name: msg('app.nav.settingsMenu', {}, locale) }).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

async function openMenuItem(page: Page, locale: Locale, key: string): Promise<void> {
  await openSettingsMenu(page, locale);
  await page.getByRole('menuitem', { name: msg(key, {}, locale) }).click();
}

/** Opens every folded section of the screen (the parameter panels), so what is inside them is scanned too. */
async function expandSections(page: Page): Promise<void> {
  for (let n = 0; n < 40; n++) {
    const folded = page.locator('.ui-section__toggle[aria-expanded="false"]:visible').first();
    if ((await folded.count()) === 0) return;
    await folded.click();
  }
}

/** Waits until the screen has settled: what the mock answers, a lazy part, a picture. */
const settle = (page: Page) => page.waitForTimeout(300);

const tab =
  (name: string, checks: StepChecks = ALL): Surface =>
  async (page, _locale, scan) => {
    if (name === 'extensions') await page.getByTestId('tab-extensions').click();
    else await showTab(page, name);
    if (name === 'browse') {
      await expect(page.getByTestId('browse-card').first()).toBeVisible();
      await expect(page.locator('.browse-skeleton')).toHaveCount(0);
    }
    await settle(page);
    await scan(`${name} folded`, { fitOnly: true });
    await expandSections(page);
    await settle(page);
    await scan(name, checks);
  };

const media =
  (kind: string): Surface =>
  async (page, _locale, scan) => {
    await page.getByTestId(`media-${kind}`).click();
    await settle(page);
    await scan(`${kind} folded`, { fitOnly: true });
    await expandSections(page);
    await settle(page);
    await scan(kind, ALL);
  };

async function openAssistantChat(page: Page, provider: 'claude' | 'codex' = 'claude') {
  await page.getByTestId('agent-open').click();
  const win = page.getByTestId('agent-window');
  await win.getByTestId(`agent-choose-${provider}`).click();
  await expect(win.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
  return win;
}

const SURFACES: Record<string, Surface> = {
  // The side bar is on every screen, so the Generate tab scans it too.
  'generate tab and side bar': tab('generate', { ...ALL, shared: true }),
  'comic tab': tab('comic'),
  'canvas tab': tab('canvas'),
  'upscaling tab': tab('upscaling'),
  'workflows tab': tab('workflows'),
  'models tab': tab('models'),
  'browse tab': tab('browse'),
  'queue tab': tab('queue'),
  'extensions tab': tab('extensions', {}),
  'video screen': media('video'),
  'music screen': media('music'),
  'voice screen': media('voice'),
  'logo screen': media('logo'),
  'text screen': media('text'),
  'settings menu': async (page, locale, scan) => {
    await openSettingsMenu(page, locale);
    await scan('menu');
  },
  'settings dialog, every pane': async (page, locale, scan) => {
    await openMenuItem(page, locale, 'app.nav.settings');
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    const panes = page.locator('[data-testid^="settings-tab-"]');
    for (let i = 0; i < (await panes.count()); i++) {
      await panes.nth(i).click();
      await page.waitForTimeout(150);
      await scan((await panes.nth(i).getAttribute('data-testid')) ?? String(i));
    }
  },
  'hotkeys dialog': async (page, locale, scan) => {
    await openMenuItem(page, locale, 'app.nav.hotkeys');
    await expect(page.getByTestId('hotkeys-modal')).toBeVisible();
    await scan('hotkeys');
  },
  'about dialog and licenses': async (page, locale, scan) => {
    await openMenuItem(page, locale, 'app.nav.about');
    const about = page.getByTestId('about-modal');
    await expect(about).toBeVisible();
    await scan('license');
    await about.getByRole('tab', { name: msg('settings.about.oss.title', {}, locale) }).click();
    await expect(page.getByTestId('about-oss-list')).toBeVisible();
    await scan('packages');
  },
  'gallery settings and picture menu': async (page, _locale, scan) => {
    await page.getByTestId('gallery-settings').click();
    await settle(page);
    await scan('settings');
    await page.keyboard.press('Escape');
    await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await scan('menu');
  },
  'dialogs of the picture menu': async (page, locale, scan) => {
    const items = ['gallery.menu.segment', 'gallery.menu.batch', 'gallery.derive.custom', 'facefix.menu', 'share.menu', 'share.check.title', 'xyplot.menu', 'gallery.menu.trim'];
    for (const key of items) {
      await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
      const item = page.getByRole('menuitem', { name: msg(key, {}, locale), exact: true });
      // A submenu's item (derive) sits under its parent menu entry.
      if (!(await item.isVisible().catch(() => false))) await page.getByRole('menuitem', { name: msg('gallery.derive.menu', {}, locale) }).first().hover().catch(() => {});
      if (!(await item.isVisible().catch(() => false))) {
        await page.keyboard.press('Escape');
        continue;
      }
      await item.click();
      await page.waitForTimeout(400);
      await scan(key);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    }
  },
  'picture viewer and the dialogs its buttons open': async (page, locale, scan) => {
    await page.getByTestId('gallery-thumb').first().click();
    await page.getByRole('tab', { name: msg('app.views.viewer', {}, locale), exact: true }).click();
    await expect(page.getByTestId('viewer-toolbar')).toBeVisible();
    const openers = ['segment', 'cutout', 'facefix', 'manga', 'caption', 'character', 'share', 'derive'].map((x) => `[data-testid="viewer-${x}"]`);
    await scan('viewer', { tooltips: true, openers });
  },
  'workflow library and node picker': async (page, _locale, scan) => {
    await showTab(page, 'workflows');
    await page.keyboard.press('Shift+A');
    await expect(page.getByTestId('wf-node-picker')).toBeVisible();
    await scan('node picker');
  },
  'model import and model view': async (page, _locale, scan) => {
    await showTab(page, 'models');
    await page.getByTestId('mm-item').first().click();
    await expect(page.getByTestId('mm-model-view')).toBeVisible();
    await scan('model');
    await page.getByTestId('mm-import').click();
    await settle(page);
    await scan('import');
  },
  'browse model detail': async (page, _locale, scan) => {
    await showTab(page, 'browse');
    await page.getByTestId('browse-card').first().click();
    await expect(page.getByTestId('browse-drawer')).toBeVisible();
    await scan('detail');
  },
  'extension detail': async (page, _locale, scan) => {
    await page.getByTestId('tab-extensions').click();
    await page.getByTestId('extension-item').first().click();
    await expect(page.getByTestId('extension-detail')).toBeVisible();
    await scan('detail');
  },
  'versions of ComfyUI and of an extension, and the search': async (page, _locale, scan) => {
    await page.getByTestId('tab-extensions').click();
    await expect(page.getByTestId('extensions-tab')).toBeVisible();
    await page.getByTestId('comfy-version').click();
    await page.getByTestId('comfy-version-toggle').click();
    await expect(page.getByTestId('comfy-version-row').first()).toBeVisible();
    await page.getByTestId('extension-item').filter({ hasText: 'ComfyUI_IPAdapter_plus' }).click();
    await expect(page.getByTestId('extension-detail')).toBeVisible();
    await page.getByTestId('pack-version-toggle').click();
    await expect(page.getByTestId('pack-version-row').first()).toBeVisible();
    await scan('versions');
    // The search box offers to ask the assistant about what it found.
    await page.getByTestId('ex-search').fill('comfy');
    await expect(page.getByTestId('ex-ask-results')).toBeVisible();
    await scan('search');
  },
  'assistant window': async (page, _locale, scan) => {
    await page.getByTestId('agent-open').click();
    const win = page.getByTestId('agent-window');
    await expect(win.getByTestId('agent-setup')).toBeVisible();
    await scan('setup');
    await win.getByTestId('agent-choose-claude').click();
    await expect(win.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
    await scan('chat');
  },
  'assistant on the comic screen': async (page, _locale, scan) => {
    await showTab(page, 'comic');
    await openAssistantChat(page);
    await scan('chat');
  },
  'question the assistant asks before it reads pictures or prompts': async (page, _locale, scan) => {
    const win = await openAssistantChat(page);
    await win.getByTestId('agent-input').fill('show my recent pictures');
    await win.getByTestId('agent-send').click();
    await expect(win.getByTestId('agent-permission')).toBeVisible({ timeout: 10_000 });
    await scan('permission');
  },
  "assistant's model and effort popover, with a model that takes every effort": async (page, _locale, scan) => {
    const win = await openAssistantChat(page, 'codex');
    await win.getByTestId('agent-model').click();
    await page.getByTestId('agent-model-gpt-mock-pro').click();
    await expect(page.getByTestId('agent-effort-ultra')).toBeVisible();
    await scan('effort');
  },
  'home network popover, open with the public-network warning': async (page, _locale, scan) => {
    await openApp(page, '?lan=public');
    await page.getByTestId('home-link-open').click();
    await expect(page.getByTestId('lan-public')).toBeVisible();
    await expect(page.getByTestId('home-link-code')).toBeVisible();
    await scan('public');
  },
  'home network popover, open with a phone asking and one paired': async (page, _locale, scan) => {
    await openApp(page, '?lan=open');
    await page.getByTestId('home-link-open').click();
    await expect(page.getByTestId('home-link-code')).toBeVisible();
    await expect(page.locator('[data-testid^="lan-pending-"]')).toHaveCount(1, { timeout: 15_000 });
    await scan('asking');
    await page.locator('[data-testid^="lan-allow-"]').click();
    await expect(page.locator('[data-testid^="lan-device-"]')).toHaveCount(1);
    await scan('paired');
  },
  'dynamic prompts popover': async (page, _locale, scan) => {
    await page.getByTestId('positive-prompt').fill('{red|blue}');
    await page.getByTestId('dynamic-prompts').click();
    await expect(page.locator('.pp-dyn')).toBeVisible();
    await scan('popover');
  },
  'pose presets window with a category open': async (page, _locale, scan) => {
    await page.getByTestId('tab-canvas').click();
    await page.getByTestId('canvas-tool-pose').click();
    await page.getByTestId('canvas-pose-presets').click();
    await page.getByTestId('canvas-pose-category-panel.two').click();
    await expect(page.getByTestId('canvas-pose-preset-faceToFace')).toBeVisible();
    await scan('presets', ALL);
  },
};

/** The phone layout at the size of a phone held upright (the size of the `phone` project). */
const PHONE_VIEWPORT = { width: 412, height: 915 };

const PHONE_SURFACES: Record<string, Surface> = {
  'phone generate tab': async (_page, _locale, scan) => {
    await scan('generate', ALL);
  },
  'phone images tab': async (page, _locale, scan) => {
    await page.getByTestId('phone-nav-images').click();
    await expect(page.getByTestId('phone-thumb').first()).toBeVisible();
    await scan('images', ALL);
  },
  'phone picture full screen': async (page, _locale, scan) => {
    await page.getByTestId('phone-nav-images').click();
    await page.getByTestId('phone-thumb').nth(1).click();
    await expect(page.getByTestId('phone-view-image')).toBeVisible();
    await scan('picture');
    await page.getByTestId('phone-view-info').click();
    await scan('picture with info', ALL);
  },
  'phone picture tools': async (page, locale, scan) => {
    // The picture menu's dialogs take the whole screen, the picture above its settings.
    await page.getByTestId('phone-nav-images').click();
    await page.getByTestId('phone-thumb').nth(1).click();
    for (const [key, testId, step] of [
      ['facefix.menu', 'facefix-dialog', 'fix the face'],
      ['cutout.menu', 'cutout-stage', 'remove background'],
      ['caption.menu', 'caption-dialog', 'describe as a prompt'],
    ] as const) {
      await page.getByTestId('phone-view-menu').click();
      await page.getByRole('menuitem', { name: msg(key, {}, locale), exact: true }).click();
      await expect(page.getByTestId(testId)).toBeVisible();
      await scan(step, ALL);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(testId)).toBeHidden();
    }
  },
  'phone models tab': async (page, _locale, scan) => {
    await page.getByTestId('phone-nav-models').click();
    await expect(page.getByTestId('model-manager')).toBeVisible();
    await scan('models', ALL);
  },
  'phone model detail': async (page, _locale, scan) => {
    await page.getByTestId('phone-nav-models').click();
    await page.locator('.mm-card-item').first().click();
    await expect(page.getByTestId('mm-model-view')).toBeVisible();
    await scan('model detail', ALL);
  },
  'phone prompt book': async (page, _locale, scan) => {
    await page.getByTestId('positive-open-book').click();
    await expect(page.getByTestId('prompt-book-screen')).toBeVisible();
    await scan('prompt book', ALL);
  },
  'phone browse tab': async (page, _locale, scan) => {
    await page.getByTestId('phone-nav-browse').click();
    await expect(page.getByTestId('browse-card').first()).toBeVisible();
    await scan('browse', ALL);
  },
  'phone queue tab': async (page, _locale, scan) => {
    // One job that fails, with its error, and one that makes a picture.
    await pickPhoneModel(page);
    for (const prompt of ['[fail] a fox', 'a fox in the snow']) {
      await page.getByTestId('positive-prompt').fill(prompt);
      await page.getByTestId('invoke-button').click();
    }
    await page.getByTestId('phone-nav-queue').click();
    await expect(page.locator('[data-testid="phone-queue-item"][data-status="failed"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="phone-queue-item"][data-status="completed"] img')).toBeVisible({ timeout: 20_000 });
    await scan('queue', ALL);
  },
  'phone drafts tab': async (page, _locale, scan) => {
    await pickPhoneModel(page);
    await page.getByTestId('phone-nav-drafts').click();
    await scan('drafts empty', ALL);
    await page.getByTestId('drafts-start').click();
    await expect(page.getByTestId('draft-open')).toHaveCount(4, { timeout: 20_000 });
    await scan('drafts', ALL);
  },
  'phone assistant chat': async (page, locale, scan) => {
    await page.getByTestId('phone-chat-open').click();
    await expect(page.getByTestId('phone-chat-setup')).toBeVisible();
    await scan('chat not set up');
    await page.getByTestId('phone-chat-close').click();
    // Signing in is the PC's: on the desktop layout (a wide window), then narrow again.
    const phoneSize = page.viewportSize() ?? { width: 390, height: 844 };
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('agent-open').click();
    await page.getByTestId('agent-choose-claude').click();
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('agent-window').getByRole('button', { name: msg('agent.close', {}, locale) }).click();
    await page.setViewportSize(phoneSize);
    await page.getByTestId('phone-chat-open').click();
    await expect(page.getByTestId('phone-chat')).toBeVisible();
    await scan('chat empty', ALL);
    await page.getByRole('button', { name: msg('agent.suggestion.anime', {}, locale) }).click();
    await expect(page.locator('[data-testid="agent-msg-assistant"]:not(.agent-msg--thinking)')).toHaveCount(1, { timeout: 15_000 });
    await scan('chat', ALL);
    await page.getByTestId('phone-chat-history').click();
    await expect(page.getByTestId('phone-chat-sheet')).toBeVisible();
    await scan('past chats');
  },
};

async function pickPhoneModel(page: Page): Promise<void> {
  await page.getByTestId('model-picker').click();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().click();
}

// The scan must find what it is for: a field wider than its box, a label cut to "…", two buttons with no gap, and it must
// leave alone what is fine (a joined button group, a name marked as designed to shorten).
test('the scan finds overflow, truncated text and touching buttons, and passes a sound layout', async ({ page }) => {
  await page.setContent(`
    <div style="width:120px;border:1px solid red;margin-bottom:8px"><select style="width:200px"><option>long</option></select></div>
    <button style="display:block;margin-bottom:8px;width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">a label that is far too long</button>
    <div style="display:flex;margin-bottom:8px"><button style="border:1px solid red;border-radius:4px">A</button><button style="border:1px solid red;border-radius:4px">B</button></div>
    <div style="display:flex;gap:8px;margin-bottom:8px"><button style="border:1px solid red;border-radius:4px">C</button><button style="border:1px solid red;border-radius:4px">D</button></div>
    <div style="display:flex;margin-bottom:8px"><button style="border:1px solid red;border-radius:0">E</button><button style="border:1px solid red;border-radius:0">F</button></div>
    <span data-truncate-ok style="display:block;width:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">a file name that is long</span>`);
  const kinds = (await findLayoutFaults(page)).map((f) => `${f.kind}:${f.text}`).sort();
  expect(kinds).toEqual(['overflow:long', 'touching:A', 'truncated:a label that is far too long']);
});

// A sticky bar is a surface of its own: the rows scrolled under it do not overlap it, but two of its own buttons still do.
test('the scan leaves alone rows scrolled under a sticky bar and finds an overlap inside the bar', async ({ page }) => {
  const row = '<button style="display:block;height:40px;margin-bottom:8px;border:1px solid red;border-radius:4px">row</button>';
  await page.setContent(`
    <div style="height:120px;overflow-y:auto">
      ${row.repeat(6)}
      <div style="position:sticky;bottom:0;display:flex;background:black">
        <button style="border:1px solid red;border-radius:4px">I</button><button style="margin-left:-6px;border:1px solid red;border-radius:4px">J</button>
      </div>
    </div>`);
  const kinds = (await findLayoutFaults(page)).map((f) => `${f.kind}:${f.text}`);
  expect(kinds).toEqual(['overlap:I']);
});

// Switching the theme in place must reach what only the light theme draws: here the borders that make two controls
// touch, behind a colour transition that would otherwise still show the dark colours.
test('the light pass finds two controls that touch only where the light theme draws their borders', async ({ page }) => {
  await page.setContent(`
    <style>
      [role="button"] { display: inline-block; padding: 4px; border: 1px solid transparent; border-radius: 4px; transition: border-color 2s; }
      :root[data-theme='light'] [role="button"] { border-color: red; }
    </style>
    <div style="display:flex"><span role="button">G</span><span role="button">H</span></div>`);
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  expect(await findLayoutFaults(page)).toEqual([]);
  const light = await measureInTheme(page, 'light', () => findLayoutFaults(page));
  expect(light.map((f) => `${f.kind}:${f.text}`)).toEqual(['touching:G']);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await findLayoutFaults(page)).toEqual([]);
});

// The text fit must find what it is for: a button that is too narrow and short for its label (the bug that cut a segmented
// switch in two), text cut off by a box, and a floating surface that runs out of the window.
test('the fit check finds a label that wraps in a fixed-height button, clipped text and a tooltip outside the window', async ({ page }) => {
  await page.setContent(`
    <button style="width:90px;height:28px">すべての組み合わせ</button>
    <div style="width:60px;overflow:hidden;white-space:nowrap">a long clipped sentence</div>
    <button style="width:200px;height:28px">Fits</button>
    <div class="ui-tooltip" style="position:fixed;left:-40px;top:10px">cut by the window edge</div>`);
  const found = await findFitProblems(page);
  expect(found.map((p) => p.kind).sort()).toEqual(['broken', 'clipped', 'offscreen', 'outside']);
  expect(found.some((p) => p.text === 'Fits')).toBe(false);
});

// The tooltip sweep must open what hovering opened: the tooltip of a button and of a span (which takes focus only for the
// sweep), check it and close it again, and leave alone a trigger that something else covers.
test('the tooltip sweep shows the tooltip of each trigger a pointer can reach and finds one outside the window', async ({ page }) => {
  await page.setContent(`
    <button data-state="closed" data-tip="inside" style="position:fixed;left:200px;top:200px">A</button>
    <span data-state="closed" data-tip="outside" style="position:fixed;left:300px;top:200px">B</span>
    <button data-state="closed" data-tip="covered" style="position:fixed;left:400px;top:200px">C</button>
    <div style="position:fixed;left:390px;top:190px;width:60px;height:60px;background:white"></div>
    <button data-state="closed" style="position:fixed;left:500px;top:200px">no tooltip</button>
    <script>
      for (const el of document.querySelectorAll('[data-tip]')) {
        el.addEventListener('focus', () => {
          const tip = document.createElement('div');
          tip.className = 'ui-tooltip';
          tip.textContent = el.dataset.tip;
          tip.style.cssText = 'position:fixed;top:10px;left:' + (el.dataset.tip === 'outside' ? '-40px' : '10px');
          document.body.append(tip);
        });
        el.addEventListener('blur', () => document.querySelector('.ui-tooltip')?.remove());
      }
    </script>`);
  const swept = await sweepTooltips(page);
  expect(swept.shown).toEqual(['inside', 'outside']);
  expect(swept.problems.map((p) => `${p.kind}:${p.text}`)).toEqual(['offscreen:outside']);
  // A trigger inside what `skip` names is left out.
  expect((await sweepTooltips(page, '[data-tip="outside"]')).shown).toEqual(['inside']);
  expect(await page.locator('.ui-tooltip').count()).toBe(0);
  expect(await page.locator('[tabindex]').count()).toBe(0);
});

// The opener check opens an opener repeated down a list once, still opens one of the same name in another box, and leaves
// out what `skip` names (the shared parts on every screen but the Generate tab).
test('the opener check opens a repeated opener once and leaves out the skipped parts', async ({ page }) => {
  await page.setContent(`
    <div data-testid="row"><button aria-haspopup="menu" aria-label="Menu">A</button></div>
    <div data-testid="row"><button aria-haspopup="menu" aria-label="Menu">B</button></div>
    <div data-testid="other"><button aria-haspopup="menu" aria-label="Menu">C</button></div>
    <nav class="shared"><button aria-haspopup="menu" aria-label="Menu">D</button></nav>
    <script>
      window.opened = [];
      for (const b of document.querySelectorAll('button')) b.addEventListener('click', () => window.opened.push(b.textContent));
    </script>`);
  await checkOpeners(page, [], { skip: '.shared' });
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['A', 'C']);
});

const layoutLine = (theme: string, step: string, f: LayoutFault) => `${theme} ${step}: ${f.kind} ${f.where} "${f.text}"${f.other ? ` / ${f.other}` : ''}`;
const fitLine = (step: string, p: FitProblem) => `fit ${step}: ${p.kind} ${p.where} "${p.text}"`;

for (const locale of LOCALES) {
  test.describe(`layout and text fit in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      // The dev log is on, as in a development build, so its entry in the side bar is scanned too.
      await page.addInitScript((language) => localStorage.setItem('novira.settings', JSON.stringify({ state: { language, theme: 'dark', showDevLog: true }, version: 0 })), locale);
      await page.setViewportSize({ width: 1600, height: 900 });
      await openApp(page);
    });

    for (const [name, open] of Object.entries(SURFACES)) test(name, ({ page }) => scanSurface(page, locale, name, open));
  });

  test.describe(`layout and text fit of the phone layout in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript((language) => localStorage.setItem('novira.settings', JSON.stringify({ state: { language, theme: 'dark' }, version: 0 })), locale);
      await page.setViewportSize(PHONE_VIEWPORT);
      await page.goto('/');
      await expect(page.getByTestId('phone-shell')).toBeVisible({ timeout: 20_000 });
    });

    for (const [name, open] of Object.entries(PHONE_SURFACES)) test(name, ({ page }) => scanSurface(page, locale, name, open));
  });
}

/** Opens a surface and scans each of its steps: layout in both themes, text fit, and the tooltips and openers asked for. */
async function scanSurface(page: Page, locale: Locale, name: string, open: Surface): Promise<void> {
  const faults: string[] = [];
  const shot = async (theme: string, step: string) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${locale}-${theme}-${name}-${step}.png`.replace(/[^\w.-]+/g, '_')) });
  };
  await open(page, locale, async (step, checks = {}) => {
    for (const p of await findFitProblems(page)) faults.push(fitLine(step, p));
    if (checks.fitOnly) return;
    for (const f of layoutFaults(await snapshotLayout(page))) faults.push(layoutLine('dark', step, f));
    await shot('dark', step);
    await measureInTheme(page, 'light', async () => {
      for (const f of layoutFaults(await snapshotLayout(page))) faults.push(layoutLine('light', step, f));
      await shot('light', step);
    });
    const skip = checks.shared ? undefined : SHARED;
    if (checks.tooltips) for (const p of (await sweepTooltips(page, skip)).problems) faults.push(fitLine(`${step} tooltip`, p));
    if (checks.openers) for (const p of await checkOpeners(page, checks.openers === true ? [] : checks.openers, { skip })) faults.push(fitLine(`${step} menu`, p));
  });
  expect(faults).toEqual([]);
}
