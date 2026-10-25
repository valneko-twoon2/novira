// The check that what drives or describes the screens names only test ids and screen-text keys that still exist
// (tools/ui-refs.mjs): the repository passes, and a reference to a removed or renamed id or key is found.
import { describe, expect, it } from 'vitest';
import {
  checkRefs,
  definitionsOf,
  isReferenceSource,
  messageDefined,
  missingRefs,
  referencesIn,
  templatePattern,
  testIdDefined,
  // @ts-expect-error -- plain ESM script without types
} from '../../tools/ui-refs.mjs';

const AREAS = new Set(['media', 'comic', 'params']);
const SOURCES = [
  { path: 'frontend/src/features/media/MediaTabs.tsx', text: "data-testid={`media-${id}`} aria-label={t('media.label')}" },
  { path: 'frontend/src/features/params/PromptBox.tsx', text: "data-testid={`${kind}-prompt`} data-testid=\"invoke-button\"" },
  { path: 'frontend/src/features/media/ModelChoice.tsx', text: 'data-testid={`${testId}-${item.id}`}' },
  { path: 'frontend/src/features/media/VideoPanel.tsx', text: '<ModelChoice testId="video-pack" />' },
  { path: 'frontend/src/features/comic/PictureTools.tsx', text: "idPrefix = 'comic-image', data-testid={`${idPrefix}-center`}" },
];
const DEFS = definitionsOf(SOURCES);
const KEYS = new Set(['media.label', 'media.tab.video', 'media.tab.image', 'comic.count.one', 'comic.count.other']);
const id = (name: string, prefix = false) => testIdDefined({ kind: 'testid', name, prefix, line: 1 }, DEFS);

describe('what counts as a reference', () => {
  it('reads getByTestId, testid(), [data-testid] selectors, "test id" in Markdown, msg() and t() of a catalog area', () => {
    const text = [
      "await page.getByTestId('invoke-button').click();",
      "await testid('comic-image-center').click();",
      'page.locator(\'[data-testid="gallery-thumb"]\'); document.querySelector(`[data-testid^="media-"]`);',
      'page.getByTestId(`media-${kind}`); msg(\'media.tab.video\'); t("comic.count"); t(`media.tab.${k}`);',
      "t('not.an.area'); page.getByTestId(id); page.setContent('<div data-testid=\"row\"></div>');",
    ].join('\n');
    const refs = referencesIn('frontend/e2e/x.spec.ts', text, AREAS).map((r: { kind: string; name: string; prefix: boolean; line: number }) => `${r.line} ${r.kind} ${r.name}${r.prefix ? '…' : ''}`);
    expect(refs.sort()).toEqual(
      [
        '1 testid invoke-button',
        '2 testid comic-image-center',
        '3 testid gallery-thumb',
        '3 testid media-…',
        '4 testid media-…',
        '4 message media.tab.video',
        '4 message comic.count',
        '4 message media.tab.…',
      ].sort(),
    );
    expect(referencesIn('docs/design/navigation.md', 'the comic icon (test id `media-comic`)', AREAS)).toHaveLength(1);
    expect(referencesIn('docs/design/x.ts', 'the comic icon (test id `media-comic`)', AREAS)).toHaveLength(0);
  });

  it('looks at the e2e specs, the frontend scripts, the tools, the docs and the skills, not at the app or itself', () => {
    for (const path of ['frontend/e2e/comic.spec.ts', 'frontend/scripts/manual/scenes.mjs', 'tools/models-sweep-app.mjs', 'docs/design/navigation.md', '.claude/skills/verify-real-app/SKILL.md', 'AGENTS.md'])
      expect(isReferenceSource(path), path).toBe(true);
    for (const path of ['frontend/src/app/App.tsx', 'tools/ui-refs.mjs', 'frontend/src/app/App.test.tsx', 'backend/src/lib.rs']) expect(isReferenceSource(path), path).toBe(false);
  });
});

describe('what counts as defined', () => {
  it('takes strings, and template strings with a fixed part of three letters or more', () => {
    expect(id('invoke-button')).toBe(true);
    expect(id('media-video')).toBe(true);
    expect(id('positive-prompt')).toBe(true);
    expect(id('comic-image-center')).toBe(true);
    expect(id('invoke-buton')).toBe(false);
    expect(id('comic-plan-tab')).toBe(false);
  });

  it('lets a loose template (`${testId}-${item.id}`) make an id only after a stem handed through a test id prop', () => {
    expect(templatePattern('${testId}-${item.id}')).toMatchObject({ loose: true });
    expect(id('video-pack-turbo')).toBe(true);
    // "manga" and "section" are ordinary words; no prop hands "manga" as a test id.
    expect(id('manga-section')).toBe(false);
  });

  it('checks a name built at run time by its fixed start', () => {
    expect(id('media-', true)).toBe(true);
    expect(id('comic-plan-', true)).toBe(false);
  });

  it('takes a message key of the ja catalog, its plural forms and a fixed start', () => {
    const key = (name: string, prefix = false) => messageDefined({ kind: 'message', name, prefix, line: 1 }, KEYS);
    expect(key('media.tab.video')).toBe(true);
    expect(key('comic.count')).toBe(true);
    expect(key('media.tab.', true)).toBe(true);
    expect(key('comic.plan.title')).toBe(false);
    expect(key('comic.plan.', true)).toBe(false);
  });
});

describe('the problems', () => {
  it('names the file, the line and what is missing', () => {
    const files = [{ path: 'tools/check.mjs', text: "ok\nawait page.getByTestId('comic-plan-tab').click();\nmsg('comic.plan.title');" }];
    expect(missingRefs(files, DEFS, KEYS)).toEqual([
      'tools/check.mjs:2: test id "comic-plan-tab" is in no source of frontend/src; the screen changed, so change this reference',
      'tools/check.mjs:3: message key "comic.plan.title" is not in the ja catalog; the text was renamed or removed, so change this reference',
    ]);
    expect(missingRefs([{ path: 'tools/check.mjs', text: "page.getByTestId('media-video')" }], DEFS, KEYS)).toEqual([]);
  });

  it('passes the repository itself', () => {
    expect(checkRefs()).toEqual([]);
  });
});
