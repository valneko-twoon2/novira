import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, QueueItem } from '@/backend';
import { useQueue } from '@/state/queue';
import { newProject } from './document';
import { bindComicItem, bindSheetItem, onComicImage, onComicQueueItem } from './results';
import { findPanel, useComic } from './store';

const item = (id: number, status: QueueItem['status'] = 'in_progress') => ({ id, status }) as QueueItem;
const image = (name: string) => ({ name, url: `novira://${name}` }) as ImageDTO;

let panelId: string;

beforeEach(() => {
  const project = newProject('Results');
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.getState().setProjects([project]);
  useComic.setState({ pending: {}, drawFailed: {}, sheetPending: {} });
  useQueue.setState({ items: [] });
});

describe('the pictures the queue makes', () => {
  it('puts the picture of a waiting queue item into its panel, and stops waiting for it', () => {
    useComic.getState().setPending(5, panelId);
    onComicImage(item(5, 'completed'), image('made.png'));
    expect(findPanel(useComic.getState().projects, panelId)!.panel.imageName).toBe('made.png');
    expect(useComic.getState().pending).toEqual({});
  });

  it('leaves alone the pictures of queue items this screen did not start', () => {
    useComic.getState().setPending(5, panelId);
    onComicImage(item(6, 'completed'), image('other.png'));
    expect(findPanel(useComic.getState().projects, panelId)!.panel.imageName).toBeNull();
    expect(useComic.getState().pending).toEqual({ 5: panelId });
  });

  it('forgets a queue item that failed or was cancelled, and keeps one still running', () => {
    useComic.getState().setPending(1, panelId);
    useComic.getState().setPending(2, panelId);
    useComic.getState().setPending(3, panelId);
    onComicQueueItem(item(1, 'failed'));
    onComicQueueItem(item(2, 'canceled'));
    onComicQueueItem(item(3, 'in_progress'));
    expect(useComic.getState().pending).toEqual({ 3: panelId });
  });

  it('remembers that a panel failed to draw, until it is drawn again', () => {
    useComic.getState().setPending(1, panelId);
    onComicQueueItem(item(1, 'failed'));
    expect(useComic.getState().drawFailed).toEqual({ [panelId]: true });
    useComic.getState().setPending(2, panelId);
    expect(useComic.getState().drawFailed).toEqual({});
  });

  it('does not count a cancelled job as a failed draw', () => {
    useComic.getState().setPending(1, panelId);
    onComicQueueItem(item(1, 'canceled'));
    expect(useComic.getState().drawFailed).toEqual({});
  });
});

describe('binding a drawn queue item to its panel', () => {
  it('waits for the picture when the item is still queued', () => {
    bindComicItem(item(7, 'pending'), panelId);
    expect(useComic.getState().pending).toEqual({ 7: panelId });
  });

  it('marks the panel failed, and waits for nothing, when the failure came in before the answer', () => {
    useQueue.setState({ items: [item(8, 'failed')] });
    bindComicItem(item(8, 'pending'), panelId);
    expect(useComic.getState().pending).toEqual({});
    expect(useComic.getState().drawFailed).toEqual({ [panelId]: true });
  });

  it('waits for nothing when the item was cancelled before the answer', () => {
    useQueue.setState({ items: [item(9, 'canceled')] });
    bindComicItem(item(9, 'pending'), panelId);
    expect(useComic.getState().pending).toEqual({});
    expect(useComic.getState().drawFailed).toEqual({});
  });
});

describe('the views of a character sheet the queue makes', () => {
  const sheetOf = () => useComic.getState().projects[0]!.cast[0]!.sheet;
  const seedCast = () => {
    useComic.getState().setCast([{ id: 'c', name: 'Mina', tags: '1girl', imageName: 'front.png' }]);
    return useComic.getState().projects[0]!.id;
  };

  it('puts the picture of a view into the sheet of its character, not into a panel', () => {
    const projectId = seedCast();
    bindSheetItem(item(7), { projectId, characterId: 'c', view: 'back' });
    expect(useComic.getState().sheetPending).toEqual({ 7: { projectId, characterId: 'c', view: 'back' } });
    onComicImage(item(7, 'completed'), image('back.png'));
    expect(sheetOf()).toEqual({ back: 'back.png' });
    expect(useComic.getState().sheetPending).toEqual({});
    expect(findPanel(useComic.getState().projects, panelId)!.panel.imageName).toBeNull();
  });

  it('forgets a view whose job failed or was cancelled, and one the engine refused at once', () => {
    const projectId = seedCast();
    bindSheetItem(item(8), { projectId, characterId: 'c', view: 'side' });
    bindSheetItem(item(9), { projectId, characterId: 'c', view: 'face' });
    onComicQueueItem(item(8, 'failed'));
    onComicQueueItem(item(9, 'canceled'));
    expect(useComic.getState().sheetPending).toEqual({});
    useQueue.setState({ items: [item(10, 'failed')] });
    bindSheetItem(item(10, 'pending'), { projectId, characterId: 'c', view: 'side' });
    expect(useComic.getState().sheetPending).toEqual({});
    expect(sheetOf()).toBeUndefined();
  });
});
