// What the assistant's operations reach: only the page, panel or balloon they name; values past their range brought into
// it; the cast and the places kept to their limits; and what the context tells about balloons, the selection and the words.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyComicOps, comicContext, comicAgentEditor } from './agentEditor';
import * as generate from './generate';
import * as posePreset from './posePreset';
import { CAST_MAX, newProject, PLACES_MAX } from './document';
import { FIX_STRENGTH } from './panelFix';
import { useCharacters } from '@/state/characters';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { t } from '@/i18n';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, cutting: false, pending: {}, past: [], future: [] });
}

/** A comic with one page of three panels. */
function seed() {
  const project = newProject('Harbour');
  useComic.getState().setProjects([project]);
  return project;
}

const project = () => useComic.getState().projects[0]!;
const page = () => project().pages.find((p) => p.id === useComic.getState().activePageId)!;
const pageAt = (n: number) => project().pages[n - 1]!;

/** A main model chosen on the Generate tab, so drawing is not blocked; returns the undo. */
function withModel() {
  const before = { models: useModels.getState().models, modelKey: useParams.getState().modelKey };
  useModels.setState({ models: [{ key: 'main', name: 'Main', base: 'sdxl', type: 'main' } as (typeof before.models)[number]] });
  useParams.setState({ modelKey: 'main' });
  return () => {
    useModels.setState({ models: before.models });
    useParams.setState({ modelKey: before.modelKey });
  };
}

beforeEach(reset);

describe('only what an operation names', () => {
  it('draws the prompted panels of the page on screen, of one panel, or of every page', () => {
    seed();
    applyComicOps([
      { op: 'panel', panel: 1, prompt: 'a' },
      { op: 'panel', panel: 3, prompt: 'c' },
      { op: 'addPage' },
      { op: 'panel', panel: 2, prompt: 'd' },
      { op: 'addPage' },
      { op: 'page', page: 1 },
    ]);
    const [p1, , p3] = pageAt(1).panels;
    const d = pageAt(2).panels[1]!;
    const restore = withModel();
    const draw = vi.spyOn(generate, 'drawPanels').mockResolvedValue(0);
    try {
      expect(applyComicOps([{ op: 'draw' }])).toBe(true);
      expect(draw).toHaveBeenLastCalledWith([p1!.id, p3!.id]);
      expect(applyComicOps([{ op: 'draw', scope: 'panel', panel: 3 }])).toBe(true);
      expect(draw).toHaveBeenLastCalledWith([p3!.id]);
      expect(applyComicOps([{ op: 'draw', scope: 'comic' }])).toBe(true);
      expect(draw).toHaveBeenLastCalledWith([p1!.id, p3!.id, d.id]);
      // The third page has no prompt: drawing it queues nothing.
      draw.mockClear();
      expect(applyComicOps([{ op: 'page', page: 3 }, { op: 'draw', scope: 'page' }])).toBe(true);
      expect(comicAgentEditor.skipped()).toEqual([expect.stringMatching(/^op 2 \(draw\): took no effect/)]);
      expect(draw).not.toHaveBeenCalled();
    } finally {
      draw.mockRestore();
      restore();
    }
  });

  it('changes only the named panel, and leaves the other panels and pages alone', () => {
    seed();
    applyComicOps([{ op: 'addPage' }, { op: 'page', page: 1 }]);
    const before = project();
    expect(applyComicOps([{ op: 'panel', panel: 2, prompt: 'close-up', negativePrompt: 'lowres', note: 'she turns' }])).toBe(true);
    expect(page().panels[1]).toMatchObject({ prompt: 'close-up', negativePrompt: 'lowres', note: 'she turns' });
    expect(page().panels[0]).toBe(before.pages[0]!.panels[0]);
    expect(page().panels[2]).toBe(before.pages[0]!.panels[2]);
    expect(pageAt(2)).toEqual(before.pages[1]);
  });

  it('changes a balloon on another page by its id, and leaves the balloon beside it alone', () => {
    seed();
    applyComicOps([{ op: 'addBubble', panel: 1, text: 'One' }, { op: 'addBubble', panel: 1, text: 'Two' }, { op: 'addPage' }]);
    const [one, two] = pageAt(1).panels[0]!.bubbles;
    expect(applyComicOps([{ op: 'bubble', id: one!.id, set: { text: 'Uno', dark: true } }])).toBe(true);
    expect(pageAt(1).panels[0]!.bubbles[0]).toMatchObject({ text: 'Uno', dark: true });
    expect(pageAt(1).panels[0]!.bubbles[1]).toEqual(two);
    expect(page().id).toBe(pageAt(2).id);
    expect(applyComicOps([{ op: 'removeBubble', id: two!.id }])).toBe(true);
    expect(pageAt(1).panels[0]!.bubbles.map((b) => b.text)).toEqual(['Uno']);
  });

  it('sets the frame, the effect, the style and the layout of the page on screen only', () => {
    seed();
    applyComicOps([{ op: 'addPage' }]);
    const first = pageAt(1);
    expect(applyComicOps([
      { op: 'frame', frameMm: 1.2 },
      { op: 'effect', effect: 'sepia' },
      { op: 'style', positive: 'sketch', scope: 'page' },
      { op: 'layout', panelCount: 5 },
    ])).toBe(true);
    expect(page()).toMatchObject({ frameMm: 1.2, effect: 'sepia', style: { positive: 'sketch' } });
    expect(page().panels).toHaveLength(5);
    expect(pageAt(1)).toBe(first);
    expect(project().style).toBeUndefined();
  });
});

describe('values brought into their range or left as they were', () => {
  it('keeps the frame widths within their ranges and leaves the frame colour alone', () => {
    seed();
    const color = page().frameColor;
    expect(applyComicOps([{ op: 'frame', frameMm: 99, insetMm: -5, marginMm: 50 }])).toBe(true);
    expect(page()).toMatchObject({ frameMm: 3, insetMm: 0, marginMm: 10, frameColor: color });
  });

  it('keeps the panel count, columns, reading direction and size a layout does not give or gives wrong', () => {
    seed();
    applyComicOps([{ op: 'layout', columns: 2, direction: 'ltr', size: 'B5' }]);
    expect(applyComicOps([{ op: 'layout', columns: 7, direction: 'up', size: 'A3' }])).toBe(true);
    expect(page()).toMatchObject({ columns: 2, direction: 'ltr', size: 'B5' });
    expect(page().panels).toHaveLength(3);
  });

  it('lays a grid template out in the page own direction and size', () => {
    seed();
    applyComicOps([{ op: 'layout', direction: 'ltr', size: 'B5' }, { op: 'shapes', shapes: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]] }]);
    expect(applyComicOps([{ op: 'template', id: 'four' }])).toBe(true);
    expect(page()).toMatchObject({ columns: 2, direction: 'ltr', size: 'B5', shapes: null });
    expect(page().panels).toHaveLength(4);
  });

  it('cuts a manga page into as many panels as the page has when no count is given', () => {
    seed();
    expect(applyComicOps([{ op: 'mangaLayout', seed: 7 }])).toBe(true);
    expect(page().panels).toHaveLength(3);
    expect(page().free).toBe(true);
  });

  it('goes back to the default style words when every word of the comic is cleared', () => {
    seed();
    applyComicOps([{ op: 'style', positive: 'sketch', negative: 'lowres' }, { op: 'style', positive: 'ink', scope: 'page' }]);
    expect(applyComicOps([{ op: 'style', positive: '', negative: ' ' }, { op: 'style', positive: '', scope: 'page' }])).toBe(true);
    expect(project().style).toBeUndefined();
    expect(page().style).toBeUndefined();
    expect((comicContext() as { style: { own: boolean } }).style.own).toBe(false);
  });

  it('keeps a balloon tail within reach of the balloon, and tells balloons with their tails rounded', () => {
    seed();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'Hi', tail: { x: 9, y: -7 } }, { op: 'addBubble', panel: 1, kind: 'caption', text: 'Dawn' }]);
    expect(page().panels[0]!.bubbles[0]!.tail).toEqual({ x: 3, y: -2 });
    const id = page().panels[0]!.bubbles[0]!.id;
    applyComicOps([{ op: 'bubble', id, set: { tail: { x: 0.12345, y: 1.6789 } } }]);
    const told = (comicContext() as { panels: { bubbles: { text: string; tail: unknown }[] }[] }).panels[0]!.bubbles;
    expect(told).toEqual([expect.objectContaining({ text: 'Hi', tail: { x: 0.123, y: 1.679 } }), expect.objectContaining({ text: 'Dawn', tail: null })]);
  });

  it('makes a comic with the default name when the name is not a text', () => {
    expect(applyComicOps([{ op: 'newComic', name: 5 }])).toBe(true);
    expect(project().name).toBe(t('comic.project.newName'));
  });
});

describe('the limits of the cast and the places', () => {
  it('adds no character past the most, but still rewrites one the cast has', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: Array.from({ length: CAST_MAX }, (_, i) => ({ name: `C${i + 1}`, tags: 'old' })) }]);
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Extra', tags: 'x' }, { name: 'c1', tags: 'new' }] }])).toBe(true);
    expect(project().cast).toHaveLength(CAST_MAX);
    expect(project().cast.map((c) => c.name)).not.toContain('Extra');
    expect(project().cast[0]!.tags).toBe('new');
    const before = useComic.getState().projects;
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Extra', tags: 'x' }] }])).toBe(false);
    expect(useComic.getState().projects).toBe(before);
  });

  it('adds no place past the most, but still rewrites one the comic has', () => {
    seed();
    applyComicOps([{ op: 'places', places: Array.from({ length: PLACES_MAX }, (_, i) => ({ name: `P${i + 1}`, tags: 'old' })) }]);
    expect(applyComicOps([{ op: 'places', places: [{ name: 'Extra', tags: 'x' }, { name: 'p1', tags: 'new' }] }])).toBe(true);
    expect(project().places).toHaveLength(PLACES_MAX);
    expect(project().places.map((p) => p.name)).not.toContain('Extra');
    expect(project().places[0]!.tags).toBe('new');
  });

  it('adds a character or a place given without words, and tells their kept-out words', () => {
    seed();
    expect(applyComicOps([
      { op: 'cast', characters: [{ name: 'Kage', nonHuman: true, negative: 'human' }, { name: 'Mio', parts: { hair: 'red hair' } }] },
      { op: 'places', places: [{ name: 'Cave', negative: 'sunlight' }] },
    ])).toBe(true);
    const c = comicContext() as { cast: Record<string, unknown>[]; places: Record<string, unknown>[] };
    expect(c.cast[0]).toMatchObject({ name: 'Kage', tags: '', nonHuman: true, negative: 'human' });
    expect(c.cast[1]).toMatchObject({ name: 'Mio', tags: '', parts: { hair: 'red hair' } });
    expect(c.places).toEqual([{ name: 'Cave', tags: '', negative: 'sunlight' }]);
  });

  it('removes the names that are texts and skips the rest', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: 'a' }, { name: 'Sota', tags: 'b' }] }]);
    expect(applyComicOps([{ op: 'cast', remove: [3, 'sota'] }])).toBe(true);
    expect(project().cast.map((c) => c.name)).toEqual(['Mio']);
  });

  it('says the comic has no places when a panel names one', () => {
    seed();
    expect(applyComicOps([{ op: 'panel', panel: 1, place: 'Cafe' }])).toBe(false);
    expect(comicAgentEditor.skipped()[0]).toContain('no place is named "Cafe"; the places are: none');
  });

  it('reads a list sent under another name, giving each item the fields written beside the list', () => {
    seed();
    expect(applyComicOps([{ op: 'cast', items: [{ name: 'Aki', tags: '1girl' }, { name: 'Ren' }, 'junk'], tags: '1boy' }, { op: 'places', rows: [{ name: 'Pier' }], tags: 'pier, sea' }])).toBe(true);
    expect(project().cast.map((c) => [c.name, c.tags])).toEqual([['Aki', '1girl'], ['Ren', '1boy']]);
    expect(project().places.map((p) => [p.name, p.tags])).toEqual([['Pier', 'pier, sea']]);
    expect(comicAgentEditor.skipped()).toEqual(['op 1 (cast): read as a list in "characters"; send it in that form', 'op 2 (places): read as a list in "places"; send it in that form']);
  });
});

describe('poses, balloons by speaker, redraws and what the context tells', () => {
  /** A person of 18 joints (nose first) standing at x. */
  const stand = (x: number) => Array.from({ length: 18 }, (_, i) => ({ x: x + (i > 1 ? (i % 2 ? 0.05 : -0.05) : 0), y: 0.3 + i * 0.03 }));

  it('aims the tail at the speaker but keeps the place the assistant gave', () => {
    seed();
    useComic.getState().setPanelPose(page().panels[0]!.id, [stand(0.2), stand(0.8)], null);
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'やあ', x: 0.5, y: 0.1 }]);
    const unaimed = page().panels[0]!.bubbles[0]!.tail;
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'やあ', x: 0.5, y: 0.1, speaker: 2 }]);
    const aimed = page().panels[0]!.bubbles[1]!;
    expect(aimed).toMatchObject({ x: 0.5, y: 0.1 });
    expect(aimed.tail).not.toBeNull();
    expect(aimed.tail).not.toEqual(unaimed);
  });

  it('leaves a person of a pose unnamed when no name is given, and tells the user when the pose picture fails', async () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }] }]);
    useToasts.setState({ toasts: [] });
    const put = vi.spyOn(posePreset, 'putPosePeople').mockRejectedValue('upload refused');
    try {
      expect(applyComicOps([{ op: 'pose', panel: 1, people: [{ x: 0.3 }, { x: 0.7, who: 'Mio' }] }])).toBe(true);
      expect(page().panels[0]!.poseCast).toEqual([null, project().cast[0]!.id]);
      await vi.waitFor(() => expect(useToasts.getState().toasts).toEqual([expect.objectContaining({ status: 'error', title: t('comic.panel.poseFailed'), description: 'upload refused' })]));
    } finally {
      put.mockRestore();
    }
  });

  it('redraws one box at the default strength with no words when only a box is given', () => {
    seed();
    const restore = withModel();
    useComic.getState().setPanelImage(page().panels[0]!.id, 'pic.png');
    const redraw = vi.spyOn(generate, 'redrawPart').mockResolvedValue(true);
    const target = vi.spyOn(generate, 'fixTarget').mockReturnValue({} as never);
    try {
      expect(applyComicOps([{ op: 'fix', panel: 1, box: { x: 0.1, y: 0.2, w: 0.3, h: 0.3 } }])).toBe(true);
      expect(redraw).toHaveBeenCalledWith(page().panels[0]!.id, { strokes: [], boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }] }, { words: undefined, strength: FIX_STRENGTH.default });
    } finally {
      redraw.mockRestore();
      target.mockRestore();
      restore();
    }
  });

  it('tells which characters a LoRA of the character library keeps the same, and not when that LoRA is off', () => {
    seed();
    const presets = useCharacters.getState().presets;
    try {
      const lora = (enabled: boolean) => ({ key: 'mina-lora', weight: 0.8, trigger: 'minachan', enabled });
      const on = useCharacters.getState().add('Mina', { imageNames: [], weight: 0.6, tags: '1girl', lora: lora(true) });
      const off = useCharacters.getState().add('Rin', { imageNames: [], weight: 0.6, tags: '1girl', lora: lora(false) });
      useComic.getState().setCast([
        { id: 'c1', name: 'Mina', tags: '1girl', imageName: null, libraryId: on },
        { id: 'c2', name: 'Rin', tags: '1girl', imageName: null, libraryId: off },
      ]);
      const cast = (comicContext() as { cast: { name: string; lora?: boolean }[] }).cast;
      expect(cast[0]!.lora).toBe(true);
      expect(cast[1]).not.toHaveProperty('lora');
    } finally {
      useCharacters.setState({ presets });
    }
  });

  it('tells which panel is selected, numbered from 1', () => {
    seed();
    applyComicOps([{ op: 'select', panel: 3 }]);
    expect((comicContext() as { selectedPanel: number | null }).selectedPanel).toBe(3);
  });
});
