// The AI assistant window: sign-in, chatting, attaching pictures, and keeping several chat sessions (new, switch,
// rename, delete, reload).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

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

test('a picture attached from disk goes to the gallery and the assistant writes a prompt from it', async ({ page }) => {
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
});

test('the assistant keeps separate chat sessions across a reload', async ({ page }) => {
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

test('a question asked from the extension manager is sent after signing in, and answered about that extension', async ({ page }) => {
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
});

test('a request in flight can be cancelled, and the window size can be changed', async ({ page }) => {
  await openApp(page);
  await openAssistant(page);
  const win = page.getByTestId('agent-window');
  await win.getByTestId('agent-input').fill('a cat on a roof');
  await win.getByTestId('agent-send').click();
  await win.getByTestId('agent-stop').click();
  await expect(win.locator('.agent-msg--assistant', { hasText: msg('agent.stopped') })).toBeVisible();
  await expect(win.getByTestId('agent-send')).toBeVisible();
  // Dragging the top-left corner makes the window bigger.
  const before = (await win.boundingBox())!;
  const grip = (await win.getByTestId('agent-resize-nw').boundingBox())!;
  await page.mouse.move(grip.x + 4, grip.y + 4);
  await page.mouse.down();
  await page.mouse.move(grip.x - 96, grip.y - 56, { steps: 6 });
  await page.mouse.up();
  const after = (await win.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 50);
  expect(after.height).toBeGreaterThan(before.height + 20);
});

test('the assistant asks before it reads the gallery, and "always allow" stops the question', async ({ page }) => {
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
});

test('the assistant connects to an Ollama-style server, shows a model without tools as such, and works after another model is chosen', async ({ page }) => {
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
});

test('a server on another machine over plain http shows the unencrypted and the sent-away warnings', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('agent-open').click();
  const win = page.getByTestId('agent-window');
  await win.getByTestId('agent-choose-openai').click();
  await win.getByTestId('agent-endpoint-url').fill('http://192.168.1.20:11434/v1');
  await expect(win.getByTestId('agent-endpoint-warn-http')).toBeVisible();
  await expect(win.getByTestId('agent-endpoint-warn-remote')).toBeVisible();
  await win.getByTestId('agent-endpoint-url').fill('http://127.0.0.1:11434/v1');
  await expect(win.getByTestId('agent-endpoint-warn-http')).toHaveCount(0);
});
