// The assistant's window stacks over the app's panels, and under the dialogs, menus, popovers and tooltips: it must never
// cover a dialog the user opens (it did, at z-index 1000). The stacking order lives in several CSS files, so this reads them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** The value of a `--z-*` layer token in theme/tokens.css. */
function layer(token: string): number {
  const z = new RegExp(`\\n\\s*${token}:\\s*(\\d+);`).exec(readFileSync(SRC + 'theme/tokens.css', 'utf8'));
  if (!z) throw new Error(`${token} is not in theme/tokens.css`);
  return Number(z[1]);
}

/** The z-index of the rule whose selector is exactly `selector` in the stylesheet `file` (under src/), its token read. */
function zIndex(file: string, selector: string): number {
  const text = readFileSync(SRC + file, 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(text);
  const z = rule && /z-index:\s*(?:(\d+)|var\((--z-[a-z-]+)\))/.exec(rule[1]!);
  if (!z) throw new Error(`${selector} in ${file} has no z-index`);
  return z[1] ? Number(z[1]) : layer(z[2]!);
}

const ASSISTANT = ['features/agent/agent.css', '.agent-win'] as const;
const ASSISTANT_PICKER = ['features/agent/agent.css', '.agent-model-pop'] as const;
const ABOVE_IT = [
  ['ui/ui.css', '.ui-modal__overlay'],
  ['ui/ui.css', '.ui-modal'],
  ['ui/ui.css', '.ui-menu'],
  ['ui/ui.css', '.ui-popover'],
  ['ui/ui.css', '.ui-tooltip'],
] as const;
const BELOW_IT = [
  ['features/devlog/devlog.css', '.devlog'],
  ['features/downloads/downloads.css', '.dl-dock'],
  ['features/browse/browse.css', '.browse-dock'],
] as const;

describe('assistant window stacking', () => {
  it('stays under the dialogs, menus, popovers and tooltips', () => {
    const own = zIndex(...ASSISTANT);
    for (const [file, selector] of ABOVE_IT) expect(zIndex(file!, selector!), selector).toBeGreaterThan(own);
  });

  it('stays over the app panels', () => {
    const own = zIndex(...ASSISTANT);
    for (const [file, selector] of BELOW_IT) expect(own, selector).toBeGreaterThan(zIndex(file!, selector!));
  });

  it('keeps its own model picker above its window, and under the dialogs', () => {
    const picker = zIndex(...ASSISTANT_PICKER);
    expect(picker).toBeGreaterThan(zIndex(...ASSISTANT));
    expect(picker).toBeLessThan(zIndex('ui/ui.css', '.ui-modal__overlay'));
  });
});
