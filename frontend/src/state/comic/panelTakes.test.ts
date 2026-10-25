import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_VIEW, newProject, nextTakes, parseComicProject, serializeComicProject, TAKES_MAX, type ComicPanel } from './document';
import { findPanel, useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
}

/** A project with one page of one panel, `panel-0`. */
function seed() {
  const project = newProject('P');
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, id: 'panel-0' }];
  useComic.getState().setProjects([project]);
}

const panel = (): ComicPanel => findPanel(useComic.getState().projects, 'panel-0')!.panel;
const names = () => panel().takes.map((t) => t.imageName);

beforeEach(reset);

describe('the earlier pictures of a panel', () => {
  it('keeps the picture a redraw replaced, with how it sat, in front of the list', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'first.png');
    useComic.getState().setPanelImageView('panel-0', { scale: 2, cx: 0.3 });
    useComic.getState().setPanelImage('panel-0', 'second.png');
    expect(panel().imageName).toBe('second.png');
    expect(panel().imageView).toEqual(DEFAULT_IMAGE_VIEW);
    expect(panel().takes).toEqual([{ imageName: 'first.png', view: { ...DEFAULT_IMAGE_VIEW, scale: 2, cx: 0.3 } }]);
  });

  it('puts an earlier picture back as it sat, and the one it replaced goes in front', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'first.png');
    useComic.getState().setPanelImageView('panel-0', { rotation: 30 });
    useComic.getState().setPanelImage('panel-0', 'second.png');
    useComic.getState().setPanelImageView('panel-0', { flipX: true });
    useComic.getState().setPanelImage('panel-0', 'first.png');
    expect(panel().imageName).toBe('first.png');
    expect(panel().imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, rotation: 30 });
    expect(panel().takes).toEqual([{ imageName: 'second.png', view: { ...DEFAULT_IMAGE_VIEW, flipX: true } }]);
  });

  it('keeps a picture taken out of the panel, so it can be put back', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'only.png');
    useComic.getState().setPanelImage('panel-0', null);
    expect(panel().imageName).toBeNull();
    expect(names()).toEqual(['only.png']);
  });

  it('keeps the list and the view when the panel is given the picture it has', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'same.png');
    useComic.getState().setPanelImageView('panel-0', { scale: 2 });
    useComic.getState().setPanelImage('panel-0', 'same.png');
    expect(names()).toEqual([]);
    expect(panel().imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, scale: 2 });
  });

  it('keeps at most TAKES_MAX, dropping the oldest', () => {
    seed();
    for (let i = 0; i <= TAKES_MAX + 1; i++) useComic.getState().setPanelImage('panel-0', `p${i}.png`);
    expect(panel().imageName).toBe(`p${TAKES_MAX + 1}.png`);
    expect(names()).toHaveLength(TAKES_MAX);
    expect(names()[0]).toBe(`p${TAKES_MAX}.png`);
    expect(names()).not.toContain('p0.png');
  });

  it('removes one picture from the list and leaves the others and the panel picture', () => {
    seed();
    for (const name of ['a.png', 'b.png', 'c.png']) useComic.getState().setPanelImage('panel-0', name);
    useComic.getState().removeTake('panel-0', 'a.png');
    expect(panel().imageName).toBe('c.png');
    expect(names()).toEqual(['b.png']);
  });

  it('is left as it is by undo, like the pictures', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'a.png');
    useComic.getState().setPrompt('panel-0', 'a girl');
    useComic.getState().setPanelImage('panel-0', 'b.png');
    useComic.getState().undo();
    expect(panel().prompt).toBe('');
    expect(panel().imageName).toBe('b.png');
    expect(names()).toEqual(['a.png']);
  });
});

describe('nextTakes', () => {
  const take = (imageName: string) => ({ imageName, view: { ...DEFAULT_IMAGE_VIEW } });

  it('leaves the list alone when there was no picture and the new one is not in it', () => {
    expect(nextTakes([take('a')], null, 'b')).toEqual([take('a')]);
  });

  it('takes the new picture out of the list when it was there', () => {
    expect(nextTakes([take('a'), take('b')], null, 'b')).toEqual([take('a')]);
  });
});

describe('the earlier pictures in a saved comic', () => {
  it('are saved and read back', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'a.png');
    useComic.getState().setPanelImage('panel-0', 'b.png');
    const read = parseComicProject(serializeComicProject(useComic.getState().projects[0]!));
    expect(read!.pages[0]!.panels[0]!.takes.map((t) => t.imageName)).toEqual(['a.png']);
  });

  it('read back without the broken entries, repeats, the panel picture, or more than TAKES_MAX', () => {
    const project = serializeComicProject(newProject('P')) as Record<string, unknown>;
    const pages = project.pages as { panels: Record<string, unknown>[] }[];
    pages[0]!.panels[0]!.imageName = 'now.png';
    pages[0]!.panels[0]!.takes = [
      { imageName: 'now.png' },
      { imageName: 'a.png', view: { cx: 0.5, cy: 0.5, scale: 99, rotation: 400 } },
      { imageName: 'a.png' },
      { imageName: '' },
      'b.png',
      null,
      ...Array.from({ length: TAKES_MAX + 3 }, (_, i) => ({ imageName: `t${i}.png` })),
    ];
    const takes = parseComicProject(project)!.pages[0]!.panels[0]!.takes;
    expect(takes[0]).toEqual({ imageName: 'a.png', view: { ...DEFAULT_IMAGE_VIEW, scale: 8, rotation: 40 } });
    expect(takes).toHaveLength(TAKES_MAX);
    expect(takes.map((t) => t.imageName)).not.toContain('now.png');
  });

  it('are an empty list for a panel saved before there were any', () => {
    const project = serializeComicProject(newProject('P')) as Record<string, unknown>;
    delete (project.pages as { panels: Record<string, unknown>[] }[])[0]!.panels[0]!.takes;
    expect(parseComicProject(project)!.pages[0]!.panels[0]!.takes).toEqual([]);
  });
});
