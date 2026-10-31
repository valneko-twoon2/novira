import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProject, type ComicProject } from './document';
import { useSettings } from '../settings';
import { historyLimit, restoreProjects } from './history';
import { findPanel, useComic } from './store';

function reset() {
  useComic.setState({
    projects: [],
    activeProjectId: null,
    activePageId: null,
    selectedPanelId: null,
    selectedBubbleId: null,
    pending: {},
    past: [],
    future: [],
  });
}

beforeEach(reset);
afterEach(() => vi.restoreAllMocks());

/** One project, open on its first page. Returns the ids the tests need. */
function openProject(name = 'Undo') {
  const project = newProject(name);
  useComic.getState().setProjects([project]);
  const page = project.pages[0]!;
  return { project, pageId: page.id, panels: page.panels.map((p) => p.id) };
}

const prompt = (panelId: string) => findPanel(useComic.getState().projects, panelId)!.panel.prompt;

describe('the comic undo history', () => {
  it('leaves the drawing settings, the style and the character references as they are now', () => {
    const { project, panels } = openProject();
    useComic.getState().setPrompt(panels[0]!, 'a cat');
    useComic.getState().setDraw(project.id, { steps: 12 });
    useComic.getState().setStyle(project.id, { positive: 'soft light' });
    useComic.getState().setCastReference(project.id, 0.4);
    useComic.getState().setPageDraw(project.pages[0]!.id, { width: 640 });
    useComic.getState().undo();
    const now = useComic.getState().projects[0]!;
    expect(prompt(panels[0]!)).toBe('');
    expect(now.draw).toEqual({ steps: 12 });
    expect(now.style?.positive).toBe('soft light');
    expect(now.castReference).toBe(0.4);
    expect(now.pages[0]!.draw).toEqual({ width: 640 });
  });

  it('takes back the last change to a prompt, and brings it back', () => {
    const [first] = openProject().panels;
    useComic.getState().setPrompt(first!, 'a cat');
    useComic.getState().undo();
    expect(prompt(first!)).toBe('');
    expect(useComic.getState().future).toHaveLength(1);

    useComic.getState().redo();
    expect(prompt(first!)).toBe('a cat');
    expect(useComic.getState().past).toHaveLength(1);
    expect(useComic.getState().future).toHaveLength(0);
  });

  it('typing in one field is one step, a pause starts another, and another field is never joined', () => {
    const now = vi.spyOn(Date, 'now');
    const [first] = openProject().panels;
    now.mockReturnValue(1000);
    useComic.getState().setPrompt(first!, 'a');
    now.mockReturnValue(1200);
    useComic.getState().setPrompt(first!, 'ab');
    now.mockReturnValue(1400);
    useComic.getState().setPrompt(first!, 'abc');
    expect(useComic.getState().past).toHaveLength(1);

    now.mockReturnValue(5000);
    useComic.getState().setPrompt(first!, 'abcd');
    expect(useComic.getState().past).toHaveLength(2);

    useComic.getState().undo();
    expect(prompt(first!)).toBe('abc');
    useComic.getState().undo();
    expect(prompt(first!)).toBe('');

    now.mockReturnValue(5100);
    useComic.getState().setPrompt(first!, 'x');
    useComic.getState().setPanelNegative(first!, 'y');
    expect(useComic.getState().past).toHaveLength(2);
  });

  it('keeps the pictures of the panels when a step is taken back', () => {
    const [first] = openProject().panels;
    useComic.getState().setPrompt(first!, 'before');
    useComic.getState().setPanelImage(first!, 'picture.png');
    useComic.getState().undo();
    expect(prompt(first!)).toBe('');
    expect(findPanel(useComic.getState().projects, first!)!.panel.imageName).toBe('picture.png');
  });

  it('keeps the templates and the name of the project when a step is taken back', () => {
    const { project, panels } = openProject('Named');
    const [first] = panels;
    useComic.getState().setPrompt(first!, 'x');
    useComic.getState().savePanelTemplate(first!, 'Saved');
    useComic.getState().renameProject(project.id, 'Renamed');
    useComic.getState().undo();
    const shown = useComic.getState().projects[0]!;
    expect(shown.name).toBe('Renamed');
    expect(shown.panelTemplates.map((t) => t.name)).toEqual(['Saved']);
    expect(prompt(first!)).toBe('');
  });

  it('a change in another project opens that project and its page', () => {
    const a = newProject('A');
    const b = newProject('B');
    useComic.getState().setProjects([a, b]);
    const bPanel = b.pages[0]!.panels[0]!.id;
    useComic.getState().selectProject(b.id);
    useComic.getState().setPrompt(bPanel, 'in B');
    useComic.getState().selectProject(a.id);

    useComic.getState().undo();
    expect(useComic.getState().activeProjectId).toBe(b.id);
    expect(useComic.getState().activePageId).toBe(b.pages[0]!.id);
    expect(prompt(bPanel)).toBe('');
  });

  it('a balloon that a step removes is no longer selected', () => {
    const [first] = openProject().panels;
    const bubble = useComic.getState().addBubble(first!, 'speech')!;
    expect(useComic.getState().selectedBubbleId).toBe(bubble);
    useComic.getState().undo();
    expect(findPanel(useComic.getState().projects, first!)!.panel.bubbles).toHaveLength(0);
    expect(useComic.getState().selectedBubbleId).toBeNull();
  });

  it('selecting, moving a picture and changing its view are not steps', () => {
    const [first] = openProject().panels;
    useComic.getState().selectPanel(first!);
    useComic.getState().setPanelImageView(first!, { scale: 2 });
    useComic.getState().setPanelImage(first!, 'a.png');
    expect(useComic.getState().past).toHaveLength(0);
  });

  it('undo and redo do nothing without a step, and a new change clears the steps that were taken back', () => {
    const [first] = openProject().panels;
    const before = useComic.getState().projects;
    useComic.getState().undo();
    useComic.getState().redo();
    expect(useComic.getState().projects).toBe(before);

    useComic.getState().setPrompt(first!, 'one');
    useComic.getState().undo();
    expect(useComic.getState().future).toHaveLength(1);
    useComic.getState().setPrompt(first!, 'two');
    expect(useComic.getState().future).toHaveLength(0);
  });

  it('keeps as many steps as the undo setting says', () => {
    useSettings.getState().set({ undoLimit: 20 });
    const HISTORY_LIMIT = historyLimit();
    const { pageId } = openProject();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) useComic.getState().setPageLayout(pageId, { columns: i % 2 ? 1 : 2 });
    expect(HISTORY_LIMIT).toBe(20);
    expect(useComic.getState().past).toHaveLength(20);
    useSettings.getState().reset();
  });

  it('a step that opens another project lets go of the panel and the balloon selected in this one', () => {
    const a = newProject('A');
    const b = newProject('B');
    useComic.getState().setProjects([a, b]);
    const aPanel = a.pages[0]!.panels[0]!.id;
    const bubble = useComic.getState().addBubble(aPanel, 'speech')!;
    useComic.getState().selectProject(b.id);
    useComic.getState().setPrompt(b.pages[0]!.panels[0]!.id, 'in B');
    useComic.getState().selectProject(a.id);
    useComic.getState().openBubbleEditor(aPanel, bubble);

    useComic.getState().undo();
    expect(useComic.getState()).toMatchObject({ activeProjectId: b.id, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false });
  });

  it('a step that keeps the selected balloon keeps it selected with its editor open', () => {
    const [first] = openProject().panels;
    const bubble = useComic.getState().addBubble(first!, 'speech')!;
    useComic.getState().openBubbleEditor(first!, bubble);
    useComic.getState().setPrompt(first!, 'a cat');

    useComic.getState().undo();
    expect(prompt(first!)).toBe('');
    expect(useComic.getState()).toMatchObject({ selectedPanelId: first, selectedBubbleId: bubble, bubbleEditor: true });
  });

  it('a step of a project deleted since changes nothing and keeps the open project and page', () => {
    const a = newProject('A');
    const b = newProject('B');
    useComic.getState().setProjects([a, b]);
    useComic.getState().setPrompt(a.pages[0]!.panels[0]!.id, 'in A');
    useComic.getState().deleteProject(a.id);
    const kept = useComic.getState().projects;

    useComic.getState().undo();
    expect(useComic.getState().projects).toEqual(kept);
    expect(useComic.getState().projects[0]).toBe(kept[0]);
    expect(useComic.getState()).toMatchObject({ activeProjectId: b.id, activePageId: b.pages[0]!.id, past: [] });
  });

  it('a step of the last project, deleted since, leaves nothing open', () => {
    const { project, panels } = openProject();
    useComic.getState().setPrompt(panels[0]!, 'gone');
    useComic.getState().deleteProject(project.id);

    useComic.getState().undo();
    expect(useComic.getState()).toMatchObject({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null });
  });
});

describe('restoreProjects', () => {
  it('keeps the project object when the snapshot has the same one', () => {
    const project = newProject('Same');
    expect(restoreProjects([project], [project], 1)).toEqual([project]);
    expect(restoreProjects([project], [project], 1)[0]).toBe(project);
  });

  it('keeps the views of the characters\' sheets as they are now, like the panels\' pictures', () => {
    const before: ComicProject = { ...newProject('Sheet'), cast: [{ id: 'c', name: 'Mina', tags: 'old words', imageName: 'front.png', sheet: { face: 'old-face.png' } }] };
    const now: ComicProject = { ...before, cast: [{ id: 'c', name: 'Mina', tags: 'new words', imageName: 'front.png', sheet: { back: 'back.png' } }] };
    const restored = restoreProjects([now], [before], 1)[0]!;
    expect(restored.cast[0]).toEqual({ id: 'c', name: 'Mina', tags: 'old words', imageName: 'front.png', sheet: { back: 'back.png' } });
    const emptied: ComicProject = { ...before, cast: [{ id: 'c', name: 'Mina', tags: 'new words', imageName: 'front.png' }] };
    expect(restoreProjects([emptied], [before], 1)[0]!.cast[0]).not.toHaveProperty('sheet');
  });

  it('keeps a project that the snapshot does not have', () => {
    const made: ComicProject = newProject('Made later');
    const old = newProject('Old');
    expect(restoreProjects([made], [old], 1)[0]).toBe(made);
  });
});
