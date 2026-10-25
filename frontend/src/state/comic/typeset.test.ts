// The lettering checks: each rule on a small page, and a clean page that raises none.
import { describe, expect, it } from 'vitest';
import { checkTypesetting, headBox, TOO_LONG } from './typeset';
import { emptyPage, newBubble, newProject, type ComicBubble, type ComicPoint } from './document';

const bubble = (patch: Partial<ComicBubble>): ComicBubble => ({ ...newBubble('speech', 0, 0), text: 'Hello', ...patch });

/** A project of one page whose first panel has these balloons and people. */
function project(bubbles: ComicBubble[], poses: ComicPoint[][] = [], direction: 'rtl' | 'ltr' = 'rtl') {
  const page = emptyPage(1, { direction });
  page.panels[0] = { ...page.panels[0]!, bubbles, poses };
  return newProject('t', 0, page);
}

/** A pose with only a nose, at the given place. */
const nosePose = (x: number, y: number): ComicPoint[] => [{ x, y }];

describe('checkTypesetting', () => {
  it('raises nothing for balloons that are placed, short and in reading order', () => {
    const p = project([bubble({ x: 0.55, y: 0.05 }), bubble({ x: 0.1, y: 0.4, text: 'Yes' })]);
    expect(checkTypesetting(p)).toEqual([]);
  });

  it('finds a balloon on a face, and not one beside it', () => {
    const on = project([bubble({ x: 0.4, y: 0.3 })], [nosePose(0.5, 0.4)]);
    expect(checkTypesetting(on).map((i) => i.rule)).toContain('onFace');
    const beside = project([bubble({ x: 0.0, y: 0.0 })], [nosePose(0.8, 0.8)]);
    expect(checkTypesetting(beside)).toEqual([]);
  });

  it('finds a sound-effect picture on a face too', () => {
    const on = project([{ ...newBubble('stamp', 0.4, 0.3), scale: 1 }], [nosePose(0.5, 0.4)]);
    expect(checkTypesetting(on).map((i) => i.rule)).toContain('onFace');
  });

  it('finds balloons on each other', () => {
    const issues = checkTypesetting(project([bubble({ x: 0.3, y: 0.3 }), bubble({ x: 0.31, y: 0.31 })]));
    expect(issues).toContainEqual(expect.objectContaining({ rule: 'overlap', balloon: 1, other: 2 }));
  });

  it('finds a balloon that leaves its panel', () => {
    expect(checkTypesetting(project([bubble({ x: 0.95, y: 0.2 })])).map((i) => i.rule)).toContain('offPanel');
  });

  it('finds an empty balloon and one with too many words, but not a long caption or a picture', () => {
    const long = 'a'.repeat(TOO_LONG.chars + 1);
    const rules = checkTypesetting(project([bubble({ text: '  ', x: 0.7, y: 0.05 }), bubble({ text: long, x: 0.0, y: 0.6, scale: 0.5 })])).map((i) => i.rule);
    expect(rules).toContain('empty');
    expect(rules).toContain('tooLong');
    expect(checkTypesetting(project([{ ...newBubble('caption', 0, 0), text: long, x: 0.0, y: 0.0, scale: 0.5 }])).map((i) => i.rule)).not.toContain('tooLong');
    expect(checkTypesetting(project([newBubble('stamp', 0, 0)])).map((i) => i.rule)).not.toContain('empty');
  });

  it('finds words too small to read on the page, by the size of the panel, and not a normal or a picture balloon', () => {
    expect(checkTypesetting(project([bubble({ x: 0.3, y: 0.3, scale: 0.3 })])).map((i) => i.rule)).toContain('tooSmall');
    expect(checkTypesetting(project([bubble({ x: 0.3, y: 0.3, scale: 1 })])).map((i) => i.rule)).not.toContain('tooSmall');
    expect(checkTypesetting(project([{ ...newBubble('stamp', 0.3, 0.3), scale: 0.1 }])).map((i) => i.rule)).not.toContain('tooSmall');
  });

  it('finds balloons in the wrong reading order, by the page direction', () => {
    const left = bubble({ x: 0.05, y: 0.05 });
    const right = bubble({ x: 0.6, y: 0.05 });
    // Right to left: the first balloon should be the right one.
    expect(checkTypesetting(project([left, right], [], 'rtl')).map((i) => i.rule)).toContain('readingOrder');
    expect(checkTypesetting(project([right, left], [], 'rtl')).map((i) => i.rule)).not.toContain('readingOrder');
    expect(checkTypesetting(project([right, left], [], 'ltr')).map((i) => i.rule)).toContain('readingOrder');
    // A later balloon above an earlier one is out of order whatever the direction.
    expect(checkTypesetting(project([bubble({ x: 0.3, y: 0.7 }), bubble({ x: 0.3, y: 0.05 })])).map((i) => i.rule)).toContain('readingOrder');
  });

  it('numbers pages, panels and balloons from 1 and skips a panel with no balloon', () => {
    const p = project([bubble({ text: '' })]);
    p.pages.push(emptyPage(2));
    expect(checkTypesetting(p)).toEqual([{ rule: 'empty', page: 1, panel: 1, balloon: 1 }]);
  });
});

describe('headBox', () => {
  it('needs a nose, and is wider with the ears further apart', () => {
    expect(headBox([])).toBeNull();
    const small = headBox([{ x: 0.5, y: 0.5 }])!;
    const wide = headBox([{ x: 0.5, y: 0.5 }, ...Array(15).fill({ x: 0, y: 0 }), { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }])!;
    expect(wide.w).toBeGreaterThan(small.w);
  });
});
