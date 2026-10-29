// @vitest-environment jsdom
// Where the selected panel is set: the list of the comic's places, the button that adds one, and the chosen place's words.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { newProject, PLACES_MAX, type ComicPlace } from '@/state/comic/document';
import { findPanel, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { PanelPlace } from './PanelPlace';

let panelId = '';
const places = (): ComicPlace[] => useComic.getState().projects[0]!.places;
const placeOfPanel = () => findPanel(useComic.getState().projects, panelId)!.panel.place;

/** Shows the component for the open comic, the way the panel tools hand it its props. */
function Host() {
  const project = useComic((s) => s.projects[0]!);
  const panel = findPanel(project ? [project] : [], panelId)!.panel;
  return <PanelPlace panelId={panelId} placeId={panel.place ?? null} places={project.places} />;
}

function seed(list: ComicPlace[]) {
  const project = newProject('Places');
  project.places = list;
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.getState().setProjects([project]);
  render(
    <TooltipProvider>
      <Host />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  setLocale('en');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
});

describe('the place of a panel', () => {
  it('shows no fields while the panel is set nowhere', () => {
    seed([{ id: 'a', name: 'Cafe', tags: '' }]);
    expect(screen.queryByTestId('comic-place')).toBeNull();
    expect(screen.getByTestId('comic-panel-place-select').textContent).toContain(t('comic.place.none'));
  });

  it('sets the panel in a place picked from the list, and takes it out again with "none"', () => {
    seed([
      { id: 'a', name: 'Cafe', tags: 'table' },
      { id: 'b', name: '  ', tags: '' },
    ]);
    fireEvent.keyDown(screen.getByTestId('comic-panel-place-select'), { key: 'Enter' });
    // A place without a name is listed by the general name label.
    expect(screen.getByRole('option', { name: t('comic.place.name') })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Cafe' }));
    expect(placeOfPanel()).toBe('a');
    expect((screen.getByTestId('comic-place-name') as HTMLInputElement).value).toBe('Cafe');
    fireEvent.keyDown(screen.getByTestId('comic-panel-place-select'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: t('comic.place.none') }));
    expect(placeOfPanel()).toBeUndefined();
    expect(screen.queryByTestId('comic-place')).toBeNull();
  });

  it('adds a numbered place from its button and sets the panel there', () => {
    seed([{ id: 'a', name: 'Cafe', tags: '' }]);
    fireEvent.click(screen.getByTestId('comic-panel-place-add'));
    expect(places()).toHaveLength(2);
    expect(places()[1]!.name).toBe(t('comic.place.newName', { number: 2 }));
    expect(placeOfPanel()).toBe(places()[1]!.id);
    expect(screen.getByTestId('comic-place')).toBeTruthy();
  });

  it('turns the add button off at the most places', () => {
    seed(Array.from({ length: PLACES_MAX }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tags: '' })));
    expect((screen.getByTestId('comic-panel-place-add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('edits the chosen place for every panel, and removes it', () => {
    seed([{ id: 'a', name: 'Cafe', tags: '' }]);
    act(() => useComic.getState().setPanelPlace(panelId, 'a'));
    fireEvent.change(screen.getByTestId('comic-place-tags'), { target: { value: 'sunlight' } });
    expect(places()[0]!.tags).toBe('sunlight');
    fireEvent.click(screen.getByTestId('comic-place-remove'));
    expect(places()).toHaveLength(0);
    expect(screen.queryByTestId('comic-place')).toBeNull();
  });
});
