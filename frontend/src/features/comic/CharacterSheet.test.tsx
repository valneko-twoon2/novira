// @vitest-environment jsdom
// The sheet in the design tab: the front and the views with their pictures, a view taken out, a view being drawn, the button
// that draws the missing views, with a line once the panels use a LoRA.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { setLocale, t } from '@/i18n';
import { useCharacters } from '@/state/characters';
import { newProject, type ComicCharacter } from '@/state/comic/document';
import * as generate from '@/state/comic/generate';
import { activeProject, useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { CharacterSheet } from './CharacterSheet';

const initial = { characters: useCharacters.getState(), gallery: useGallery.getState(), models: useModels.getState() };
const picture = (name: string) => ({ name, url: `/img/${name}`, thumbnailUrl: `/thumb/${name}` }) as ImageDTO;
const MINA: ComicCharacter = { id: 'c', name: 'Mina', tags: '1girl', imageName: 'front.png', sheet: { back: 'back.png' } };

/** The sheet of the open comic's first character, read again from the store as it changes. */
function Sheet() {
  const project = useComic((s) => activeProject(s));
  const character = project?.cast[0];
  return project && character ? <CharacterSheet projectId={project.id} cast={project.cast} character={character} /> : null;
}

function show(character: ComicCharacter = MINA) {
  const project = newProject('Sheet');
  project.cast = [character];
  useComic.getState().setProjects([project]);
  render(
    <TooltipProvider>
      <Sheet />
    </TooltipProvider>,
  );
  return project.id;
}

const slot = (view: string) => screen.getByTestId(`comic-sheet-view-${view}`);
const button = (id: string) => screen.getByTestId(id) as HTMLButtonElement;

beforeEach(() => {
  setLocale('en');
  useGallery.setState({ images: ['front.png', 'back.png'].map(picture) });
  useComic.setState({ sheetPending: {} });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCharacters.setState(initial.characters, true);
  useGallery.setState(initial.gallery, true);
  useModels.setState(initial.models, true);
  setLocale('ja');
});

describe('CharacterSheet', () => {
  it('shows the front and each view it has, marks a view being drawn, and takes a view out', () => {
    const projectId = show();
    expect(slot('front').dataset.has).toBe('yes');
    expect(slot('back').querySelector('img')!.getAttribute('src')).toBe('/thumb/back.png');
    expect(slot('side').dataset.has).toBe('no');
    act(() => useComic.getState().setSheetPending(3, { projectId, characterId: 'c', view: 'side' }));
    expect(slot('side').textContent).toContain(t('comic.sheet.drawing'));
    fireEvent.click(screen.getByTestId('comic-sheet-remove-back'));
    expect(useComic.getState().projects[0]!.cast[0]).not.toHaveProperty('sheet');
    expect(slot('back').dataset.has).toBe('no');
  });

  it('draws the missing views, and cannot without words or with every view there or being drawn', () => {
    const make = vi.spyOn(generate, 'makeSheet').mockResolvedValue(3);
    const projectId = show();
    fireEvent.click(button('comic-sheet-make'));
    expect(make).toHaveBeenCalledWith('c');
    act(() => {
      for (const [i, view] of (['threeQuarter', 'side', 'face'] as const).entries()) useComic.getState().setSheetPending(i + 1, { projectId, characterId: 'c', view });
    });
    expect(button('comic-sheet-make').disabled).toBe(true);
    cleanup();
    useComic.setState({ sheetPending: {} });
    show({ ...MINA, tags: '' });
    expect(button('comic-sheet-make').disabled).toBe(true);
  });

  it('says which LoRA its panels use', () => {
    const id = useCharacters.getState().add('Mina', { imageNames: ['front.png'], weight: 0.6, tags: '1girl', lora: { key: 'mina-lora', weight: 0.8, trigger: 'mina', enabled: true } });
    useModels.setState({ models: [{ key: 'mina-lora', name: 'Mina LoRA', base: 'sdxl', type: 'lora' } as ModelConfig] });
    show({ ...MINA, libraryId: id });
    expect(screen.getByTestId('comic-sheet-lora-on').textContent).toBe(t('comic.sheet.loraOn', { name: 'Mina LoRA' }));
    cleanup();
    show({ ...MINA, imageName: null });
    expect(screen.queryByTestId('comic-sheet-lora-on')).toBeNull();
  });
});
