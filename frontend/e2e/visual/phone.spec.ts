// Visual regression of the phone layout: the tabs of a phone held upright, a picture full screen and the assistant's chat.
import { msg } from '../fixtures';
import { expect, inEachTheme, snap, test } from './shared';

inEachTheme((theme) => {
  test.describe('phone layout', () => {
    // A phone held upright, at scale 1 like every other shot here.
    test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

    test('generate tab', { tag: ['@scenario'] }, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await snap(page, 'phone', theme, 'generate');
    });

    test('images tab and a picture full screen', { tag: ['@scenario'] }, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('phone-nav-images').tap();
      await expect(page.getByTestId('phone-thumb').first()).toBeVisible();
      await snap(page, 'phone', theme, 'images');
      await page.getByTestId('phone-thumb').nth(1).tap();
      await page.getByTestId('phone-view-info').tap();
      await expect(page.getByTestId('phone-view-meta')).toBeVisible();
      await snap(page, 'phone', theme, 'picture');
    });

    test('queue tab and drafts tab', { tag: ['@scenario'] }, async ({ page }) => {
      // Drafts take seeds of their own: a fixed sequence of random numbers gives them the same seeds, so the same pictures.
      await page.addInitScript(() => {
        let state = 1;
        Math.random = () => (state = (state * 16807) % 2147483647) / 2147483647;
      });
      await page.goto('/?scenario=empty');
      await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('model-picker').tap();
      await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().tap();
      await page.getByTestId('seed-fixed').tap();
      // One job that fails, with its error, and one that makes a picture.
      for (const prompt of ['[fail] a lighthouse', 'a lighthouse on a cliff at dusk']) {
        await page.getByTestId('positive-prompt').fill(prompt);
        await page.getByTestId('invoke-button').tap();
      }
      await page.getByTestId('phone-nav-queue').tap();
      await expect(page.locator('[data-testid="phone-queue-item"][data-status="failed"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-queue-item"][data-status="completed"] img')).toBeVisible();
      await snap(page, 'phone', theme, 'queue');
      await page.getByTestId('phone-nav-drafts').tap();
      await page.getByTestId('drafts-start').tap();
      await expect(page.getByTestId('draft-open')).toHaveCount(4);
      await expect(page.getByTestId('phone-queue-badge')).toHaveCount(0);
      await snap(page, 'phone', theme, 'drafts');
    });

    test('assistant chat', { tag: ['@scenario'] }, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
      // Signing in is the PC's: by widening the window, then narrowing it back.
      const phoneSize = page.viewportSize() ?? { width: 412, height: 915 };
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByTestId('agent-open').tap();
      await page.getByTestId('agent-choose-claude').tap();
      await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('right-tab-gallery').tap();
      await page.setViewportSize(phoneSize);
      await page.getByTestId('phone-chat-open').tap();
      const chat = page.getByTestId('phone-chat');
      await chat.getByRole('button', { name: msg('agent.suggestion.anime') }).tap();
      await expect(chat.locator('[data-testid="agent-msg-assistant"]:not(.agent-msg--thinking)')).toHaveCount(1, { timeout: 15_000 });
      await snap(page, 'phone', theme, 'chat');
    });
  });
});
