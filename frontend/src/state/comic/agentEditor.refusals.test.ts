// Operations the assistant sends that must be refused: no comic open, a panel or balloon that is not there, values of the
// wrong type. Each refusal leaves the comic exactly as it was and tells the assistant why in the skipped list.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyComicOps, comicAgentEditor } from './agentEditor';
import * as generate from './generate';
import { newProject } from './document';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { t } from '@/i18n';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, cutting: false, pending: {}, past: [], future: [] });
}

/** A comic with one page of three panels. */
function seed(name = 'Harbour') {
  const project = newProject(name);
  useComic.getState().setProjects([...useComic.getState().projects, project]);
  return project;
}

const page = () => useComic.getState().projects[0]!.pages.find((p) => p.id === useComic.getState().activePageId)!;
const projects = () => useComic.getState().projects;
const skipped = () => comicAgentEditor.skipped();

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

describe('with no comic open', () => {
  it('refuses every operation that needs a comic or a page, makes nothing, and says so for each', () => {
    const ops = [
      { op: 'draw', scope: 'comic' },
      { op: 'page', page: 1 },
      { op: 'addPage' },
      { op: 'addPages', count: 2 },
      { op: 'openComic', name: 'Harbour' },
      { op: 'layout', panelCount: 4 },
      { op: 'template', id: 'four' },
      { op: 'shapes', shapes: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]] },
      { op: 'mangaLayout', panelCount: 4 },
      { op: 'frame', frameMm: 1 },
      { op: 'style', positive: 'sketch' },
      { op: 'castReference', strength: 0.5 },
      { op: 'effect', effect: 'mono' },
      { op: 'addPanel' },
      { op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }] },
      { op: 'places', places: [{ name: 'Cafe', tags: 'cafe' }], world: 'summer' },
      { op: 'sheet', character: 'Mio' },
      { op: 'bubble', id: 'b1', set: { text: 'x' } },
      { op: 'removeBubble', id: 'b1' },
      { op: 'addLayer' },
    ];
    expect(applyComicOps(ops)).toBe(false);
    expect(projects()).toEqual([]);
    expect(useComic.getState().activeProjectId).toBeNull();
    expect(skipped()).toHaveLength(ops.length);
    for (const [i, op] of ops.entries()) expect(skipped()[i]).toMatch(new RegExp(`^op ${i + 1} \\(${op.op}\\): took no effect`));
    // The sheet names the cast it looked in, and a balloon op says there is no such balloon.
    expect(skipped()[16]).toContain('the cast is: empty');
    expect(skipped()[17]).toContain('no balloon has this id');
  });

  it('tells the assistant that no page is open for an operation on a panel or a scene', () => {
    expect(applyComicOps([{ op: 'panel', panel: 1, prompt: 'x' }, { op: 'scene', panel: 1, people: [{ who: 'Mio' }] }])).toBe(false);
    expect(projects()).toEqual([]);
    expect(skipped()).toEqual(['op 1 (panel): took no effect (no page is open)', 'op 2 (scene): took no effect (no page is open)']);
  });
});

describe('a panel that is not on the page', () => {
  it('is refused by every operation that names one, leaving the comic and the selection as they were', () => {
    seed();
    useComic.getState().setPanelImage(page().panels[0]!.id, 'pic.png');
    const selected = useComic.getState().selectedPanelId;
    const before = projects();
    const bad = [0, 4, 1.5, '1', undefined];
    const ops = bad.flatMap((panel) => [
      { op: 'panel', panel, prompt: 'x' },
      { op: 'pose', panel, people: [] },
      { op: 'picture', panel, scale: 2 },
      { op: 'take', panel, take: 1 },
      { op: 'fix', panel, boxes: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.3 }] },
      { op: 'select', panel },
      { op: 'addBubble', panel, text: 'hi' },
      { op: 'split', panel, from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 } },
      { op: 'removePanel', panel },
      { op: 'swap', a: panel, b: 1 },
      { op: 'swap', a: 1, b: panel },
      // No panel at all adds one; a panel that is not there adds nothing.
      ...(panel === undefined ? [] : [{ op: 'addPanel', panel }]),
    ]);
    expect(applyComicOps(ops)).toBe(false);
    expect(projects()).toBe(before);
    expect(useComic.getState().selectedPanelId).toBe(selected);
    expect(skipped()).toHaveLength(ops.length);
    expect(skipped()[0]).toBe('op 1 (panel): took no effect (panel 0 is not on the open page, which has 3 panels numbered from 1 (open the page with op page first))');
    expect(skipped().filter((s) => s.includes('panel 1.5 is not on the open page'))).toHaveLength(12);
  });

  it('draws nothing for a panel that is not there or has no prompt', () => {
    seed();
    const restore = withModel();
    const draw = vi.spyOn(generate, 'drawPanels').mockResolvedValue(0);
    try {
      expect(applyComicOps([{ op: 'draw', scope: 'panel', panel: 9 }, { op: 'draw', scope: 'panel', panel: 2 }, { op: 'draw', scope: 'page' }])).toBe(false);
      expect(skipped()[0]).toContain('panel 9 is not on the open page');
      expect(draw).not.toHaveBeenCalled();
    } finally {
      draw.mockRestore();
      restore();
    }
  });
});

describe('values of the wrong type or out of range', () => {
  it('opens no page for a number that is not one of the pages', () => {
    seed();
    applyComicOps([{ op: 'addPage' }, { op: 'page', page: 1 }]);
    const open = useComic.getState().activePageId;
    expect(applyComicOps([{ op: 'page', page: '2' }, { op: 'page', page: 0 }, { op: 'page', page: 3 }, { op: 'page' }])).toBe(false);
    expect(useComic.getState().activePageId).toBe(open);
  });

  it('opens no comic for a name that is not a text or is empty', () => {
    seed('Harbour');
    seed('Voyage');
    useComic.getState().selectProject(projects()[1]!.id);
    expect(applyComicOps([{ op: 'openComic', name: 5 }, { op: 'openComic', name: '  ' }, { op: 'openComic' }])).toBe(false);
    expect(useComic.getState().activeProjectId).toBe(projects()[1]!.id);
  });

  it('refuses shapes that are not a list of 1 to 24 shapes of 3 to 12 corners each, and keeps the layout', () => {
    seed();
    const before = projects();
    const square = (x: number) => [{ x, y: 0 }, { x: x + 0.01, y: 0 }, { x: x + 0.01, y: 1 }, { x, y: 1 }];
    const corners = (n: number) => Array.from({ length: n }, (_, i) => ({ x: Math.cos(i), y: Math.sin(i) }));
    const tries = [
      'a square',
      [],
      Array.from({ length: 25 }, (_, i) => square(i * 0.04)),
      [[{ x: 0, y: 0 }, { x: 1, y: 1 }]],
      [corners(13)],
      [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1 }, { x: 0, y: 1 }]],
      [[{ x: 0, y: 0 }, { x: 1, y: 0 }, 'corner', { x: 0, y: 1 }]],
      ['not a shape'],
    ];
    expect(applyComicOps(tries.flatMap((shapes) => [{ op: 'shapes', shapes }, { op: 'shapes', free: true, shapes }]))).toBe(false);
    expect(projects()).toBe(before);
  });

  it('does not cut a panel along a line whose ends are not points', () => {
    seed();
    const before = projects();
    expect(applyComicOps([
      { op: 'split', panel: 1, from: { x: 0 }, to: { x: 1, y: 0.5 } },
      { op: 'split', panel: 1, from: { x: 0, y: 0.5 }, to: 'right' },
      { op: 'split', panel: 1, from: { x: '0', y: 0.5 }, to: { x: 1, y: 0.5 } },
    ])).toBe(false);
    expect(projects()).toBe(before);
  });

  it('leaves a picture where it is when no field of the view is readable', () => {
    seed();
    useComic.getState().setPanelImage(page().panels[0]!.id, 'pic.png');
    const before = projects();
    expect(applyComicOps([{ op: 'picture', panel: 1, scale: '2', cx: null, flipX: 'yes' }, { op: 'picture', panel: 1 }])).toBe(false);
    expect(projects()).toBe(before);
  });

  it('puts back no earlier picture for a number that is not a whole number, and says how many there are', () => {
    seed();
    const id = page().panels[0]!.id;
    for (const name of ['old.png', 'new.png']) useComic.getState().setPanelImage(id, name);
    const before = projects();
    expect(applyComicOps([{ op: 'take', panel: 1, take: 0.5 }, { op: 'take', panel: 1, take: '1' }])).toBe(false);
    expect(projects()).toBe(before);
    expect(skipped()).toEqual([expect.stringContaining('panel 1 has 1 earlier picture(s)'), expect.stringContaining('panel 1 has 1 earlier picture(s)')]);
  });

  it('changes no balloon for an id that is not a balloon, a set that is not an object, or a set with nothing readable', () => {
    seed();
    applyComicOps([{ op: 'addBubble', panel: 1, text: 'Hello' }]);
    const id = page().panels[0]!.bubbles[0]!.id;
    const before = projects();
    expect(applyComicOps([
      { op: 'bubble', id: 5, set: { text: 'x' } },
      { op: 'bubble', id, set: 'Stop!' },
      { op: 'bubble', id, set: { kind: 'nope', scale: 'big', tail: 'mouth' } },
      { op: 'removeBubble', id: 'missing' },
      { op: 'removeBubble', id: 5 },
    ])).toBe(false);
    expect(projects()).toBe(before);
    expect(skipped()[0]).toContain('no balloon has this id');
    expect(skipped()[1]).toContain('bubble needs "set": {...fields}');
  });

  it('removes nobody for names that are not texts or not in the cast or the places, and says what the operation needs', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }] }, { op: 'places', places: [{ name: 'Cafe', tags: 'cafe' }] }]);
    const before = projects();
    expect(applyComicOps([{ op: 'cast', remove: [3, null, 'nobody'] }, { op: 'places', remove: [3, null, 'nowhere'] }])).toBe(false);
    expect(projects()).toBe(before);
    expect(skipped()[0]).toContain('cast needs "characters"');
    expect(skipped()[1]).toContain('places needs "places"');
  });

  it('draws no sheet for a character named by something that is not a text', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }] }]);
    const make = vi.spyOn(generate, 'makeSheet').mockResolvedValue(0);
    try {
      expect(applyComicOps([{ op: 'sheet', character: 5 }, { op: 'sheet' }])).toBe(false);
      expect(skipped()[0]).toContain('no character is named "5"; the cast is: Mio');
      expect(make).not.toHaveBeenCalled();
    } finally {
      make.mockRestore();
    }
  });

  it('draws no sheet without a model, and tells the user why', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }] }]);
    useToasts.setState({ toasts: [] });
    const make = vi.spyOn(generate, 'makeSheet').mockResolvedValue(0);
    try {
      expect(applyComicOps([{ op: 'sheet', character: 'Mio' }])).toBe(false);
      expect(make).not.toHaveBeenCalled();
      expect(useToasts.getState().toasts).toEqual([expect.objectContaining({ status: 'warning', title: t('comic.readiness.noModel') })]);
    } finally {
      make.mockRestore();
    }
  });

  it('names an operation that is not a text as "?" in the skipped list', () => {
    seed();
    const before = projects();
    expect(applyComicOps([{ op: 3 }, { name: 'Mio' }])).toBe(false);
    expect(projects()).toBe(before);
    expect(skipped()).toEqual([expect.stringMatching(/^op 1 \(\?\): took no effect/), expect.stringMatching(/^op 2 \(\?\): took no effect/)]);
  });

  it('restores nothing from an undo snapshot that is not a list of comics', () => {
    seed();
    const before = projects();
    comicAgentEditor.restore({ projects: [] });
    comicAgentEditor.restore(null);
    expect(projects()).toBe(before);
  });
});
