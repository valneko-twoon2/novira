// How a balloon is drawn on the saved page: its fill and the colour of its words (light or dark), its line (solid, dashed,
// double, none), the ink of a flash, sound effects and plain words (no balloon, a white edge), bold and emphasis marks,
// vertical text, rotation and stamps. Drawing goes to a recorded context, and each call is kept with the styles it was
// made in, so the tests read what colour, weight and place each stroke, fill and letter had.
import { describe, expect, it } from 'vitest';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { DASH } from '@/state/comic/balloon';
import { emptyPage, newBubble, type BubbleKind, type ComicBubble } from '@/state/comic/document';
import { DEFAULT_STAMP_ID, STAMP_HEIGHT_EM, stampById } from '@/state/comic/stamps';
import { drawPagePart, type PreparedPage } from './pageRender';

/** The page and its one panel are 1000 pixels square, so the text of a balloon of size 1 is 45 pixels (4.5% of the panel). */
const SIZE = 1000;
const FONT_PX = 45;
/** The recorded context measures every character as 10 pixels wide. */
const CHAR = 10;
const BALLOON_X = 100;
const BALLOON_Y = 200;

interface Step {
  name: string;
  args: unknown[];
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: unknown;
  font: unknown;
  textAlign: unknown;
}

/** A recorded context that keeps, with every call, the styles that were set when it was made. */
function tracing(): { ctx: CanvasRenderingContext2D; steps: Step[] } {
  const rec = recordingContext({ width: SIZE, height: SIZE, charWidth: CHAR });
  const steps: Step[] = [];
  const style: Record<string, unknown> = {};
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key: string) {
      const value = (rec.ctx as unknown as Record<string, unknown>)[key];
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        steps.push({ name: key, args, fillStyle: style.fillStyle, strokeStyle: style.strokeStyle, lineWidth: style.lineWidth, font: style.font, textAlign: style.textAlign });
        return (value as (...a: unknown[]) => unknown)(...args);
      };
    },
    set(_t, key: string, value) {
      style[key] = value;
      (rec.ctx as unknown as Record<string, unknown>)[key] = value;
      return true;
    },
  });
  return { ctx, steps };
}

function balloon(kind: BubbleKind, change: Partial<ComicBubble> = {}): ComicBubble {
  return { ...newBubble(kind, BALLOON_X / SIZE, BALLOON_Y / SIZE), scale: 1, lineWidth: 1, ...change };
}

function preparedWith(bubble: ComicBubble, stamps = new Map<string, HTMLImageElement>()): PreparedPage {
  const page = emptyPage(1);
  const panel = { ...page.panels[0]!, bubbles: [bubble] };
  return {
    page: { ...page, panels: [panel] },
    width: SIZE,
    height: SIZE,
    backdrop: null,
    panels: [{ index: 0, panel, shape: null, rect: { x: 0, y: 0, width: SIZE, height: SIZE }, outline: null, image: null }],
    defaultFont: '',
    rasters: [],
    stamps,
  };
}

/** The steps of drawing the balloon alone. */
function draw(bubble: ComicBubble, stamps?: Map<string, HTMLImageElement>): Step[] {
  const { ctx, steps } = tracing();
  drawPagePart(ctx, preparedWith(bubble, stamps), { kind: 'balloon', index: 0, bubble });
  return steps;
}

const named = (steps: Step[], name: string) => steps.filter((s) => s.name === name);
const letters = (steps: Step[]) => named(steps, 'fillText').map((s) => ({ text: s.args[0] as string, x: s.args[1] as number, y: s.args[2] as number, step: s }));

describe('the colours of a balloon', () => {
  it('fills a light balloon white with black words, and a dark one black with white words', () => {
    const light = draw(balloon('speech', { text: 'Hi' }));
    expect(named(light, 'fill').length).toBeGreaterThan(0);
    expect(new Set(named(light, 'fill').map((s) => s.fillStyle))).toEqual(new Set(['#ffffff']));
    expect(letters(light).map((l) => l.step.fillStyle)).toEqual(['#000000']);

    const dark = draw(balloon('speech', { text: 'Hi', dark: true }));
    expect(new Set(named(dark, 'fill').map((s) => s.fillStyle))).toEqual(new Set(['#000000']));
    expect(letters(dark).map((l) => l.step.fillStyle)).toEqual(['#ffffff']);
  });

  it('fills the rays of a flash in black over its white body', () => {
    const fills = named(draw(balloon('flash', { text: 'Hi' })), 'fill').map((s) => s.fillStyle);
    expect(fills[0]).toBe('#ffffff');
    expect(fills.at(-1)).toBe('#000000');
  });
});

describe('the line of a balloon', () => {
  /** The dash pattern in force at each stroke of the balloon's line. */
  function dashesAtStrokes(steps: Step[]): unknown[][] {
    let dash: unknown[] = [];
    const out: unknown[][] = [];
    for (const s of steps) {
      if (s.name === 'setLineDash') dash = s.args[0] as unknown[];
      if (s.name === 'stroke') out.push(dash);
    }
    return out;
  }

  it('draws a whisper in dashes measured in line widths (a tenth of the text), so a larger text has longer dashes', () => {
    const lineUnit = FONT_PX * 0.1;
    expect(dashesAtStrokes(draw(balloon('speech', { text: 'Hi', line: 'dashed' })))).toEqual([DASH.map((d) => d * lineUnit)]);
    expect(dashesAtStrokes(draw(balloon('speech', { text: 'Hi', line: 'dashed', scale: 2 })))).toEqual([DASH.map((d) => d * lineUnit * 2)]);
  });

  it('draws a solid line without dashes, and leaves no dashes behind for what follows', () => {
    const solid = draw(balloon('speech', { text: 'Hi' }));
    expect(dashesAtStrokes(solid)).toEqual([[]]);
    const dashed = draw(balloon('speech', { text: 'Hi', line: 'dashed' }));
    expect(named(dashed, 'setLineDash').at(-1)!.args[0]).toEqual([]);
  });

  it('draws a double line as black, white and black strokes, each narrower, so two black bands show; none draws no line', () => {
    const lineUnit = FONT_PX * 0.1;
    const double = named(draw(balloon('speech', { text: 'Hi', line: 'double', lineWidth: 2 })), 'stroke');
    expect(double.map((s) => [s.strokeStyle, s.lineWidth])).toEqual([
      ['#000000', 6 * lineUnit * 2],
      ['#ffffff', 4 * lineUnit * 2],
      ['#000000', 2 * lineUnit * 2],
    ]);
    const none = draw(balloon('speech', { text: 'Hi', line: 'none' }));
    expect(named(none, 'stroke')).toEqual([]);
    expect(named(none, 'fill').length).toBeGreaterThan(0);
  });
});

describe('lettering without a balloon', () => {
  it('letters a sound effect in the heaviest weight, each black letter over a white edge, with no balloon', () => {
    const steps = draw(balloon('sfx', { text: 'A\nB' }));
    expect(named(steps, 'fill')).toEqual([]);
    expect(named(steps, 'stroke')).toEqual([]);
    const texts = steps.filter((s) => s.name === 'strokeText' || s.name === 'fillText');
    // Each letter's edge comes first and in the same place, so the letter stays whole on top of it.
    expect(texts.map((s) => [s.name, ...s.args])).toEqual([
      ['strokeText', ...texts[1]!.args],
      ['fillText', ...texts[1]!.args],
      ['strokeText', ...texts[3]!.args],
      ['fillText', ...texts[3]!.args],
    ]);
    expect(texts.filter((s) => s.name === 'strokeText').every((s) => s.strokeStyle === '#ffffff')).toBe(true);
    expect(texts.filter((s) => s.name === 'fillText').every((s) => s.fillStyle === '#000000' && String(s.font).startsWith('900 '))).toBe(true);
  });

  it('sits a sound effect closer to its corner and its lines closer together than a balloon of the same size', () => {
    const sfx = letters(draw(balloon('sfx', { text: 'A\nB' })));
    const speech = letters(draw(balloon('speech', { text: 'A\nB' })));
    expect(sfx[0]!.x - BALLOON_X).toBeLessThan(speech[0]!.x - BALLOON_X);
    expect(sfx[0]!.y - BALLOON_Y).toBeLessThan(speech[0]!.y - BALLOON_Y);
    expect(sfx[1]!.y - sfx[0]!.y).toBeLessThan(speech[1]!.y - speech[0]!.y);
    // Lines never overlap: the next line starts at least one text size lower.
    expect(sfx[1]!.y - sfx[0]!.y).toBeGreaterThanOrEqual(FONT_PX);
    expect(sfx[0]!.x).toBe(sfx[1]!.x);
  });

  it('letters plain words in the regular weight with a thinner white edge than a sound effect, and no balloon', () => {
    const plain = draw(balloon('plain', { text: 'Hi' }));
    expect(named(plain, 'fill')).toEqual([]);
    expect(named(plain, 'stroke')).toEqual([]);
    const plainEdge = named(plain, 'strokeText')[0]!;
    const sfxEdge = named(draw(balloon('sfx', { text: 'Hi' })), 'strokeText')[0]!;
    expect(plainEdge.strokeStyle).toBe('#ffffff');
    expect(plainEdge.lineWidth as number).toBeGreaterThan(0);
    expect(plainEdge.lineWidth as number).toBeLessThan(sfxEdge.lineWidth as number);
    expect(String(letters(plain)[0]!.step.font)).toMatch(/^400 /);
  });

  it('gives the words of a balloon no edge', () => {
    expect(named(draw(balloon('speech', { text: 'Hi' })), 'strokeText')).toEqual([]);
  });
});

describe('marked words', () => {
  it('sets bold-marked words in bold and the rest in the regular weight, one after the other on the line', () => {
    const [bold, rest] = letters(draw(balloon('speech', { text: '**AB**C' })));
    expect([bold!.text, rest!.text]).toEqual(['AB', 'C']);
    expect(String(bold!.step.font)).toMatch(/^700 /);
    expect(String(rest!.step.font)).toMatch(/^400 /);
    expect(rest!.x).toBe(bold!.x + 2 * CHAR);
    expect(rest!.y).toBe(bold!.y);
  });

  it('puts an emphasis dot above the middle of each marked character, in the colour of the words, none on a space or an unmarked one', () => {
    for (const dark of [false, true]) {
      const steps = draw(balloon('speech', { text: 'X《《A B》》', dark }));
      const [plainRun, dotted] = letters(steps);
      expect([plainRun!.text, dotted!.text]).toEqual(['X', 'A B']);
      const arcs = named(steps, 'arc').map((s) => s.args as number[]);
      expect(arcs.map(([cx]) => cx)).toEqual([dotted!.x + CHAR / 2, dotted!.x + 2 * CHAR + CHAR / 2]);
      for (const [, cy, r] of arcs) {
        expect(cy).toBeLessThan(dotted!.y);
        expect(r).toBeLessThan(FONT_PX / 4);
      }
      const dotFills = steps.filter((s, i) => s.name === 'fill' && steps[i - 1]?.name === 'arc');
      expect(dotFills.map((s) => s.fillStyle)).toEqual(dark ? ['#ffffff', '#ffffff'] : ['#000000', '#000000']);
    }
  });
});

describe('vertical text', () => {
  it('writes columns from the right, each running down, centred on its column', () => {
    const steps = draw(balloon('speech', { text: 'AB\nC', vertical: true }));
    const [a, b, c] = letters(steps);
    expect([a!.text, b!.text, c!.text]).toEqual(['A', 'B', 'C']);
    expect(b!.x).toBe(a!.x);
    expect(b!.y).toBe(a!.y + FONT_PX);
    expect(c!.x).toBeLessThan(a!.x);
    expect(c!.y).toBe(a!.y);
    expect([a, b, c].every((l) => l!.step.textAlign === 'center')).toBe(true);
  });

  it('continues a column too long for the panel at the top of the next column to its left', () => {
    const text = 'あ'.repeat(30);
    const column = letters(draw(balloon('speech', { text, vertical: true })));
    expect(column).toHaveLength(30);
    const firstX = column[0]!.x;
    const first = column.filter((l) => l.x === firstX);
    const next = column.filter((l) => l.x !== firstX);
    expect(first.length).toBeGreaterThan(1);
    expect(next.length).toBeGreaterThan(0);
    // A column takes at most 60% of its panel's height.
    expect(first.at(-1)!.y + FONT_PX - first[0]!.y).toBeLessThanOrEqual(0.6 * SIZE);
    expect(next[0]!.x).toBeLessThan(firstX);
    expect(next[0]!.y).toBe(first[0]!.y);
  });

  it('puts the emphasis dot of a vertical character to its right, at its middle, none on a space', () => {
    const steps = draw(balloon('speech', { text: '《《あ い》》う', vertical: true }));
    const chars = letters(steps);
    const arcs = named(steps, 'arc').map((s) => s.args as number[]);
    expect(arcs).toHaveLength(2);
    for (const [k, ch] of [chars[0]!, chars[2]!].entries()) {
      const [cx, cy] = arcs[k]!;
      expect(cx).toBeGreaterThan(ch.x);
      expect(cy).toBeGreaterThan(ch.y);
      expect(cy).toBeLessThan(ch.y + FONT_PX);
    }
  });
});

describe('turned lettering', () => {
  it('turns lettering about the middle of its box by its rotation, and leaves unturned lettering alone', () => {
    const steps = draw(balloon('sfx', { text: 'BOOOOM', rotation: 30 }));
    const [word] = letters(steps);
    const turn = steps.findIndex((s) => s.name === 'rotate');
    expect(steps[turn]!.args[0]).toBeCloseTo(Math.PI / 6);
    const [cx, cy] = steps[turn - 1]!.args as number[];
    expect(steps[turn - 1]!.name).toBe('translate');
    expect(steps[turn + 1]!.args).toEqual([-cx!, -cy!]);
    expect(turn).toBeLessThan(steps.indexOf(word!.step));
    expect(cx).toBeCloseTo(word!.x + (6 * CHAR) / 2);
    expect(cy).toBeGreaterThan(word!.y);
    expect(cy).toBeLessThan(word!.y + FONT_PX);
    expect(named(draw(balloon('sfx', { text: 'BOOOOM' })), 'rotate')).toEqual([]);
  });
});

describe('stamps', () => {
  const stamp = stampById(DEFAULT_STAMP_ID)!;
  const image = { naturalWidth: stamp.width, naturalHeight: stamp.height } as HTMLImageElement;
  const pictures = new Map([[DEFAULT_STAMP_ID, image]]);

  it('draws a stamp as its picture at its place, in its own proportions, as tall as its size says, with no words', () => {
    for (const scale of [1, 2]) {
      const steps = draw(balloon('stamp', { text: DEFAULT_STAMP_ID, scale }), pictures);
      expect(named(steps, 'fillText')).toEqual([]);
      const drawn = named(steps, 'drawImage');
      expect(drawn).toHaveLength(1);
      const [source, x, y, w, h] = drawn[0]!.args as [unknown, number, number, number, number];
      expect(source).toBe(image);
      expect([x, y]).toEqual([BALLOON_X, BALLOON_Y]);
      expect(h).toBeCloseTo(FONT_PX * scale * STAMP_HEIGHT_EM);
      expect(w / h).toBeCloseTo(stamp.width / stamp.height);
    }
  });

  it('turns a stamp about its middle by its rotation', () => {
    const steps = draw(balloon('stamp', { text: DEFAULT_STAMP_ID, rotation: -45 }), pictures);
    const [, x, y, w, h] = named(steps, 'drawImage')[0]!.args as number[];
    const turn = steps.findIndex((s) => s.name === 'rotate');
    expect(steps[turn]!.args[0]).toBeCloseTo(-Math.PI / 4);
    expect(steps[turn - 1]!.args).toEqual([x! + w! / 2, y! + h! / 2]);
    expect(steps[turn + 1]!.args).toEqual([-(x! + w! / 2), -(y! + h! / 2)]);
    expect(named(draw(balloon('stamp', { text: DEFAULT_STAMP_ID }), pictures), 'rotate')).toEqual([]);
  });

  it('draws nothing for a stamp whose picture did not load, or a stamp that does not exist', () => {
    expect(named(draw(balloon('stamp', { text: DEFAULT_STAMP_ID })), 'drawImage')).toEqual([]);
    expect(draw(balloon('stamp', { text: 'no-such-stamp' }), new Map([['no-such-stamp', image]]))).toEqual([]);
  });
});
