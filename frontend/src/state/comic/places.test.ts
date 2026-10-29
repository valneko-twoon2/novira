// The places of the open comic: changing one leaves the others alone, adding one names it by its number, removing one takes it out.
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { newProject } from './document';
import { addPlace, changePlace, removePlace } from './places';
import { useComic } from './store';

function seed(places: { id: string; name: string; tags: string }[] = []) {
  const project = { ...newProject('P'), places };
  useComic.setState({ projects: [project], activeProjectId: project.id, activePageId: null });
}

const places = () => useComic.getState().projects[0]!.places;

beforeEach(() => {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null });
});

describe('changing a place', () => {
  it('changes the one named and leaves the others as they are', () => {
    seed([
      { id: 'a', name: 'Street', tags: 'city' },
      { id: 'b', name: 'Hall', tags: '' },
    ]);
    changePlace('b', { name: 'Beach', tags: 'sea' });
    expect(places()).toEqual([
      { id: 'a', name: 'Street', tags: 'city' },
      { id: 'b', name: 'Beach', tags: 'sea' },
    ]);
  });
});

describe('adding a place', () => {
  it('adds an empty place named by its number and returns its id', () => {
    seed([{ id: 'a', name: 'Street', tags: '' }]);
    const id = addPlace();
    expect(places()).toHaveLength(2);
    expect(places()[1]).toEqual({ id, name: t('comic.place.newName', { number: 2 }), tags: '' });
  });
});

describe('removing a place', () => {
  it('takes the place out and keeps the others', () => {
    seed([
      { id: 'a', name: 'Street', tags: '' },
      { id: 'b', name: 'Hall', tags: '' },
    ]);
    removePlace('a');
    expect(places()).toEqual([{ id: 'b', name: 'Hall', tags: '' }]);
  });
});
