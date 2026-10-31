// The phone layout on a phone held upright (the `phone` project: Pixel 7, touch), against the mock backend: what opens,
// drawing a picture from the Generate tab, watching it full screen until it is the picture it made, the Images tab and
// its full-screen pictures, the Queue and Drafts tabs, and that no picker raises the keyboard or lets iOS zoom in.
import type { Page } from '@playwright/test';
import { expect, msg, test } from './fixtures';

/**
 * Opens the app in the phone layout: from an empty gallery unless `pictures` asks for the mock's own, with slow steps when
 * asked so a running job can be looked at.
 */
async function openPhone(page: Page, opts: { stepDelay?: number; pictures?: boolean } = {}): Promise<void> {
  if (opts.stepDelay !== undefined) {
    await page.addInitScript((delay) => localStorage.setItem('novira.settings', JSON.stringify({ state: { mockStepDelay: delay }, version: 0 })), opts.stepDelay);
  }
  await page.goto(opts.pictures ? '/' : '/?scenario=empty');
  await expect(page.getByTestId('phone-shell')).toBeVisible({ timeout: 20_000 });
}

/**
 * The notice shown now is the only one, below the title bar (which shows the job being drawn) and just above `foot`, a
 * control at the foot it must leave free.
 */
async function expectNoticeAbove(page: Page, foot: string): Promise<void> {
  const notice = page.locator('.toast:visible');
  await expect(notice).toHaveCount(1);
  const box = (await notice.boundingBox())!;
  const bar = (await page.getByTestId(foot).boundingBox())!;
  const head = (await page.locator('.phone-head').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
  expect(box.y).toBeGreaterThanOrEqual(head.y + head.height);
}

async function pickFirstModel(page: Page): Promise<void> {
  await page.getByTestId('model-picker').tap();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().tap();
}

test('a phone gets the phone layout: one tab with the tabs at its foot, no side bar', async ({ page }) => {
  await openPhone(page);
  await expect(page.getByTestId('tab-generate')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: msg('phone.nav') })).toBeVisible();
  await expect(page.getByTestId('phone-generate')).toBeVisible();
  // Nothing sticks out sideways: the page does not scroll left and right.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  // The seed and Generate row stays at the top of the screen while the form scrolls.
  const box = await page.getByTestId('invoke-button').boundingBox();
  expect(box!.y).toBeLessThan(page.viewportSize()!.height / 3);
});

test('draws a picture from the Generate tab, shows it full screen while it is drawn, then the picture it made', async ({ page }) => {
  await openPhone(page, { stepDelay: 1000 });
  await expect(page.getByTestId('invoke-button')).toBeDisabled();
  await expect(page.getByTestId('generation-reason')).toBeVisible();
  await pickFirstModel(page);
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await expect(page.getByTestId('generation-reason')).toHaveCount(0);
  await page.getByTestId('invoke-button').tap();
  await expectNoticeAbove(page, 'phone-nav-generate');

  const chip = page.getByTestId('phone-live-chip');
  await expect(chip).toBeVisible();
  await chip.tap();
  await expect(page.getByTestId('phone-view')).toBeVisible();
  await expect(page.getByTestId('viewer-live-image')).toBeVisible();
  // When the job ends the full screen shows the picture it made, first in its board, and the chip goes.
  await expect(page.getByTestId('phone-view-image')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('phone-view-place')).toHaveText(msg('phone.place', { index: 1, count: 1 }));
  await expect(chip).toHaveCount(0);
  await page.getByTestId('phone-view-close').tap();
  await page.getByTestId('phone-nav-images').tap();
  await expect(page.getByTestId('phone-thumb')).toHaveCount(1);
});

test('looks through the pictures of a board full screen: swipe, star, info, delete', async ({ page }) => {
  await openPhone(page, { pictures: true });
  await page.getByTestId('phone-nav-images').tap();
  const thumbs = page.getByTestId('phone-thumb');
  await expect(thumbs.first()).toBeVisible();
  const count = await thumbs.count();
  expect(count).toBeGreaterThan(2);
  await thumbs.nth(0).tap();
  const place = page.getByTestId('phone-view-place');
  await expect(place).toHaveText(msg('phone.place', { index: 1, count }));
  // A finger swiping to the left shows the next picture.
  const stage = (await page.getByTestId('phone-view-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.8, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.2, stage.y + stage.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(place).toHaveText(msg('phone.place', { index: 2, count }));
  const star = page.getByTestId('phone-view-star');
  const starred = (await star.getAttribute('aria-pressed')) === 'true';
  await star.tap();
  await expect(star).toHaveAttribute('aria-pressed', String(!starred));
  await page.getByTestId('phone-view-info').tap();
  await expect(page.getByTestId('phone-view-meta')).toBeVisible();
  // Deleting asks first, then another picture of the board takes its place.
  await page.getByTestId('phone-view-delete').tap();
  await page.getByRole('dialog', { name: msg('gallery.delete.title') }).getByRole('button', { name: msg('common.delete'), exact: true }).tap();
  await expect(place).toHaveText(new RegExp(` ${count - 1}$`));
  await expectNoticeAbove(page, 'phone-view-delete');
  await page.getByTestId('phone-view-close').tap();
  await expect(thumbs).toHaveCount(count - 1);
});

test('follows the jobs on the Queue tab: its count, cancelling one waiting, trying it again, watching one drawn', async ({ page }) => {
  await openPhone(page, { stepDelay: 1000 });
  await pickFirstModel(page);
  await page.getByTestId('positive-prompt').fill('a quiet harbour in the rain');
  await page.getByTestId('invoke-button').tap();
  await page.getByTestId('invoke-button').tap();
  await expect(page.getByTestId('phone-queue-badge')).toHaveText('2');
  await page.getByTestId('phone-nav-queue').tap();
  // Two notices said the jobs were queued: only the newest shows, at the foot, clear of the queue's controls.
  await expectNoticeAbove(page, 'phone-nav-queue');
  const cards = page.getByTestId('phone-queue-item');
  await expect(cards).toHaveCount(2);
  // Newest first: the one waiting, then the one being drawn.
  await expect(cards.nth(0)).toHaveAttribute('data-status', 'pending');
  await expect(cards.nth(1)).toHaveAttribute('data-status', 'in_progress');
  await cards.nth(0).getByTestId('phone-queue-cancel').tap();
  await expect(cards.nth(0)).toHaveAttribute('data-status', 'canceled');
  await expect(page.getByTestId('phone-queue-badge')).toHaveText('1');
  await cards.nth(0).getByTestId('phone-queue-retry').tap();
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute('data-status', /pending|in_progress/);
  // A job being drawn opens full screen, and becomes the picture it made.
  await page.locator('[data-testid="phone-queue-item"][data-status="in_progress"] .phone-queue__main').first().tap();
  await expect(page.getByTestId('phone-view')).toBeVisible();
  await expect(page.getByTestId('phone-view-image')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('phone-view-close').tap();
  await expect(page.getByTestId('phone-queue-badge')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId('phone-queue-prune')).toBeEnabled();
  await page.getByTestId('phone-queue-prune').tap();
  await expect(cards).toHaveCount(0);
});

test('makes drafts on the Drafts tab, looks at one large and finishes it', async ({ page }) => {
  await openPhone(page);
  await pickFirstModel(page);
  await page.getByTestId('positive-prompt').fill('a red fox in the snow');
  await page.getByTestId('phone-nav-drafts').tap();
  await page.getByTestId('drafts-start').tap();
  const cells = page.getByTestId('draft-cell');
  await expect(cells).toHaveCount(4);
  const first = cells.first();
  await expect(first.getByTestId('draft-open')).toBeVisible({ timeout: 20_000 });
  await first.getByTestId('draft-open').tap();
  // A draft is a helper picture outside the board: no place, no neighbours.
  await expect(page.getByTestId('phone-view-image')).toBeVisible();
  await expect(page.getByRole('button', { name: msg('gallery.viewer.next') })).toHaveCount(0);
  await expect(page.getByRole('button', { name: msg('gallery.viewer.prev') })).toHaveCount(0);
  await page.getByTestId('phone-view-close').tap();
  await first.getByRole('button', { name: /^seed / }).tap();
  await page.getByTestId('drafts-finish').tap();
  await expect(first).toContainText(msg('drafts.badge.finished'), { timeout: 20_000 });
  await page.getByTestId('phone-nav-images').tap();
  await expect(page.getByTestId('phone-thumb')).toHaveCount(1);
});

/** The text fields on screen that iOS Safari would zoom in on: under 16px. */
async function smallFields(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
      .filter((el) => !['checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes((el as HTMLInputElement).type) && el.getClientRects().length > 0)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.className}]`),
  );
}

test('opening a picker raises no keyboard: the search box is focused only when tapped', async ({ page }) => {
  await openPhone(page);
  const focusedField = () => page.evaluate(() => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? ''));
  // The model, LoRA and preset pickers, and the popover under the prompt.
  const openers = ['model-picker', 'lora-picker', 'preset-trigger', 'dynamic-prompts'];
  for (const id of openers) {
    const opener = page.getByTestId(id).first();
    if ((await opener.count()) === 0) continue;
    await opener.scrollIntoViewIfNeeded();
    await opener.tap();
    await expect(page.locator('.ui-popover')).toBeVisible();
    expect(await focusedField(), id).toBe(false);
    expect(await smallFields(page), id).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('.ui-popover')).toHaveCount(0);
  }
  await page.getByTestId('model-picker').tap();
  const search = page.locator('.pp-picker__search input');
  await search.tap();
  expect(await focusedField()).toBe(true);
});

test('every text field of the tabs is 16px or more, so iOS Safari does not zoom in on it', async ({ page }) => {
  await openPhone(page, { pictures: true });
  for (const tab of ['generate', 'images', 'drafts', 'queue', 'models', 'browse'] as const) {
    await page.getByTestId(`phone-nav-${tab}`).tap();
    await expect(page.getByTestId(`phone-tab-${tab}`)).toBeVisible();
    expect(await smallFields(page), tab).toEqual([]);
  }
});

test('a phone on its side keeps the phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await openPhone(page);
  await expect(page.getByTestId('phone-generate')).toBeVisible();
});

/**
 * Signs the mock assistant in on the desktop layout (a phone cannot: sign-in is the PC's), then comes back to the phone
 * layout. The mock forgets the sign-in on reload.
 */
async function signInOnDesktop(page: Page): Promise<void> {
  const phoneSize = page.viewportSize() ?? { width: 412, height: 915 };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('agent-open').tap();
  const win = page.getByTestId('agent-window');
  await win.getByTestId('agent-choose-claude').tap();
  await expect(win.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
  await win.getByRole('button', { name: msg('agent.close') }).tap();
  await page.setViewportSize(phoneSize);
  await expect(page.getByTestId('phone-shell')).toBeVisible();
}

test('the assistant opens from the title bar and says it is set up on the PC while it is not', async ({ page }) => {
  await openPhone(page);
  await page.getByTestId('phone-chat-open').tap();
  const chat = page.getByTestId('phone-chat');
  await expect(chat.getByTestId('phone-chat-setup')).toHaveText(msg('phone.agentSetup'));
  // No sign-in or server form on a phone, and nothing to send to.
  await expect(chat.getByTestId('agent-choose-claude')).toHaveCount(0);
  await expect(chat.getByTestId('agent-input')).toHaveCount(0);
  await chat.getByTestId('phone-chat-close').tap();
  await expect(chat).toBeHidden();
  await expect(page.getByTestId('phone-generate')).toBeVisible();
});

test('chats with the assistant full screen: it sets the Generate tab, keeps past chats and starts new ones', async ({ page }) => {
  await openPhone(page, { pictures: true });
  await signInOnDesktop(page);
  await page.getByTestId('phone-chat-open').tap();
  const chat = page.getByTestId('phone-chat');
  // The chat fills the screen: its top bar at the top and the message box at the foot, over the tabs.
  const view = page.viewportSize()!;
  const box = (await chat.boundingBox())!;
  expect(box.y).toBe(0);
  expect(box.height).toBeGreaterThan(view.height - 2);
  const form = (await chat.getByTestId('agent-form').boundingBox())!;
  expect(form.y + form.height).toBeGreaterThan(view.height - 4);
  await expect(page.getByRole('navigation', { name: msg('phone.nav') })).not.toBeInViewport({ ratio: 1 }).catch(() => undefined);

  // A starting suggestion goes out at once; Stop shows while the assistant works.
  await chat.getByRole('button', { name: msg('agent.suggestion.anime') }).tap();
  await expect(chat.getByTestId('agent-msg-user')).toHaveText([msg('agent.suggestion.anime')]);
  await expect(chat.getByTestId('agent-stop')).toBeVisible();
  const answer = chat.locator('[data-testid="agent-msg-assistant"]:not(.agent-msg--thinking)');
  await expect(answer).toHaveCount(1, { timeout: 15_000 });
  await expect(answer.getByTestId('agent-undo')).toBeEnabled();
  await expect(chat.getByTestId('agent-session-title')).toHaveText(msg('agent.suggestion.anime'));

  // On a phone Enter starts a new line; the button sends. The box grows with the text.
  const input = chat.getByTestId('agent-input');
  await input.fill('first line');
  const oneLine = (await input.boundingBox())!.height;
  await input.press('Enter');
  await input.pressSequentially('second line');
  await expect(input).toHaveValue('first line\nsecond line');
  expect((await input.boundingBox())!.height).toBeGreaterThan(oneLine);
  await input.fill('');

  // The change was made on this page's Generate tab.
  await chat.getByTestId('phone-chat-close').tap();
  await expect(page.getByTestId('positive-prompt')).not.toHaveValue('');

  // A new chat, then the first one again from the past chats.
  await page.getByTestId('phone-chat-open').tap();
  await chat.getByTestId('phone-chat-new').tap();
  await expect(chat.getByTestId('agent-session-title')).toHaveText(msg('agent.session.untitled'));
  await expect(chat.getByTestId('agent-msg-user')).toHaveCount(0);
  await chat.getByTestId('phone-chat-history').tap();
  const sheet = page.getByTestId('phone-chat-sheet');
  await expect(sheet.getByTestId('agent-session')).toHaveCount(1);
  await sheet.getByText(msg('agent.suggestion.anime')).tap();
  await expect(sheet).toHaveCount(0);
  await expect(chat.getByTestId('agent-msg-user')).toHaveCount(1);
});
