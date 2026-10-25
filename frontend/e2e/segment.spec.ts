// The "pick an area and redraw it" dialog: once an area is selected, every control of the side column stays inside it.
import { expect, msg, openApp, test } from './fixtures';

for (const locale of ['ja', 'en', 'ko'] as const) {
  test(`the side column keeps every control inside it after an area is selected (${locale})`, async ({ page }) => {
    await page.addInitScript((language) => {
      localStorage.setItem('novira.settings', JSON.stringify({ state: { language }, version: 0 }));
    }, locale);
    await openApp(page);
    await page.getByTestId('gallery-thumb').first().click();
    await page.getByRole('tab', { name: msg('app.views.viewer', {}, locale), exact: true }).click();
    await page.getByTestId('viewer-segment').click();
    await page.getByTestId('seg-stage').click();
    await page.getByTestId('seg-run').click();
    await expect(page.getByTestId('seg-result')).toBeVisible({ timeout: 20_000 });

    const outside = await page.evaluate(() => {
      const side = document.querySelector('.seg__side')!.getBoundingClientRect();
      const found: string[] = [];
      for (const el of document.querySelectorAll('.seg__side *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > side.right + 1 || r.left < side.left - 1) found.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.left)}-${Math.round(r.right)} not in ${Math.round(side.left)}-${Math.round(side.right)}`);
      }
      return found;
    });
    expect(outside).toEqual([]);
  });
}
