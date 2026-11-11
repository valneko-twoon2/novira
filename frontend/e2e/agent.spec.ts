// The AI assistant window: sign-in, chatting, attaching pictures, and keeping several chat sessions (new, switch,
// rename, delete, reload).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, galleryDefaults, msg, openApp, showTab, test } from './fixtures';

/** Opens the assistant and signs in to Claude (the mock forgets the sign-in on reload). */
async function openAssistant(page: Page): Promise<void> {
  await page.getByTestId('agent-open').click();
  const win = page.getByTestId('agent-window');
  await expect(win).toBeVisible();
  await win.getByTestId('agent-choose-claude').click();
  await expect(win.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
}

async function ask(page: Page, text: string, replies: number): Promise<void> {
  const win = page.getByTestId('agent-window');
  await win.getByTestId('agent-input').fill(text);
  await win.getByTestId('agent-send').click();
  await expect(win.locator('.agent-msg--assistant:not(.agent-msg--thinking)')).toHaveCount(replies, { timeout: 10_000 });
}

test(
  'the assistant sits beside the gallery in the right column, keeps the draft across screens and floats elsewhere',
  { tag: ['@scenario', '@state-transition'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    // Generate's right column now shows the chat instead of the gallery, with the AI in use on its bar.
    await expect(page.getByTestId('gallery-panel')).toHaveCount(0);
    const win = page.getByTestId('agent-window');
    await expect(win.getByTestId('agent-provider')).toHaveText('Claude');
    await win.getByTestId('agent-input').fill('half written');
    // Canvas shows the AI tab too, with the same draft.
    await showTab(page, 'canvas');
    await expect(page.getByTestId('agent-window')).toBeVisible();
    await expect(page.getByTestId('agent-window').getByTestId('agent-input')).toHaveValue('half written');
    // The screens without the column do not get it floating just because it was left open.
    for (const tab of ['models', 'browse']) {
      await showTab(page, tab);
      await expect(page.getByTestId('agent-window')).toHaveCount(0);
    }
    await showTab(page, 'canvas');
    // The Gallery tab brings the gallery back.
    await page.getByTestId('right-tab-gallery').click();
    await expect(page.getByTestId('gallery-panel')).toBeVisible();
    await expect(page.getByTestId('agent-window')).toHaveCount(0);
    // The extensions screen has no such column: a question asked there opens the floating window.
    await askFromExtensions(page);
    await expect(page.getByRole('dialog', { name: msg('agent.title') })).toBeVisible();
  },
);

/** Asks the assistant about an extension search, on the screen whose assistant floats in its window. */
async function askFromExtensions(page: Page): Promise<void> {
  await page.getByTestId('tab-extensions').click();
  await expect(page.getByTestId('extensions-tab')).toBeVisible();
  await page.getByTestId('ex-search').fill('comfy');
  await page.getByTestId('ex-ask-results').click();
}

test(
  'a picture attached from disk goes to the gallery and the assistant writes a prompt from it',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const picture = readFileSync(new URL('../public/mock-images/illust/01.webp', import.meta.url));
    await win.getByTestId('agent-attach-file').setInputFiles({ name: 'mine.webp', mimeType: 'image/webp', buffer: picture });
    await expect(win.getByTestId('agent-attached').locator('img')).toHaveCount(1);
    // Pictures alone are enough to send.
    await win.getByTestId('agent-send').click();
    await expect(win.locator('.agent-msg--user')).toHaveText([msg('agent.attach.defaultAsk')]);
    await expect(win.getByTestId('agent-msg-pictures').locator('img')).toHaveCount(1);
    await expect(win.getByTestId('agent-attached')).toHaveCount(0);
    await expect(win.locator('.agent-msg--assistant:not(.agent-msg--thinking)')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.getByTestId('positive-prompt')).toHaveValue(/summer sky/);
  },
);

test('the assistant keeps separate chat sessions across a reload', { tag: ['@scenario', '@state-transition'] }, async ({ page }) => {
  // Two chats, a reload and the session list in one flow: with every spec running in parallel (or recording coverage) it needs more than the default 30 s.
  test.slow();
  await openApp(page);
  await openAssistant(page);
  const win = page.getByTestId('agent-window');
  const title = win.getByTestId('agent-session-title');
  await expect(title).toHaveText(msg('agent.session.untitled'));

  await ask(page, 'a cat on a roof', 1);
  await expect(title).toHaveText('a cat on a roof');

  await win.getByTestId('agent-session-new').click();
  await expect(title).toHaveText(msg('agent.session.untitled'));
  await expect(win.getByText(msg('agent.greeting'))).toBeVisible();
  await ask(page, 'a dog in the rain', 1);
  await expect(win.locator('.agent-msg--user')).toHaveText(['a dog in the rain']);

  // The list shows the most recent chat first; picking the other one brings its messages back.
  await win.getByTestId('agent-session-toggle').click();
  const rows = win.getByTestId('agent-session');
  await expect(rows.locator('.agent-session__title')).toHaveText(['a dog in the rain', 'a cat on a roof']);
  await rows.nth(1).locator('.agent-session__pick').click();
  await expect(title).toHaveText('a cat on a roof');
  await expect(win.locator('.agent-msg--user')).toHaveText(['a cat on a roof']);

  await page.reload();
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 });
  await openAssistant(page);
  await expect(title).toHaveText('a cat on a roof');
  await expect(win.locator('.agent-msg--user')).toHaveText(['a cat on a roof']);

  // Rename, then delete the other chat after confirming.
  await win.getByTestId('agent-session-toggle').click();
  await rows.nth(1).getByTestId('agent-session-rename').click();
  await win.getByTestId('agent-session-name').fill('Roof cat');
  await win.getByTestId('agent-session-name').press('Enter');
  await expect(rows.nth(1).locator('.agent-session__title')).toHaveText('Roof cat');
  await rows.nth(0).getByTestId('agent-session-delete').click();
  await win.getByTestId('agent-session-delete-confirm').click();
  await expect(rows.locator('.agent-session__title')).toHaveText(['Roof cat']);
});

test(
  'a question asked from the extension manager is sent after signing in, and answered about that extension',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page);
    await page.getByTestId('tab-extensions').click();
    await page.getByTestId('extension-item').filter({ hasText: 'ComfyUI_IPAdapter_plus' }).click();
    await page.getByTestId('extension-ask').click();
    const win = page.getByTestId('agent-window');
    await expect(win.getByTestId('agent-setup')).toBeVisible();
    await win.getByTestId('agent-choose-claude').click();
    await expect(win.locator('.agent-msg--assistant:not(.agent-msg--thinking)')).toHaveCount(1, { timeout: 10_000 });
    await expect(win.locator('.agent-msg--user')).toContainText('ComfyUI_IPAdapter_plus');
    await expect(win.locator('.agent-msg--assistant')).toContainText('ComfyUI_IPAdapter_plus');
  },
);

test(
  'the assistant names the model it runs on, and shows its answer in Markdown as bold words and a list',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    // Before a choice the default model is named, with its version; there is no "default" and no typed name.
    await expect(win.getByTestId('agent-model')).toContainText('Sonnet 5.5');
    await win.getByTestId('agent-model').click();
    const pop = page.getByTestId('agent-model-pop');
    await expect(pop.getByTestId('agent-model-claude-sonnet-5-5')).toHaveAttribute('aria-pressed', 'true');
    await expect(pop.getByTestId('agent-model-default')).toHaveCount(0);
    await expect(pop.getByTestId('agent-model-custom')).toHaveCount(0);
    await pop.getByTestId('agent-model-claude-opus-5-5').click();
    await expect(win.getByTestId('agent-model')).toContainText('Opus 5.5');
    await page.keyboard.press('Escape');
    await ask(page, 'anime girl, watercolor', 1);
    const reply = win.locator('.agent-msg--assistant:not(.agent-msg--thinking)');
    await expect(reply.locator('li strong').first()).toBeVisible();
    await expect(reply.locator('li')).not.toHaveCount(0);
    await expect(reply).not.toContainText('**');
  },
);

test(
  'a request in flight can be cancelled, and the floating window size can be changed',
  { tag: ['@scenario', '@state-transition'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    await win.getByTestId('agent-input').fill('a cat on a roof');
    await win.getByTestId('agent-send').click();
    await win.getByTestId('agent-stop').click();
    await expect(win.locator('.agent-msg--assistant', { hasText: msg('agent.stopped') })).toBeVisible();
    await expect(win.getByTestId('agent-send')).toBeVisible();
    // Dragging the top-left corner makes the floating window bigger.
    await askFromExtensions(page);
    await expect(win).toHaveAttribute('role', 'dialog');
    const before = (await win.boundingBox())!;
    const grip = (await win.getByTestId('agent-resize-nw').boundingBox())!;
    await page.mouse.move(grip.x + 4, grip.y + 4);
    await page.mouse.down();
    await page.mouse.move(grip.x - 96, grip.y - 56, { steps: 6 });
    await page.mouse.up();
    const after = (await win.boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width + 50);
    expect(after.height).toBeGreaterThan(before.height + 20);
  },
);

test(
  'the assistant asks before it reads the gallery, and "always allow" stops the question',
  { tag: ['@condition', '@state-transition'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const replies = win.locator('.agent-msg--assistant:not(.agent-msg--thinking)');
    await win.getByTestId('agent-input').fill('最近の画像を見て');
    await win.getByTestId('agent-send').click();
    await win.getByTestId('agent-permission-deny').click();
    await expect(replies).toHaveCount(1, { timeout: 10_000 });
    await expect(replies.last()).toContainText('許可がない');

    await win.getByTestId('agent-input').fill('最近の画像を見て');
    await win.getByTestId('agent-send').click();
    await win.getByTestId('agent-permission-always').click();
    await expect(replies).toHaveCount(2, { timeout: 10_000 });
    await expect(replies.last()).toContainText('最近の画像は');

    // From now on it reads without asking.
    await win.getByTestId('agent-input').fill('最近の画像を見て');
    await win.getByTestId('agent-send').click();
    await expect(replies).toHaveCount(3, { timeout: 10_000 });
    await expect(win.getByTestId('agent-permission')).toHaveCount(0);
  },
);

test(
  'the assistant connects to an Ollama-style server, shows a model without tools as such, and works after another model is chosen',
  { tag: ['@scenario', '@condition'] },
  async ({ page }) => {
    await openApp(page);
    await page.getByTestId('agent-open').click();
    const win = page.getByTestId('agent-window');
    await win.getByTestId('agent-choose-openai').click();
    // One click on the preset fills the address and reads the server's model list.
    await win.getByTestId('agent-endpoint-preset-ollama').click();
    await expect(win.getByTestId('agent-endpoint-url')).toHaveValue('http://127.0.0.1:11434/v1');
    await expect(win.getByTestId('agent-endpoint-models-found')).toBeVisible();
    await expect(win.getByTestId('agent-endpoint-warn-http')).toHaveCount(0);

    // Test connection says the model cannot use the app's tools, with the server's reason.
    await win.getByTestId('agent-endpoint-model').fill('gemma:2b');
    await win.getByTestId('agent-endpoint-test').click();
    await expect(win.getByTestId('agent-endpoint-tools')).toContainText('does not support tools');
    await win.getByTestId('agent-endpoint-save').click();
    await expect(win.getByTestId('agent-input')).toBeVisible();
    await expect(win.getByTestId('agent-provider')).toHaveText('OpenAI API');

    // Sending fails with a clear message, and the window now says so above the input.
    await ask(page, 'a cat on a roof', 1);
    await expect(win.locator('.agent-msg--assistant.is-error')).toContainText("cannot use the app's tools");
    await expect(win.getByTestId('agent-tools-banner')).toBeVisible();

    // Choosing a model that can call tools clears it, and the request works.
    await win.getByTestId('agent-model').click();
    // The picker opens in a popover outside the window.
    await page.getByTestId('agent-model-qwen3:8b').click();
    await expect(win.getByTestId('agent-model')).toContainText('qwen3:8b');
    await page.keyboard.press('Escape');
    await expect(win.getByTestId('agent-tools-banner')).toHaveCount(0);
    await ask(page, 'a dog in the rain', 2);
    await expect(win.locator('.agent-msg--assistant:not(.agent-msg--thinking)').last()).not.toHaveClass(/is-error/);
  },
);

test(
  'a server on another machine over plain http shows the unencrypted and the sent-away warnings',
  { tag: ['@condition'] },
  async ({ page }) => {
    await openApp(page);
    await page.getByTestId('agent-open').click();
    const win = page.getByTestId('agent-window');
    await win.getByTestId('agent-choose-openai').click();
    await win.getByTestId('agent-endpoint-url').fill('http://192.168.1.20:11434/v1');
    await expect(win.getByTestId('agent-endpoint-warn-http')).toBeVisible();
    await expect(win.getByTestId('agent-endpoint-warn-remote')).toBeVisible();
    await win.getByTestId('agent-endpoint-url').fill('http://127.0.0.1:11434/v1');
    await expect(win.getByTestId('agent-endpoint-warn-http')).toHaveCount(0);
  },
);

test(
  'the assistant draws one trial picture for a mood, shows it under its answer, and stops when the setting is off',
  { tag: ['@condition', '@scenario'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const replies = win.locator('.agent-msg--assistant:not(.agent-msg--thinking)');
    await win.getByTestId('agent-input').fill('夏っぽい雰囲気にして');
    await win.getByTestId('agent-send').click();
    // Looking at the trial picture reads the gallery, so it asks first.
    await win.getByTestId('agent-permission-once').click({ timeout: 20_000 });
    await expect(replies).toHaveCount(1, { timeout: 30_000 });
    await expect(replies.last()).toContainText('こんな雰囲気ですか');
    await expect(replies.last().getByTestId('agent-msg-pictures').locator('img')).toHaveCount(1);
    await expect(page.getByTestId('positive-prompt')).toHaveValue(/sunflower field/);

    // With trial pictures turned off in the settings, the same request draws nothing on its own.
    await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
    await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
    await page.getByTestId('settings-tab-generation').click();
    const toggle = page.getByRole('switch', { name: msg('settings.assistantTrial.label') });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await win.getByTestId('agent-input').fill('夏っぽい雰囲気にして');
    await win.getByTestId('agent-send').click();
    await expect(replies).toHaveCount(2, { timeout: 10_000 });
    await expect(replies.last()).not.toContainText('こんな雰囲気ですか');
    await expect(replies.last().getByTestId('agent-msg-pictures')).toHaveCount(0);
  },
);

test(
  'a trial picture made while new pictures wait in Candidates is still shown under the answer',
  { tag: ['@condition'] },
  async ({ page }) => {
    await galleryDefaults(page, { newPicturesToCandidates: true });
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const replies = win.locator('.agent-msg--assistant:not(.agent-msg--thinking)');
    await win.getByTestId('agent-input').fill('夏っぽい雰囲気にして');
    await win.getByTestId('agent-send').click();
    await win.getByTestId('agent-permission-once').click({ timeout: 20_000 });
    await expect(replies).toHaveCount(1, { timeout: 30_000 });
    await expect(replies.last().getByTestId('agent-msg-pictures').locator('img')).toHaveCount(1);
  },
);

test(
  'a refinement goes on by itself, one picture a round, until the assistant finishes',
  { tag: ['@state-transition'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    await win.getByTestId('agent-input').fill('何枚か生成しながら近づけていって');
    await win.getByTestId('agent-send').click();
    // Looking at the pictures reads the gallery: allowed once for all of the rounds.
    await win.getByTestId('agent-permission-always').click({ timeout: 20_000 });
    const replies = win.locator('.agent-msg--assistant:not(.agent-msg--thinking)');
    await expect(replies).toHaveCount(3, { timeout: 60_000 });
    await expect(replies.last()).toContainText('ここまでにします');
    // The app's own messages for the next pictures are notes with their numbers, not messages of the user.
    await expect(win.getByTestId('agent-msg-step')).toHaveText([msg('agent.refine.step', { n: 2, of: 3 }), msg('agent.refine.step', { n: 3, of: 3 })]);
    await expect(win.getByTestId('agent-msg-user')).toHaveCount(1);
    for (let i = 0; i < 3; i++) await expect(replies.nth(i).getByTestId('agent-msg-pictures').locator('img')).toHaveCount(1);
  },
);

test(
  'the token limit switch is in the chat, on at first, and stays as it was left after a reload',
  { tag: ['@state-transition'] },
  async ({ page }) => {
    await openApp(page, '?scenario=empty');
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const limit = win.getByRole('switch', { name: msg('agent.context.limit') });
    await expect(limit).toHaveAttribute('aria-checked', 'true');
    await ask(page, 'hello', 1);
    await expect(win.getByTestId('agent-context')).toContainText(msg('agent.context.limit'));
    await limit.click();
    await expect(limit).toHaveAttribute('aria-checked', 'false');
    // The estimate now reads without a limit.
    const [head, tail] = msg('agent.context.usageOff', { used: '@@' }).split('@@') as [string, string];
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(win.getByTestId('agent-context')).toContainText(new RegExp(`${escape(head)}[\\d.]+k?${escape(tail)}`));
    await page.reload();
    await openAssistant(page);
    await expect(win.getByRole('switch', { name: msg('agent.context.limit') })).toHaveAttribute('aria-checked', 'false');
  },
);

test(
  'the "/" list is grouped by feature, Tab leaves only the command, sending expands it, and /help explains the commands',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await openApp(page);
    await openAssistant(page);
    const win = page.getByTestId('agent-window');
    const input = win.getByTestId('agent-input');
    await expect(input).toHaveAttribute('placeholder', msg('agent.placeholder'));

    await input.fill('/');
    const list = win.getByTestId('agent-slash');
    await expect(list.getByRole('group').filter({ hasText: msg('agent.template.group.help') })).toContainText('/help');
    await expect(list).not.toContainText(msg('agent.template.pose.text').trim());

    await input.fill('/po');
    await input.press('Tab');
    await expect(input).toHaveValue('/pose ');
    await expect(list).toHaveCount(0);
    await input.pressSequentially('waving');
    await input.press('Enter');
    await expect(win.locator('.agent-msg--user').last()).toContainText(`${msg('agent.template.pose.text')}waving`);
    await expect(input).toHaveValue('');

    await input.fill('/help');
    await input.press('Enter');
    const help = win.getByTestId('agent-slash-help-panel');
    await expect(help).toContainText('/pose');
    await expect(help).toContainText(msg('agent.template.pose.text').trim());
    await input.press('Escape');
    await expect(help).toHaveCount(0);
  },
);
