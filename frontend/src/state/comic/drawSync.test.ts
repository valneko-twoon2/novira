// While the comic screen is open the generation form holds the open comic's own drawing settings, and the Generate tab's are put back after.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useParams } from '../params';
import { useUi } from '../ui';
import { parseDraw } from './drawSettings';
import { isSwappingDraw, startComicDrawSync, withPageDraw } from './drawSync';
import { comicInvokeBuilder } from './generate';
import { activeProject, useComic } from './store';

let stop = () => undefined as void;

beforeEach(() => {
  useUi.setState({ activeTab: 'canvas' });
  useParams.getState().set({ steps: 30, width: 1024 });
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null });
  stop = startComicDrawSync();
});

afterEach(() => stop());

describe('comic drawing settings', () => {
  it('keeps a change made on the comic screen in the comic, and gives the Generate tab its own back', () => {
    useComic.getState().createProject('A');
    useUi.getState().setTab('comic');
    useParams.getState().set({ steps: 12 });
    expect(activeProject(useComic.getState())?.draw?.steps).toBe(12);
    useUi.getState().setTab('generate');
    expect(useParams.getState().steps).toBe(30);
    useUi.getState().setTab('comic');
    expect(useParams.getState().steps).toBe(12);
  });

  it('starts a comic that has no settings from the Generate tab, and does not write until something changes', () => {
    useComic.getState().createProject('A');
    useUi.getState().setTab('comic');
    expect(useParams.getState().steps).toBe(30);
    expect(activeProject(useComic.getState())?.draw).toBeUndefined();
  });

  it('gives each comic its own settings', () => {
    useComic.getState().createProject('A');
    const a = activeProject(useComic.getState())!.id;
    useUi.getState().setTab('comic');
    useParams.getState().set({ steps: 12 });
    useComic.getState().createProject('B');
    expect(useParams.getState().steps).toBe(30);
    useParams.getState().set({ steps: 40 });
    useComic.getState().selectProject(a);
    expect(useParams.getState().steps).toBe(12);
  });

  it('draws a panel with its comic\'s settings off the comic screen too, and leaves the Generate tab\'s form as it was', () => {
    const id = useComic.getState().createProject('A');
    useComic.getState().setDraw(id, { steps: 12 });
    useUi.getState().setTab('generate');
    const project = activeProject(useComic.getState())!;
    expect(useParams.getState().steps).toBe(30);
    expect(withPageDraw(project, project.pages[0], () => [useParams.getState().steps, useParams.getState().width])).toEqual([12, 1024]);
    expect(useParams.getState().steps).toBe(30);
  });

  it('drops saved values of the wrong kind', () => {
    expect(parseDraw({ steps: 'x', width: 512, extra: 1 })).toEqual({ width: 512 });
    expect(parseDraw({ steps: 'x' })).toBeUndefined();
    expect(parseDraw(null)).toBeUndefined();
  });

  it('is not taken for a change of the form by the comic builder, so its hints off the comic screen do not loop', () => {
    const id = useComic.getState().createProject('A');
    useComic.getState().setDraw(id, { steps: 12 });
    const page = activeProject(useComic.getState())!.pages[0]!;
    useComic.getState().selectPanel(page.panels[0]!.id);
    useUi.getState().setTab('generate');
    let runs = 0;
    const unsubscribe = comicInvokeBuilder.subscribe!(() => {
      runs++;
      comicInvokeBuilder.warnings!();
    });
    try {
      useParams.getState().set({ steps: 31 });
      expect(runs).toBe(1);
      expect(isSwappingDraw()).toBe(false);
    } finally {
      unsubscribe();
    }
  });
});

describe('comic drawing settings of an older version', () => {
  it('drops the manga finish a comic stored, since drawing no longer takes part in it', () => {
    expect(parseDraw({ steps: 12, manga: { enabled: true, screenLines: 240 } })).toEqual({ steps: 12 });
    expect(parseDraw({ manga: { enabled: true } })).toBeUndefined();
  });
});
