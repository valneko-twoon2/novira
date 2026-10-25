// Gallery images, boards and their patches.
import type { BoardDTO, ImageDTO } from '../../types';
import type { BoardPatch, ImageOptions, ImagePatch } from './helpers';
import { generationMetadata } from './queue';

export const imageDto = {
  name: 'abc.png',
  mediaType: 'video',
  url: 'http://novira-image.localhost/full/abc.mp4',
  thumbnailUrl: 'http://novira-image.localhost/thumb/abc.png',
  width: 832,
  height: 1216,
  createdAt: 1700000002000,
  boardId: 'board-1',
  starred: true,
  isIntermediate: false,
  category: 'general',
  metadata: generationMetadata,
  workflow: { nodes: [{ id: 'n1' }], edges: [] },
} satisfies Required<ImageDTO>;

export const boardDto = {
  id: 'board-1',
  name: 'Favourites',
  archived: true,
  createdAt: 1700000000000,
} satisfies Required<BoardDTO>;

export const boardPatch = { name: 'Renamed', archived: false } satisfies Required<BoardPatch>;

export const imagePatch = { boardId: 'board-2', starred: true, isIntermediate: false } satisfies Required<ImagePatch>;

export const imageOptions = { boardId: 'board-1', isIntermediate: true, category: 'mask' } satisfies Required<ImageOptions>;
