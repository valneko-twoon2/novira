// The comic's places changed one at a time from the screens (the design and the panel tools). Each change reads the open
// comic's places as they are at that moment, so two quick edits never undo each other.
import { t } from '@/i18n';
import { newComicId, type ComicPlace } from './document';
import { activeProject, useComic } from './store';

const current = (): ComicPlace[] => activeProject(useComic.getState())?.places ?? [];

/** Changes one place of the open comic. */
export function changePlace(id: string, patch: Partial<ComicPlace>): void {
  useComic.getState().setPlaces(current().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/** Adds a place to the open comic, named by its number, and returns its id. */
export function addPlace(): string {
  const places = current();
  const id = newComicId('place');
  useComic.getState().setPlaces([...places, { id, name: t('comic.place.newName', { number: places.length + 1 }), tags: '' }]);
  return id;
}

/** Takes a place out of the open comic; the panels set there lose their place. */
export function removePlace(id: string): void {
  useComic.getState().setPlaces(current().filter((p) => p.id !== id));
}
