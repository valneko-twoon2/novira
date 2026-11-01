// What a page does with the backend's word that another page changed the boards, the pictures or the models.
import { beforeEach, describe, expect, it } from 'vitest';
import type { BoardDTO, ImageDTO, ModelConfig } from '@/backend';
import { useGallery } from './gallery';
import { useModels } from './models';

const initialGallery = useGallery.getState();
const initialModels = useModels.getState();

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:${name}`,
  width: 64,
  height: 64,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
  ...over,
});

const board = (id: string): BoardDTO => ({ id, name: id, archived: false, createdAt: 0 });
const model = (key: string) => ({ key, name: key }) as ModelConfig;

beforeEach(() => {
  useGallery.setState(initialGallery, true);
  useModels.setState(initialModels, true);
});

describe('syncBoards', () => {
  it('takes a board another page made', () => {
    useGallery.getState().setBoards([board('a')]);
    useGallery.getState().syncBoards([board('a'), board('b')]);
    expect(useGallery.getState().boards.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('falls back to Uncategorized when the picked and the auto-add board are gone', () => {
    useGallery.setState({ boards: [board('a'), board('b')], selectedBoardId: 'a', autoAddBoardId: 'a' });
    useGallery.getState().syncBoards([board('b')]);
    const g = useGallery.getState();
    expect(g.selectedBoardId).toBe('none');
    expect(g.autoAddBoardId).toBe('none');
  });

  it('keeps the picked board while it is still there, and Uncategorized as it is', () => {
    useGallery.setState({ boards: [board('a')], selectedBoardId: 'a', autoAddBoardId: 'none' });
    useGallery.getState().syncBoards([board('a'), board('c')]);
    const g = useGallery.getState();
    expect(g.selectedBoardId).toBe('a');
    expect(g.autoAddBoardId).toBe('none');
  });
});

describe('applyImageChanges', () => {
  it('replaces a changed picture where it is', () => {
    useGallery.getState().setImages([image('a'), image('b')]);
    useGallery.getState().applyImageChanges([image('b', { starred: true, boardId: 'x' })], []);
    const images = useGallery.getState().images;
    expect(images.map((i) => i.name)).toEqual(['a', 'b']);
    expect(images[1]).toMatchObject({ starred: true, boardId: 'x' });
  });

  it('puts a picture that came back from the trash in front, once', () => {
    useGallery.getState().setImages([image('a')]);
    useGallery.getState().applyImageChanges([image('r')], []);
    useGallery.getState().applyImageChanges([image('r')], []);
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['r', 'a']);
  });

  it('takes out the removed pictures and what pointed at them', () => {
    useGallery.setState({ images: [image('a'), image('b')], selection: ['a', 'b'], viewerImageName: 'a', compareImageName: 'a' });
    useGallery.getState().applyImageChanges([], ['a', 'unknown']);
    const g = useGallery.getState();
    expect(g.images.map((i) => i.name)).toEqual(['b']);
    expect(g.selection).toEqual(['b']);
    expect(g.viewerImageName).toBeNull();
    expect(g.compareImageName).toBeNull();
  });

  it('changes nothing for an empty change', () => {
    const images = [image('a')];
    useGallery.getState().setImages(images);
    useGallery.getState().applyImageChanges([], []);
    expect(useGallery.getState().images).toBe(images);
  });
});

describe('syncModels', () => {
  it('takes the list and unpicks a model that is gone', () => {
    useModels.setState({ models: [model('a'), model('b')], selectedKey: 'b' });
    useModels.getState().syncModels([model('a')]);
    expect(useModels.getState().models.map((m) => m.key)).toEqual(['a']);
    expect(useModels.getState().selectedKey).toBeNull();
  });

  it('keeps the picked model while it is there, and no pick as none', () => {
    useModels.setState({ models: [model('a')], selectedKey: 'a' });
    useModels.getState().syncModels([model('a'), model('c')]);
    expect(useModels.getState().selectedKey).toBe('a');
    useModels.setState({ selectedKey: null });
    useModels.getState().syncModels([model('c')]);
    expect(useModels.getState().selectedKey).toBeNull();
  });
});
