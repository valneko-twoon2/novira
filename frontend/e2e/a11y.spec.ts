// Accessibility scan (axe-core, WCAG 2 A and AA rules) of every tab of the browser build against the mock backend.
// Colour contrast is left to the theme tokens and the visual checks (axe cannot judge the gradients and the hidden screens
// stay mounted), so it is not one of the rules here. A rule that is known to fail on a tab is listed in a11yKnown.ts with
// the most nodes it may still report: the scan fails on anything new or worse, and the list only gets shorter.
import AxeBuilder from '@axe-core/playwright';
import { expect, openApp, showTab, test } from './fixtures';
import { KNOWN } from './a11yKnown';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;

for (const tab of TABS) {
  test(`${tab} tab has no new accessibility violations`, async ({ page }) => {
    await openApp(page);
    await showTab(page, tab);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const found = Object.fromEntries(result.violations.map((v) => [v.id, v.nodes.length]));
    if (process.env.A11Y_REPORT) {
      for (const v of result.violations) console.log(`A11Y ${tab} ${v.id} ${v.nodes.length} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    }
    const known = KNOWN[tab] ?? {};
    const worse = Object.entries(found).filter(([id, n]) => n > (known[id] ?? 0));
    expect(worse, `violations beyond the known ones (a11yKnown.ts)`).toEqual([]);
  });
}
