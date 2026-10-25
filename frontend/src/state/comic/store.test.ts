import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPage, newProject, type ComicPoint } from './document';
import { MAX_PANELS_PER_PAGE } from './layout';
import { newRough } from './rough';
import { activePage, activeProject, findPanel, workPanel, useComic } from './store';

const joints: ComicPoint[] = Array.from({ length: 18 }, () => ({ x: 0.5, y: 0.5 }));

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
}

/** Two projects, the first one open on its first page. */
function seed() {
  const a = newProject('A');
  const b = newProject('B');
  useComic.getState().setProjects([a, b]);
  return { a, b };
}

beforeEach(reset);

describe('the comic store: projects', () => {
  it('opens the first project on its first page', () => {
    const { a } = seed();
    const s = useComic.getState();
    expect(activeProject(s)?.id).toBe(a.id);
    expect(activePage(s)?.id).toBe(a.pages[0]!.id);
  });

  it('creates a project at the front and opens it', () => {
    seed();
    const id = useComic.getState().createProject('New');
    const s = useComic.getState();
    expect(s.projects[0]!.id).toBe(id);
    expect(s.projects[0]!.name).toBe('New');
    expect(s.projects[0]!.pages).toHaveLength(1);
    expect(s.activeProjectId).toBe(id);
  });

  it('keeps the space typed at the end of a character part and of a place\'s negative words', () => {
    seed();
    useComic.getState().setCast([{ id: 'c1', name: 'Mio', tags: '1girl', imageName: null, parts: { hair: 'long ' } }]);
    expect(activeProject(useComic.getState())!.cast[0]!.parts).toEqual({ hair: 'long ' });
    useComic.getState().setPlaces([{ id: 'p1', name: 'Room', tags: 'bedroom', negative: 'no ' }]);
    expect(activeProject(useComic.getState())!.places[0]!.negative).toBe('no ');
    // A box that holds only spaces holds nothing.
    useComic.getState().setCast([{ id: 'c1', name: 'Mio', tags: '1girl', imageName: null, parts: { hair: '  ' } }]);
    expect(activeProject(useComic.getState())!.cast[0]!.parts).toBeUndefined();
  });

  it('renames a project and leaves the others alone', () => {
    const { a, b } = seed();
    useComic.getState().renameProject(a.id, 'Renamed');
    const s = useComic.getState();
    expect(s.projects.find((p) => p.id === a.id)!.name).toBe('Renamed');
    expect(s.projects.find((p) => p.id === b.id)).toBe(b);
  });

  it('deletes the open project and opens the next one', () => {
    const { a, b } = seed();
    useComic.getState().deleteProject(a.id);
    const s = useComic.getState();
    expect(s.projects.map((p) => p.id)).toEqual([b.id]);
    expect(s.activeProjectId).toBe(b.id);
    expect(s.activePageId).toBe(b.pages[0]!.id);
  });

  it('deletes the last project and has nothing open', () => {
    const { a } = seed();
    useComic.getState().deleteProject(a.id);
    useComic.getState().deleteProject(useComic.getState().projects[0]!.id);
    const s = useComic.getState();
    expect(s.projects).toEqual([]);
    expect(s.activeProjectId).toBeNull();
    expect(activePage(s)).toBeNull();
  });

  it('changes the project on screen and clears the selection', () => {
    const { b } = seed();
    const panel = useComic.getState().projects[0]!.pages[0]!.panels[0]!;
    useComic.getState().selectPanel(panel.id);
    useComic.getState().selectProject(b.id);
    const s = useComic.getState();
    expect(s.activeProjectId).toBe(b.id);
    expect(s.selectedPanelId).toBeNull();
  });

  it('ignores a project id that is not there', () => {
    seed();
    const before = useComic.getState().activeProjectId;
    useComic.getState().selectProject('nope');
    expect(useComic.getState().activeProjectId).toBe(before);
  });

  it('replaces the project object on every change, so changes can be told apart', () => {
    const { a, b } = seed();
    useComic.getState().setPrompt(a.pages[0]!.panels[0]!.id, 'x');
    const s = useComic.getState();
    expect(s.projects.find((p) => p.id === a.id)).not.toBe(a);
    expect(s.projects.find((p) => p.id === b.id)).toBe(b);
  });
});

describe('the comic store: pages and panels', () => {
  it('adds a page with three panels and opens it', () => {
    const { a } = seed();
    const id = useComic.getState().addPage();
    const s = useComic.getState();
    const project = s.projects.find((p) => p.id === a.id)!;
    expect(project.pages).toHaveLength(2);
    expect(s.activePageId).toBe(id);
    expect(project.pages[1]!.panels).toHaveLength(3);
  });

  it('deletes a page and moves to the first page left', () => {
    const { a } = seed();
    const second = emptyPage();
    useComic.getState().setProjects([{ ...a, pages: [a.pages[0]!, second] }]);
    useComic.getState().selectPage(second.id);
    useComic.getState().deletePage(second.id);
    const s = useComic.getState();
    expect(s.projects[0]!.pages.map((p) => p.id)).toEqual([a.pages[0]!.id]);
    expect(s.activePageId).toBe(a.pages[0]!.id);
  });

  it('grows and shrinks the panels of a page, keeping the first ones', () => {
    const { a } = seed();
    const pageId = a.pages[0]!.id;
    const [first, second, third] = a.pages[0]!.panels;
    useComic.getState().setPanelCount(pageId, 5);
    let panels = useComic.getState().projects[0]!.pages[0]!.panels;
    expect(panels).toHaveLength(5);
    expect(panels.slice(0, 3).map((p) => p.id)).toEqual([first!.id, second!.id, third!.id]);
    useComic.getState().setPanelCount(pageId, 1);
    panels = useComic.getState().projects[0]!.pages[0]!.panels;
    expect(panels.map((p) => p.id)).toEqual([first!.id]);
  });

  it('keeps the count within one to the most a page holds', () => {
    const { a } = seed();
    useComic.getState().setPanelCount(a.pages[0]!.id, 500);
    expect(useComic.getState().projects[0]!.pages[0]!.panels).toHaveLength(MAX_PANELS_PER_PAGE);
    useComic.getState().setPanelCount(a.pages[0]!.id, 0);
    expect(useComic.getState().projects[0]!.pages[0]!.panels).toHaveLength(1);
  });

  it('clears the selection when its panel is removed', () => {
    const { a } = seed();
    const last = a.pages[0]!.panels[2]!;
    useComic.getState().selectPanel(last.id);
    useComic.getState().setPanelCount(a.pages[0]!.id, 1);
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('finds a panel in whichever project holds it', () => {
    const { b } = seed();
    const panel = b.pages[0]!.panels[1]!;
    const ref = findPanel(useComic.getState().projects, panel.id);
    expect(ref).toMatchObject({ pageIndex: 0, panelIndex: 1 });
    expect(ref!.project.id).toBe(b.id);
    expect(findPanel(useComic.getState().projects, 'missing')).toBeNull();
  });

  it('selects the panel on screen', () => {
    const { a } = seed();
    const panel = a.pages[0]!.panels[0]!;
    useComic.getState().selectPanel(panel.id);
    expect(workPanel(useComic.getState())?.panel.id).toBe(panel.id);
  });

  it('sets the prompt, the picture and the pose of a panel', () => {
    const { a } = seed();
    const panel = a.pages[0]!.panels[0]!.id;
    const s = useComic.getState();
    s.setPrompt(panel, 'a dog');
    s.setPanelImage(panel, 'img.png');
    s.setPanelPose(panel, [joints], 'pose.png');
    const saved = findPanel(useComic.getState().projects, panel)!.panel;
    expect(saved).toMatchObject({ prompt: 'a dog', imageName: 'img.png', poses: [joints], poseImageName: 'pose.png' });
    useComic.getState().setPanelPose(panel, [], null);
    expect(findPanel(useComic.getState().projects, panel)!.panel).toMatchObject({ poses: [], poseImageName: null });
  });

  it('puts a 3D rough into a panel in one undo step, and lets a pose put in another way drop its depth map', () => {
    const { a } = seed();
    const panel = a.pages[0]!.panels[0]!.id;
    const rough = newRough();
    useComic.getState().setPanelRough(panel, rough, [joints], 'rough-pose.png', 'rough-depth.png');
    expect(findPanel(useComic.getState().projects, panel)!.panel).toMatchObject({ rough, poses: [joints], poseImageName: 'rough-pose.png', depthImageName: 'rough-depth.png' });
    useComic.getState().undo();
    const before = findPanel(useComic.getState().projects, panel)!.panel;
    expect(before.rough).toBeUndefined();
    expect(before.depthImageName).toBeUndefined();
    useComic.getState().redo();
    // A pose from the pose editor, a ready-made one or the assistant: the rough stays, its depth map goes.
    useComic.getState().setPanelPose(panel, [joints], 'pose.png');
    const after = findPanel(useComic.getState().projects, panel)!.panel;
    expect(after.rough).toEqual(rough);
    expect(after).not.toHaveProperty('depthImageName');
  });

  it('drops the depth map of a panel a template is put into', () => {
    const { a } = seed();
    const panel = a.pages[0]!.panels[0]!.id;
    const template = useComic.getState().savePanelTemplate(panel, 'standing')!;
    useComic.getState().setPanelRough(panel, newRough(), [joints], 'rough-pose.png', 'rough-depth.png');
    useComic.getState().applyPanelTemplate(panel, template);
    expect(findPanel(useComic.getState().projects, panel)!.panel).not.toHaveProperty('depthImageName');
  });
});

describe('the comic store: the cast', () => {
  it('keeps every field of a character it is given, the words kept out of its panels as they are typed', () => {
    seed();
    useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', parts: { hair: 'red hair' }, nonHuman: true, negative: 'red ', imageName: 'mina.png' }]);
    expect(useComic.getState().projects[0]!.cast).toEqual([{ id: 'c', name: 'Mina', tags: '1girl', parts: { hair: 'red hair' }, nonHuman: true, negative: 'red ', imageName: 'mina.png' }]);
    useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', negative: '', imageName: null }]);
    expect(useComic.getState().projects[0]!.cast[0]).not.toHaveProperty('negative');
    useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', imageName: 'f.png', sheet: { back: 'b.png', side: '' }, libraryId: 'preset-1' }]);
    expect(useComic.getState().projects[0]!.cast[0]).toMatchObject({ sheet: { back: 'b.png' }, libraryId: 'preset-1' });
  });

  it('puts a view into the sheet of a character of any comic, and takes it out, without an undo step', () => {
    const { a, b } = seed();
    useComic.getState().selectProject(b.id);
    useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', imageName: 'f.png' }]);
    useComic.getState().selectProject(a.id);
    const steps = useComic.getState().past.length;
    const castOf = () => useComic.getState().projects.find((p) => p.id === b.id)!.cast[0]!;
    useComic.getState().setCharacterView(b.id, 'c', 'back', 'b.png');
    useComic.getState().setCharacterView(b.id, 'c', 'face', 'f2.png');
    expect(castOf().sheet).toEqual({ back: 'b.png', face: 'f2.png' });
    useComic.getState().setCharacterView(b.id, 'c', 'back', null);
    expect(castOf().sheet).toEqual({ face: 'f2.png' });
    useComic.getState().setCharacterView(b.id, 'c', 'face', null);
    expect(castOf()).not.toHaveProperty('sheet');
    expect(useComic.getState().past.length).toBe(steps);
    // An unknown character or comic changes nothing.
    const projects = useComic.getState().projects;
    useComic.getState().setCharacterView(b.id, 'nobody', 'back', 'x.png');
    useComic.getState().setCharacterView('gone', 'c', 'back', 'x.png');
    expect(useComic.getState().projects).toBe(projects);
  });

  it('turns the character references on at a strength kept in range, and off again', () => {
    const { a } = seed();
    const comic = () => useComic.getState().projects.find((p) => p.id === a.id)!;
    expect(comic()).not.toHaveProperty('castReference');
    useComic.getState().setCastReference(a.id, 0.4);
    expect(comic().castReference).toBe(0.4);
    useComic.getState().setCastReference(a.id, 3);
    expect(comic().castReference).toBe(1);
    useComic.getState().setCastReference(a.id, undefined);
    expect(comic()).not.toHaveProperty('castReference');
  });
});

describe('the comic store: the places and the world', () => {
  const comic = () => useComic.getState().projects[0]!;
  const panelOf = (id: string) => findPanel(useComic.getState().projects, id)!.panel;

  it('keeps the places it is given, and a panel set in a place that is removed loses it', () => {
    const { a } = seed();
    const [first, second] = a.pages[0]!.panels.map((p) => p.id) as [string, string];
    useComic.getState().setPlaces([
      { id: 'room', name: 'Room', tags: 'bedroom ', negative: '' },
      { id: 'pier', name: 'Pier', tags: 'pier, sea', negative: 'boats' },
    ]);
    expect(comic().places).toEqual([
      { id: 'room', name: 'Room', tags: 'bedroom ' },
      { id: 'pier', name: 'Pier', tags: 'pier, sea', negative: 'boats' },
    ]);
    useComic.getState().setPanelPlace(first, 'room');
    useComic.getState().setPanelPlace(second, 'pier');
    useComic.getState().setPlaces([{ id: 'pier', name: 'Pier', tags: 'pier' }]);
    expect(panelOf(first)).not.toHaveProperty('place');
    expect(panelOf(second).place).toBe('pier');
    useComic.getState().setPanelPlace(second, null);
    expect(panelOf(second)).not.toHaveProperty('place');
    // Another comic keeps its own (empty) places.
    expect(useComic.getState().projects[1]!.places).toEqual([]);
  });

  it('keeps the world as it is typed, drops one with no word, and undoes a run of typing in one step', () => {
    seed();
    for (const text of ['s', 'su', 'summer ']) useComic.getState().setWorld(text);
    expect(comic().world).toBe('summer ');
    useComic.getState().undo();
    expect(comic()).not.toHaveProperty('world');
    useComic.getState().setWorld('summer');
    useComic.getState().setWorld('   ');
    expect(comic()).not.toHaveProperty('world');
  });
});

describe('the comic store: balloons and captions', () => {
  it('adds a balloon and selects it, then edits and removes it', () => {
    const { a } = seed();
    const panelId = a.pages[0]!.panels[0]!.id;
    const id = useComic.getState().addBubble(panelId, 'speech')!;
    expect(useComic.getState().selectedBubbleId).toBe(id);
    useComic.getState().updateBubble(panelId, id, { text: 'Hello', kind: 'caption', x: 0.3, y: 0.4 });
    const bubble = findPanel(useComic.getState().projects, panelId)!.panel.bubbles[0]!;
    expect(bubble).toMatchObject({ id, text: 'Hello', kind: 'caption', x: 0.3, y: 0.4 });
    useComic.getState().removeBubble(panelId, id);
    expect(findPanel(useComic.getState().projects, panelId)!.panel.bubbles).toEqual([]);
    expect(useComic.getState().selectedBubbleId).toBeNull();
  });

  it('adds nothing to a panel that is not there', () => {
    seed();
    expect(useComic.getState().addBubble('missing', 'speech')).toBeNull();
  });
});

describe('the comic store: queue items', () => {
  it('remembers which panel a queue item is drawing, and forgets it', () => {
    useComic.getState().setPending(7, 'panel-x');
    expect(useComic.getState().pending).toEqual({ 7: 'panel-x' });
    useComic.getState().clearPending(7);
    expect(useComic.getState().pending).toEqual({});
    useComic.getState().clearPending(7);
    expect(useComic.getState().pending).toEqual({});
  });
});
