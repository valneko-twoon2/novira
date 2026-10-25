// Saved comic projects: the backend keeps the document as it is, so the sample only shows one shape of it.
import type { ComicRecord } from '../../types';

export const comicRecord = {
  id: 'comic-1',
  updatedAt: 1700000000000,
  document: { title: 'Mine', pages: [{ panels: [] }] },
} satisfies Required<ComicRecord>;
