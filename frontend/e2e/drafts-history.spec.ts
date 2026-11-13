// The draft history screen: every batch on one screen, narrowed by period and model, searched by prompt, opened in the
// flow of the Candidates view, and its settings put back in the Generate form.
import { expect, msg, openApp, test } from './fixtures';

const DAY = 86_400_000;

test(
  'the history screen finds a batch by model and prompt, opens it, and puts its settings back',
  { tag: ['@scenario'] },
  async ({ page }) => {
    await page.addInitScript((day) => {
      const now = Date.now();
      const batch = (n: number, model: string, prompt: string, ago: number) => ({
        id: `g${n}`,
        createdAt: now - ago,
        params: { generationMode: 'txt2img', modelName: model, modelKey: null, positivePrompt: prompt, negativePrompt: '', seed: n, steps: 20 + n, cfgScale: 5, scheduler: 'euler', width: 832, height: 1216, loras: [] },
        boardId: null,
        position: 0.35,
        candidates: [{ id: `c${n}`, seed: n, itemId: `i${n}`, imageName: null, status: 'failed', error: null, finalItemId: null, finalImageName: null, finalStatus: null, verdict: null }],
      });
      const groups = [
        batch(1, 'Anima', 'a cat on a roof', 9 * day),
        batch(2, 'SDXL', 'a dog in the rain', 8 * day),
        batch(3, 'Anima', 'a cat in the snow', 2 * day),
        batch(4, 'SDXL', 'a city at night', day),
        batch(5, 'Anima', 'a fox in a field', 60_000),
        batch(6, 'SDXL', 'a ship at sea', 30_000),
      ];
      localStorage.setItem('novira.drafts', JSON.stringify({ state: { groups, currentId: 'g6' }, version: 1 }));
    }, DAY);
    await openApp(page, '?scenario=empty');
    await page.getByTestId('view-drafts').click();
    // Every batch still has a draft to decide (a failed one), so all six are in the flow, newest first.
    await expect(page.getByTestId('drafts-group')).toHaveCount(6);
    await expect(page.getByTestId('drafts-group').first()).toContainText('a ship at sea');
    await expect(page.getByTestId('drafts-history-button')).toHaveText('6');
    await page.getByTestId('drafts-history-button').click();
    const cards = page.getByTestId('drafts-history-card');
    await expect(cards).toHaveCount(6);

    // The model and period narrow the list; the search keeps what has every word.
    await page.getByTestId('drafts-history-model').filter({ hasText: 'Anima' }).click();
    await expect(cards).toHaveCount(3);
    await page.getByTestId('drafts-history-period-older').click();
    await expect(cards).toHaveCount(1);
    await page.getByTestId('drafts-history-period-all').click();
    await page.getByTestId('drafts-history-search').fill('cat snow');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('3. Anima');

    // Its settings go back to the Generate form.
    await cards.first().getByTestId('drafts-history-reuse').click();
    await expect(page.getByTestId('positive-prompt')).toHaveValue('a cat in the snow');

    // Opening the oldest batch from here brings it into sight in the flow.
    await page.getByTestId('drafts-history-search').fill('');
    await page.getByTestId('drafts-history-search').fill('roof');
    await cards.first().getByTestId('drafts-history-open').click();
    await expect(page.getByTestId('drafts-history')).toHaveCount(0);
    const oldest = page.getByTestId('drafts-group').filter({ hasText: 'a cat on a roof' });
    await expect(oldest).toBeInViewport();
    await expect(oldest.getByTestId('draft-cell')).toContainText(msg('drafts.badge.failed'));
  },
);
