// An edit names one page, panel or balloon. The other pages of the comic, the other comics, and the other balloons and
// characters stay the same objects, so nothing else changes on screen and the persistence sees no change in them.
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPage, newProject, type ComicPage, type ComicProject } from './document';
import { findPanel, useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, lastPanelId: null, selectedBubbleId: null, bubbleEditor: false, centeringBubbleId: null, backdropSelected: false, pending: {}, past: [], future: [] });
}

/** Comic A of two pages, open on its first page, and comic B. */
function seed() {
  const a = newProject('A');
  const b = newProject('B');
  const second = emptyPage();
  useComic.getState().setProjects([{ ...a, pages: [a.pages[0]!, second] }, b]);
  return { a: a.id, b: b.id, first: a.pages[0]!.id, second: second.id };
}

const project = (id: string): ComicProject => useComic.getState().projects.find((p) => p.id === id)!;
const page = (projectId: string, pageId: string): ComicPage => project(projectId).pages.find((pg) => pg.id === pageId)!;

beforeEach(reset);

describe('an edit of one page', () => {
  // Each edit is made on the second page of the open comic; `prepare` puts that page into the state the edit needs.
  const cases: { name: string; prepare?: (pageId: string) => void; edit: (pageId: string) => void }[] = [
    { name: 'its drawing settings', edit: (id) => useComic.getState().setPageDraw(id, { steps: 12 }) },
    { name: 'its style', edit: (id) => useComic.getState().setPageStyle(id, { positive: 'soft light' }) },
    { name: 'its panel count', edit: (id) => useComic.getState().setPanelCount(id, 2) },
    { name: 'its columns', edit: (id) => useComic.getState().setPageLayout(id, { columns: 1 }) },
    { name: 'a layout applied to it', edit: (id) => useComic.getState().applyPageLayout(id, { panelCount: 2, columns: 1, direction: 'ltr', size: 'A4', shapes: null }) },
    { name: 'the order of its panels', edit: (id) => useComic.getState().movePanelOrder(id, 0, 'front') },
    { name: 'two of its panels swapped', edit: (id) => useComic.getState().swapPanels(id, 0, 1) },
    { name: 'free placement turned on', edit: (id) => useComic.getState().setPageFree(id, true) },
    { name: 'a corner of a panel moved', prepare: (id) => useComic.getState().setPageFree(id, true), edit: (id) => useComic.getState().moveCorner(id, 0, 2, { x: 0.45, y: 0.3 }) },
    { name: 'its shapes reset', prepare: (id) => useComic.getState().setPageFree(id, true), edit: (id) => useComic.getState().resetPageShapes(id) },
    { name: 'a panel cut in two', edit: (id) => useComic.getState().halvePanel(id, 0) },
    { name: 'a panel added', edit: (id) => useComic.getState().addPanel(id) },
    { name: 'a panel removed', edit: (id) => useComic.getState().removePanel(id, 0) },
    { name: 'its finishing effect', edit: (id) => useComic.getState().setPageEffect(id, 'mono') },
    { name: 'its backdrop', edit: (id) => useComic.getState().setBackdrop(id, 'back.png') },
    { name: 'the view of its backdrop', prepare: (id) => useComic.getState().setBackdrop(id, 'back.png'), edit: (id) => useComic.getState().setBackdropView(id, { scale: 2 }) },
    {
      name: 'the view of its backdrop put back',
      prepare: (id) => {
        useComic.getState().setBackdrop(id, 'back.png');
        useComic.getState().setBackdropView(id, { scale: 2 });
      },
      edit: (id) => useComic.getState().resetBackdrop(id, ['scale']),
    },
  ];

  for (const { name, prepare, edit } of cases) {
    it(`changes that page only: ${name}`, () => {
      const { a, b, first, second } = seed();
      prepare?.(second);
      const other = page(a, first);
      const target = page(a, second);
      const otherComic = project(b);
      edit(second);
      expect(page(a, second)).not.toBe(target);
      expect(page(a, first)).toBe(other);
      expect(project(b)).toBe(otherComic);
    });
  }

  it('in a comic that is not open (the page draw settings follow the page wherever it is) leaves the open comic alone', () => {
    const { a, b } = seed();
    const bPage = project(b).pages[0]!.id;
    const open = project(a);
    useComic.getState().setPageDraw(bPage, { steps: 8 });
    useComic.getState().setPageStyle(bPage, { negative: 'blurry' });
    expect(project(a)).toBe(open);
    expect(project(b).pages[0]).toMatchObject({ draw: { steps: 8 }, style: { negative: 'blurry' } });
  });
});

describe('deleting a page', () => {
  it('that is not on screen keeps the page on screen and the panel selected on it', () => {
    const { a, first, second } = seed();
    const third = useComic.getState().addPage()!;
    const selected = page(a, third).panels[1]!.id;
    useComic.getState().selectPanel(selected);
    useComic.getState().deletePage(second);
    const s = useComic.getState();
    expect(project(a).pages.map((pg) => pg.id)).toEqual([first, third]);
    expect(s.activePageId).toBe(third);
    expect(s.selectedPanelId).toBe(selected);
  });

  it('on screen with its panel selected opens the first page left and lets go of the panel', () => {
    const { a, first, second } = seed();
    useComic.getState().selectPage(second);
    useComic.getState().selectPanel(page(a, second).panels[0]!.id);
    useComic.getState().deletePage(second);
    const s = useComic.getState();
    expect(s.activePageId).toBe(first);
    expect(s.selectedPanelId).toBeNull();
  });

  it('that is the last one leaves the comic open with no page, also when it is opened again', () => {
    const { a, b, first, second } = seed();
    useComic.getState().deletePage(second);
    useComic.getState().deletePage(first);
    expect(project(a).pages).toEqual([]);
    expect(useComic.getState()).toMatchObject({ activeProjectId: a, activePageId: null });
    useComic.getState().selectProject(b);
    useComic.getState().selectProject(a);
    expect(useComic.getState()).toMatchObject({ activeProjectId: a, activePageId: null });
  });
});

describe('deleting a comic that is not open', () => {
  it('keeps the open comic, its page and the selection', () => {
    const { a, b, first } = seed();
    const selected = page(a, first).panels[0]!.id;
    useComic.getState().selectPanel(selected);
    useComic.getState().deleteProject(b);
    const s = useComic.getState();
    expect(s.projects.map((p) => p.id)).toEqual([a]);
    expect(s).toMatchObject({ activeProjectId: a, activePageId: first, selectedPanelId: selected });
  });
});

describe('an edit of one balloon', () => {
  /** Two balloons in the first panel of the open page; the second one is selected with its editor open. */
  function withBubbles() {
    const { a, first } = seed();
    const panelId = page(a, first).panels[0]!.id;
    const one = useComic.getState().addBubble(panelId, 'speech')!;
    const two = useComic.getState().addBubble(panelId, 'caption')!;
    useComic.getState().openBubbleEditor(panelId, two);
    const bubble = (id: string) => findPanel(useComic.getState().projects, panelId)!.panel.bubbles.find((b) => b.id === id);
    return { panelId, one, two, bubble };
  }

  it('changes that balloon only, whether it is edited, fitted or centred', () => {
    const { panelId, one, two, bubble } = withBubbles();
    let other = bubble(two);
    useComic.getState().updateBubble(panelId, one, { text: 'Hello' });
    expect(bubble(one)!.text).toBe('Hello');
    expect(bubble(two)).toBe(other);
    useComic.getState().fitBubble(panelId, one, { scale: 1.4 }, true);
    expect(bubble(one)!.scale).toBe(1.4);
    expect(bubble(two)).toBe(other);
    // The balloon added first is the one the screen centres once it knows its size.
    useComic.setState({ centeringBubbleId: one });
    useComic.getState().centerBubble(panelId, one, 0.4, 0.2);
    expect(bubble(one)).toMatchObject({ x: 0.3, y: 0.4 });
    expect(bubble(two)).toBe(other);
    other = bubble(one);
    useComic.getState().updateBubble(panelId, two, { text: 'Bye' });
    expect(bubble(one)).toBe(other);
  });

  it('removed while another balloon is selected keeps that balloon selected and its editor open', () => {
    const { panelId, one, two, bubble } = withBubbles();
    useComic.getState().removeBubble(panelId, one);
    expect(bubble(one)).toBeUndefined();
    expect(useComic.getState()).toMatchObject({ selectedBubbleId: two, bubbleEditor: true });
    useComic.getState().removeBubble(panelId, two);
    expect(useComic.getState()).toMatchObject({ selectedBubbleId: null, bubbleEditor: false });
  });
});

describe('an edit of one character sheet', () => {
  it('changes that character only', () => {
    const { a } = seed();
    useComic.getState().setCast([
      { id: 'mina', name: 'Mina', tags: '1girl', imageName: 'mina.png' },
      { id: 'rio', name: 'Rio', tags: '1boy', imageName: 'rio.png' },
    ]);
    const rio = project(a).cast[1];
    useComic.getState().setCharacterView(a, 'mina', 'back', 'mina-back.png');
    expect(project(a).cast[0]!.sheet).toEqual({ back: 'mina-back.png' });
    expect(project(a).cast[1]).toBe(rio);
  });
});
