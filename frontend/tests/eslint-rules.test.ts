// The repository's own ESLint rules (scripts/eslint-*.mjs): each stops the form it is for and lets the allowed forms
// through. eslint.config.js decides where each one applies; these tests run the rules alone.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { layerBoundaries } from '../scripts/eslint-layers.mjs';
// @ts-expect-error -- plain ESM script without types
import security from '../scripts/eslint-security.mjs';
// @ts-expect-error -- plain ESM script without types
import { noFocusedTests } from '../scripts/eslint-test-hygiene.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } });
const SRC = path.join(fileURLToPath(new URL('..', import.meta.url)), 'src');
const at = (rel: string) => path.join(SRC, rel);

tester.run('novira-layers/boundaries', layerBoundaries, {
  valid: [
    // Downwards, within a layer, and the shared features.
    { code: "import { useUi } from '@/state/ui';", filename: at('ui/Button.tsx') },
    { code: "import { Button } from '@/ui';", filename: at('features/gallery/Gallery.tsx') },
    { code: "import { x } from './helpers';", filename: at('features/gallery/Gallery.tsx') },
    { code: "import { MediaTabs } from '@/features/media/MediaTabs';", filename: at('features/video/VideoPanel.tsx') },
    { code: "import { InvokeButton } from '../invoke/InvokeButton';", filename: at('features/music/MusicPanel.tsx') },
    // The app composes everything; packages are not checked; a listed exception passes.
    { code: "import { Gallery } from '@/features/gallery/Gallery';", filename: at('app/App.tsx') },
    { code: "import React from 'react';", filename: at('backend/client.ts') },
    { code: "import { useBoardImages } from '@/features/gallery/useBoardImages';", filename: at('features/viewer/ImageViewer.tsx') },
    // Outside src/ the rule is off.
    { code: "import { Gallery } from '../src/features/gallery/Gallery';", filename: path.join(SRC, '..', 'tests', 'x.test.ts') },
  ],
  invalid: [
    { code: "import { useUi } from '@/state/ui';", filename: at('backend/client.ts'), errors: [{ messageId: 'layer' }] },
    { code: "import { Button } from '@/ui';", filename: at('state/ui.ts'), errors: [{ messageId: 'layer' }] },
    { code: "export { Gallery } from '@/features/gallery/Gallery';", filename: at('ui/index.ts'), errors: [{ messageId: 'layer' }] },
    // One feature reaching into another, by alias and by a relative path, statically and dynamically.
    { code: "import { Viewer } from '@/features/viewer/Viewer';", filename: at('features/gallery/Gallery.tsx'), errors: [{ messageId: 'layer' }] },
    { code: "import { Viewer } from '../viewer/Viewer';", filename: at('features/gallery/Gallery.tsx'), errors: [{ messageId: 'layer' }] },
    { code: "const m = import('@/features/viewer/Viewer');", filename: at('features/gallery/Gallery.tsx'), errors: [{ messageId: 'layer' }] },
    { code: "import { t } from '@/state/ui';", filename: at('i18n/index.ts'), errors: [{ messageId: 'layer' }] },
  ],
});

tester.run('novira-security/no-html-injection', security.rules['no-html-injection'], {
  valid: [
    'const html = el.innerHTML;',
    'el.textContent = text;',
    'const a = <div title={text}>{text}</div>;',
    'doc.write(x);',
  ],
  invalid: [
    { code: 'const a = <div dangerouslySetInnerHTML={{ __html: x }} />;', errors: [{ messageId: 'jsx' }] },
    { code: 'el.innerHTML = x;', errors: [{ messageId: 'sink' }] },
    { code: 'frame.srcdoc = x;', errors: [{ messageId: 'sink' }] },
    { code: "el.insertAdjacentHTML('beforeend', x);", errors: [{ messageId: 'call' }] },
    { code: 'range.createContextualFragment(x);', errors: [{ messageId: 'call' }] },
    { code: 'document.write(x); document.writeln(x);', errors: [{ messageId: 'write' }, { messageId: 'write' }] },
  ],
});

tester.run('novira-security/no-window-open', security.rules['no-window-open'], {
  valid: ['dialog.open();', 'file.open(path);', 'const open = 1;'],
  invalid: [
    { code: 'window.open(url);', errors: [{ messageId: 'open' }] },
    { code: 'open(url);', errors: [{ messageId: 'open' }] },
    { code: 'globalThis.open(url); self.open(url);', errors: [{ messageId: 'open' }, { messageId: 'open' }] },
  ],
});

tester.run('novira-tests/no-only', noFocusedTests, {
  valid: ["it('a', () => {});", "describe.skip('a', () => {});", 'thing.only();', "test.describe('a', () => {});"],
  invalid: [
    { code: "it.only('a', () => {});", errors: [{ messageId: 'only' }] },
    { code: "describe.only('a', () => {});", errors: [{ messageId: 'only' }] },
    { code: "test.describe.only('a', () => {});", errors: [{ messageId: 'only' }] },
    { code: "it.only.each([1])('a %s', () => {});", errors: [{ messageId: 'only' }] },
    { code: "describe.skip.only('a', () => {});", errors: [{ messageId: 'only' }] },
  ],
});
