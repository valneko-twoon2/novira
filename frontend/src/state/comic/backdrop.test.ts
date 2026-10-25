// The picture over the whole page: reading it, putting it in, changing its view, and what editing it does to the selection.
import { beforeEach, describe, expect, it } from 'vitest';
import { newProject, parseComicProject, serializeComicProject } from './document';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, imageSelected: false, backdropSelected: false, cutting: false, pending: {}, past: [], future: [] });
}

function seed() {
  const project = newProject('P');
  useComic.getState().setProjects([project]);
  return project.pages[0]!.id;
}

const page = () => useComic.getState().projects[0]!.pages[0]!;

beforeEach(reset);

describe('the page backdrop in a saved comic', () => {
  const read = (backdrop: unknown) => parseComicProject({ version: 1, id: 'c', pages: [{ id: 'p', panels: [{ id: 'x' }], backdrop }] })!.pages[0]!.backdrop;

  it('reads the picture and its view, keeping the view within its range', () => {
    expect(read({ imageName: 'a.png', view: { cx: 0.2, cy: 0.9, scale: 99, rotation: 450, flipX: true } })).toMatchObject({ imageName: 'a.png', view: { cx: 0.2, cy: 0.9, scale: 8, rotation: 90, flipX: true, flipY: false } });
  });

  it('is none without a picture, and a page saved before it has none; a view that is missing covers the page', () => {
    expect(read({ view: {} })).toBeNull();
    expect(read({ imageName: '' })).toBeNull();
    expect(read(undefined)).toBeNull();
    expect(read({ imageName: 'a.png' })!.view).toMatchObject({ cx: 0.5, cy: 0.5, scale: 1, rotation: 0 });
  });

  it('is saved and read back as it was', () => {
    const id = seed();
    useComic.getState().setBackdrop(id, 'a.png');
    useComic.getState().setBackdropView(id, { scale: 2, rotation: 30 });
    const again = parseComicProject(serializeComicProject(useComic.getState().projects[0]!))!;
    expect(again.pages[0]!.backdrop).toEqual(page().backdrop);
  });
});

describe('putting a backdrop in', () => {
  it('starts a new picture covering the page, and keeps the view of the same picture', () => {
    const id = seed();
    useComic.getState().setBackdrop(id, 'a.png');
    useComic.getState().setBackdropView(id, { scale: 3, cx: 0.2 });
    useComic.getState().setBackdrop(id, 'a.png');
    expect(page().backdrop!.view).toMatchObject({ scale: 3, cx: 0.2 });
    useComic.getState().setBackdrop(id, 'b.png');
    expect(page().backdrop).toEqual({ imageName: 'b.png', view: expect.objectContaining({ scale: 1, cx: 0.5 }) });
  });

  it('is taken away with null, which also ends editing it, and undo puts it back', () => {
    const id = seed();
    useComic.getState().setBackdrop(id, 'a.png');
    useComic.getState().selectBackdrop(true);
    useComic.getState().setBackdrop(id, null);
    expect(page().backdrop).toBeNull();
    expect(useComic.getState().backdropSelected).toBe(false);
    useComic.getState().undo();
    expect(page().backdrop!.imageName).toBe('a.png');
  });

  it('changes the view of a backdrop that is there only, within the range, and a drag is one undo step', () => {
    const id = seed();
    useComic.getState().setBackdropView(id, { scale: 2 });
    expect(page().backdrop).toBeNull();
    useComic.getState().setBackdrop(id, 'a.png');
    const steps = useComic.getState().past.length;
    useComic.getState().setBackdropView(id, { scale: 100, cx: 0.4 });
    useComic.getState().setBackdropView(id, { cx: 0.6 });
    expect(page().backdrop!.view).toMatchObject({ scale: 8, cx: 0.6 });
    expect(useComic.getState().past.length).toBe(steps + 1);
  });
});

describe('editing the backdrop', () => {
  it('lets go of the panel and the picture selected, and a panel chosen after it ends the editing', () => {
    const id = seed();
    const panel = page().panels[0]!.id;
    useComic.getState().setBackdrop(id, 'a.png');
    useComic.getState().selectImage(panel);
    useComic.getState().selectBackdrop(true);
    expect(useComic.getState()).toMatchObject({ backdropSelected: true, selectedPanelId: null, imageSelected: false });
    useComic.getState().selectPanel(panel);
    expect(useComic.getState().backdropSelected).toBe(false);
    useComic.getState().selectBackdrop(true);
    useComic.getState().selectPage(id);
    expect(useComic.getState().backdropSelected).toBe(false);
  });
});
