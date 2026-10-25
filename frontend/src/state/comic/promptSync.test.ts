import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { newProject } from './document';
import { startComicPromptSync } from './promptSync';
import { findPanel, useComic } from './store';

/** A comic with one page of three panels, each with its own prompts, and the Generate tab's own prompts in the boxes. */
function seed() {
  const project = newProject('P');
  const blank = project.pages[0]!.panels[0]!;
  project.pages[0]!.panels = [0, 1, 2].map((i) => ({ ...blank, id: `panel-${i}`, prompt: `prompt ${i}`, negativePrompt: `negative ${i}` }));
  useComic.getState().setProjects([project]);
  useParams.getState().set({ positivePrompt: 'generate text', negativePrompt: 'generate negative' });
  useUi.getState().setTab('generate');
}

const boxes = () => ({ positive: useParams.getState().positivePrompt, negative: useParams.getState().negativePrompt });
const panel = (id: string) => findPanel(useComic.getState().projects, id)!.panel;

let stop: () => void = () => {};
beforeEach(() => {
  seed();
  stop = startComicPromptSync();
});
afterEach(() => {
  stop();
  useUi.getState().setTab('generate');
});

describe('the prompt boxes on the comic screen', () => {
  it('show the first panel when the comic screen opens with no panel selected', () => {
    useUi.getState().setTab('comic');
    expect(useComic.getState().selectedPanelId).toBeNull();
    expect(boxes()).toEqual({ positive: 'prompt 0', negative: 'negative 0' });
  });

  it('follow the selected panel', () => {
    useUi.getState().setTab('comic');
    useComic.getState().selectPanel('panel-2');
    expect(boxes()).toEqual({ positive: 'prompt 2', negative: 'negative 2' });
  });

  it('write what is typed (or applied from a preset) into the selected panel only', () => {
    useUi.getState().setTab('comic');
    useComic.getState().selectPanel('panel-1');
    useParams.getState().set({ positivePrompt: 'a girl on a roof' });
    useParams.getState().set({ negativePrompt: 'blurry' });
    expect(panel('panel-1')).toMatchObject({ prompt: 'a girl on a roof', negativePrompt: 'blurry' });
    expect(panel('panel-0')).toMatchObject({ prompt: 'prompt 0', negativePrompt: 'negative 0' });
  });

  it('show a change made to the panel elsewhere, such as an undo', () => {
    useUi.getState().setTab('comic');
    useParams.getState().set({ positivePrompt: 'changed' });
    useComic.getState().undo();
    expect(panel('panel-0').prompt).toBe('prompt 0');
    expect(boxes().positive).toBe('prompt 0');
  });

  it('stay on the panel selected last when the selection is let go, without selecting it again', () => {
    useUi.getState().setTab('comic');
    useComic.getState().selectPanel('panel-1');
    useComic.getState().selectPanel('panel-2');
    useComic.getState().selectPanel(null);
    expect(useComic.getState().selectedPanelId).toBeNull();
    expect(boxes()).toEqual({ positive: 'prompt 2', negative: 'negative 2' });
    useParams.getState().set({ positivePrompt: 'typed with nothing selected' });
    expect(panel('panel-2').prompt).toBe('typed with nothing selected');
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('let the backdrop stay selected', () => {
    useUi.getState().setTab('comic');
    useComic.getState().selectPanel('panel-1');
    useComic.getState().selectBackdrop(true);
    expect(useComic.getState()).toMatchObject({ backdropSelected: true, selectedPanelId: null });
    expect(boxes().positive).toBe('prompt 1');
  });

  it('give the Generate tab its own prompts back when another screen opens', () => {
    useUi.getState().setTab('comic');
    useParams.getState().set({ positivePrompt: 'panel text' });
    useUi.getState().setTab('generate');
    expect(boxes()).toEqual({ positive: 'generate text', negative: 'generate negative' });
    expect(panel('panel-0').prompt).toBe('panel text');
  });

  it('leave the panels alone while another screen has the boxes', () => {
    useParams.getState().set({ positivePrompt: 'typed on Generate' });
    expect(panel('panel-0').prompt).toBe('prompt 0');
  });
});
