// Gallery date filter: quick ranges, the calendar, the header chip, the empty state and grouping by date.
// The mock's sample pictures are 9 hours apart from 2025-10-05 02:46 (Tokyo time); Uncategorized holds two from
// 2025-10-07 and two from 2025-10-08, Characters two from 2025-10-06. The clock and time zone are pinned so
// "today" is 2025-10-08.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

test.use({ timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2025-10-08T15:00:00+09:00'));
});

const thumbs = (page: Page) => page.getByTestId('gallery-thumb');

async function openDateFilter(page: Page): Promise<void> {
  await page.getByTestId('gallery-date-filter').click();
  await expect(page.getByTestId('gallery-date-calendar')).toBeVisible();
}

test('a quick range and a calendar day narrow the gallery, and the chip clears it', async ({ page }) => {
  await openApp(page);
  await expect(thumbs(page)).toHaveCount(4);
  await expect(page.getByTestId('gallery-count')).toHaveText('4');
  await expect(page.getByTestId('gallery-date-chip')).toHaveCount(0);

  await openDateFilter(page);
  await page.getByTestId('gallery-date-quick-today').click();
  await expect(thumbs(page)).toHaveCount(2);
  await expect(page.getByTestId('gallery-count')).toHaveText('2');
  await expect(page.getByTestId('gallery-date-chip')).toHaveText('2025/10/08');
  await expect(page.getByTestId('gallery-date-quick-today')).toHaveAttribute('aria-pressed', 'true');

  // The calendar opens on the month of the filter and marks the days that have pictures.
  await expect(page.getByTestId('gallery-date-month')).toHaveText('2025年10月');
  const oct7 = page.getByTestId('gallery-date-day-2025-10-07');
  await expect(oct7).toHaveAttribute('aria-label', msg('gallery.date.dayCount.other', { date: '2025年10月7日', count: 2 }));
  await expect(page.getByTestId('gallery-date-day-2025-10-09')).toHaveAttribute('aria-label', '2025年10月9日');
  await oct7.click();
  await expect(page.getByTestId('gallery-date-chip')).toHaveText('2025/10/07');
  await expect(thumbs(page)).toHaveCount(2);

  // Last 7 days covers both days.
  await page.getByTestId('gallery-date-quick-last7').click();
  await expect(thumbs(page)).toHaveCount(4);
  await page.keyboard.press('Escape');

  await page.getByTestId('gallery-date-chip-clear').click();
  await expect(page.getByTestId('gallery-date-chip')).toHaveCount(0);
  await expect(thumbs(page)).toHaveCount(4);
});

test('a range with no pictures shows its own empty state, which clears the filter', async ({ page }) => {
  await openApp(page);
  await openDateFilter(page);
  await page.getByTestId('gallery-date-from').fill('2025-10-01');
  await page.getByTestId('gallery-date-to').fill('2025-10-04');
  await page.getByTestId('gallery-date-apply').click();
  await page.keyboard.press('Escape');
  await expect(thumbs(page)).toHaveCount(0);
  await expect(page.getByText(msg('gallery.empty.noDateResults'))).toBeVisible();
  await page.getByTestId('gallery-date-empty-clear').click();
  await expect(thumbs(page)).toHaveCount(4);
});

test('grouping by date puts a header with the count before each day', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-settings').click();
  await page.getByRole('switch', { name: msg('gallery.settings.groupByDate') }).click();
  await page.keyboard.press('Escape');
  const headers = page.getByTestId('gallery-day-header');
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(0)).toHaveText(msg('gallery.date.groupHeader', { date: '2025年10月8日', count: 2 }));
  await expect(headers.nth(1)).toHaveText(msg('gallery.date.groupHeader', { date: '2025年10月7日', count: 2 }));
  await expect(thumbs(page)).toHaveCount(4);
});
