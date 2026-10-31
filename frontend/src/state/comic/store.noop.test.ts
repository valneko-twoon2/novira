// Edits that have nothing to change: no comic open, a page or panel that is not there, or the value the page already has.
// They leave the projects the same objects and record no undo step, so undo never takes back a change nobody made and
// the persistence saves nothing.
import { beforeEach, describe, expect, it } from 'vitest';
import { newProject } from './document';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, lastPanelId: null, selectedBubbleId: null, bubbleEditor: false, imageSelected: false, backdropSelected: false, cutting: false, pending: {}, past: [], future: [] });
}

/** One comic, open on its first page of three panels laid out automatically. */
function seed() {
  const project = newProject('P');
  useComic.getState().setProjects([project]);
  return { projectId: project.id, pageId: project.pages[0]!.id, panels: project.pages[0]!.panels.map((p) => p.id) };
}

/** The projects and the undo steps now, to compare with after an edit that should change nothing. */
function snapshot() {
  const s = useComic.getState();
  return { projects: s.projects, past: s.past.length, future: s.future.length };
}

const point = { x: 0.5, y: 0.5 };

/** Every edit of the open comic or one of its pages, with what it returns when it does nothing. */
const pageEdits: { name: string; edit: (pageId: string) => unknown; refused?: unknown }[] = [
  { name: 'setPanelCount', edit: (id) => useComic.getState().setPanelCount(id, 2) },
  { name: 'setPageLayout', edit: (id) => useComic.getState().setPageLayout(id, { columns: 1 }) },
  { name: 'applyPageLayout', edit: (id) => useComic.getState().applyPageLayout(id, { panelCount: 2, columns: 1, direction: 'ltr', size: 'A4', shapes: null }) },
  { name: 'movePanelOrder', edit: (id) => useComic.getState().movePanelOrder(id, 0, 'front'), refused: -1 },
  { name: 'resetPanelShape', edit: (id) => useComic.getState().resetPanelShape(id, 0, 'all'), refused: false },
  { name: 'swapPanels', edit: (id) => useComic.getState().swapPanels(id, 0, 1) },
  { name: 'resetPageShapes', edit: (id) => useComic.getState().resetPageShapes(id) },
  { name: 'setPageFree', edit: (id) => useComic.getState().setPageFree(id, true) },
  { name: 'setFreeShape', edit: (id) => useComic.getState().setFreeShape(id, 0, [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.1, y: 0.4 }]), refused: false },
  { name: 'moveCorner', edit: (id) => useComic.getState().moveCorner(id, 0, 2, point), refused: false },
  { name: 'insertCorner', edit: (id) => useComic.getState().insertCorner(id, 0, 1, point), refused: false },
  { name: 'removeCorner', edit: (id) => useComic.getState().removeCorner(id, 0, 0), refused: false },
  { name: 'moveEdge', edit: (id) => useComic.getState().moveEdge(id, 0, 1, { x: 0.05, y: 0 }), refused: null },
  { name: 'splitPanel', edit: (id) => useComic.getState().splitPanel(id, 0, { x: 0.5, y: -0.1 }, { x: 0.5, y: 1.1 }), refused: false },
  { name: 'addPanel', edit: (id) => useComic.getState().addPanel(id), refused: null },
  { name: 'halvePanel', edit: (id) => useComic.getState().halvePanel(id, 0), refused: null },
  { name: 'removePanel', edit: (id) => useComic.getState().removePanel(id, 0), refused: false },
  { name: 'savePageTemplate', edit: (id) => useComic.getState().savePageTemplate(id, 'T'), refused: null },
];

beforeEach(reset);

describe('with no comic open', () => {
  /** The edits of the open comic that name no page. */
  const comicEdits: { name: string; edit: () => unknown; refused?: unknown }[] = [
    { name: 'addPage', edit: () => useComic.getState().addPage(), refused: null },
    { name: 'deletePage', edit: () => useComic.getState().deletePage('page-x') },
    { name: 'setProjectEffect', edit: () => useComic.getState().setProjectEffect('mono') },
    { name: 'setCast', edit: () => useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', imageName: null }]) },
    { name: 'setPlaces', edit: () => useComic.getState().setPlaces([{ id: 'room', name: 'Room', tags: 'bedroom' }]) },
    { name: 'setWorld', edit: () => useComic.getState().setWorld('summer') },
    { name: 'setPageEffect', edit: () => useComic.getState().setPageEffect('page-x', 'mono') },
    { name: 'setBackdrop', edit: () => useComic.getState().setBackdrop('page-x', 'back.png') },
    { name: 'setBackdropView', edit: () => useComic.getState().setBackdropView('page-x', { scale: 2 }) },
    { name: 'resetBackdrop', edit: () => useComic.getState().resetBackdrop('page-x', ['scale']) },
    { name: 'deletePanelTemplate', edit: () => useComic.getState().deletePanelTemplate('t') },
    { name: 'deletePageTemplate', edit: () => useComic.getState().deletePageTemplate('t') },
    ...pageEdits.map(({ name, edit, refused }) => ({ name, edit: () => edit('page-x'), refused })),
  ];

  for (const { name, edit, refused } of comicEdits) {
    it(`${name} changes nothing and records no undo step`, () => {
      const before = snapshot();
      expect(edit()).toBe(refused);
      expect(snapshot()).toEqual(before);
      expect(useComic.getState().projects).toBe(before.projects);
      expect(useComic.getState()).toMatchObject({ activeProjectId: null, activePageId: null, selectedPanelId: null });
    });
  }
});

describe('on a page that is not in the open comic', () => {
  for (const { name, edit, refused } of pageEdits) {
    it(`${name} changes nothing and records no undo step`, () => {
      seed();
      const before = snapshot();
      expect(edit('missing')).toBe(refused);
      expect(useComic.getState().projects).toBe(before.projects);
      expect(snapshot()).toEqual(before);
    });
  }
});

describe('an edit to what the page already has', () => {
  it('the same panel count, free placement off on an automatic page, or a reset of a page with no shapes, changes nothing', () => {
    const { pageId } = seed();
    const before = snapshot();
    useComic.getState().setPanelCount(pageId, 3);
    useComic.getState().setPageFree(pageId, false);
    useComic.getState().resetPageShapes(pageId);
    expect(useComic.getState().projects).toBe(before.projects);
    expect(snapshot()).toEqual(before);
  });

  it('a shape reset of a panel that is not on a free page is refused', () => {
    const { pageId } = seed();
    useComic.getState().setPageFree(pageId, true);
    const before = snapshot();
    expect(useComic.getState().resetPanelShape(pageId, 9, 'rotation')).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it('a slide of an edge of a panel that is not there is refused', () => {
    const { pageId } = seed();
    const before = snapshot();
    expect(useComic.getState().moveEdge(pageId, 9, 0, { x: 0.05, y: 0 })).toBeNull();
    useComic.getState().setPageFree(pageId, true);
    const free = snapshot();
    expect(useComic.getState().moveEdge(pageId, 9, 0, { x: 0.05, y: 0 })).toBeNull();
    expect(snapshot()).toEqual(free);
    expect(free.past).toBe(before.past + 1);
  });
});

describe('a panel that is not there', () => {
  it('takes no prompt, negative prompt, note or balloon edit, and records no undo step', () => {
    seed();
    const before = snapshot();
    useComic.getState().setPrompt('missing', 'a cat');
    useComic.getState().setPanelNegative('missing', 'blurry');
    useComic.getState().setPanelNote('missing', 'note');
    useComic.getState().updateBubble('missing', 'bubble', { text: 'Hi' });
    useComic.getState().removeBubble('missing', 'bubble');
    expect(useComic.getState().projects).toBe(before.projects);
    expect(snapshot()).toEqual(before);
  });
});

describe('letting go of the backdrop', () => {
  it('when it is not selected keeps the panel selected', () => {
    const { panels } = seed();
    useComic.getState().selectPanel(panels[1]!);
    useComic.getState().selectBackdrop(false);
    expect(useComic.getState()).toMatchObject({ selectedPanelId: panels[1], backdropSelected: false });
  });

  it('selected with no panel selected keeps the panel the prompt boxes work on', () => {
    const { panels } = seed();
    useComic.getState().selectPanel(panels[2]!);
    useComic.getState().selectPanel(null);
    useComic.getState().selectBackdrop(true);
    expect(useComic.getState()).toMatchObject({ backdropSelected: true, selectedPanelId: null, lastPanelId: panels[2] });
  });
});
