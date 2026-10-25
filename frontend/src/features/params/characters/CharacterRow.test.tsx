// @vitest-environment jsdom
// The character picker: use, edit and delete a saved character, and register the gallery selection as a new one.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { CHARACTER_CFG, useCharacters } from '@/state/characters';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { CharacterRow } from './CharacterRow';

const picture = (name: string, over: Partial<ImageDTO> = {}) =>
  ({ name, mediaType: 'image', url: `blob:${name}`, thumbnailUrl: `blob:${name}`, width: 8, height: 8, category: 'general', boardId: null, isIntermediate: false, ...over }) as unknown as ImageDTO;
const lastToast = () => useToasts.getState().toasts.at(-1);
const mount = () =>
  render(
    <TooltipProvider>
      <CharacterRow />
    </TooltipProvider>,
  );
const openList = () => fireEvent.click(screen.getByTestId('character-trigger'));
const openItemMenu = () => fireEvent.pointerDown(screen.getByTestId('character-item-menu'), { button: 0, ctrlKey: false, pointerType: 'mouse' });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCharacters.setState({ presets: [], selectedId: null });
  useCharacterDialog.setState({ target: null });
  useToasts.setState({ toasts: [] });
  useGallery.getState().setImages([picture('a.png'), picture('b.png'), picture('clip.mp4', { mediaType: 'video' })]);
  useGallery.setState({ selection: [] });
  useModels.getState().setModels([{ key: 'xl', name: 'xl', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' } as ModelConfig]);
  useParams.setState({ modelKey: 'xl', refImages: [], loras: [], cfgScale: 7, positivePrompt: '' });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('register a character', () => {
  it('says so when no picture is selected, and ignores videos in the selection', () => {
    mount();
    openList();
    fireEvent.click(screen.getByTestId('character-register'));
    expect(lastToast()).toMatchObject({ status: 'info', title: t('character.noSelection') });
    expect(useCharacterDialog.getState().target).toBeNull();
    useGallery.setState({ selection: ['clip.mp4'] });
    openList();
    fireEvent.click(screen.getByTestId('character-register'));
    expect(useCharacterDialog.getState().target).toBeNull();
    useGallery.setState({ selection: ['a.png', 'clip.mp4', 'b.png'] });
    openList();
    fireEvent.click(screen.getByTestId('character-register'));
    expect(useCharacterDialog.getState().target).toMatchObject({ imageNames: ['a.png', 'b.png'] });
  });
});

describe('use a character', () => {
  it('sets up the references and prompt, marks the character as current and tells what was done', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['a.png', 'b.png', 'gone.png'], weight: 0.6, tags: 'pink hair' });
    useCharacters.setState({ selectedId: null });
    mount();
    expect(screen.getByTestId('character-trigger').textContent).toContain(t('character.row.choose'));
    openList();
    fireEvent.click(screen.getByTitle(t('character.row.use')));
    expect(useParams.getState().refImages.map((r) => r.imageName)).toEqual(['a.png', 'b.png']);
    expect(useParams.getState().positivePrompt).toContain('pink hair');
    expect(useParams.getState().cfgScale).toBe(CHARACTER_CFG);
    expect(useCharacters.getState().selectedId).toBe(id);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('character.row.used', { name: 'Mia' }) });
    expect(lastToast()!.description).toContain(t('character.row.cfgLowered', { cfg: CHARACTER_CFG }));
    expect(lastToast()!.description).toContain(t('character.row.missingSome', { count: 1 }));
    expect(screen.getByTestId('character-trigger').textContent).toContain('Mia');
  });

  it('mentions a LoRA that was added, and one that is no longer installed', () => {
    useModels.getState().setModels([
      { key: 'xl', name: 'xl', base: 'sdxl', type: 'main' } as ModelConfig,
      { key: 'mia-lora', name: 'Mia', base: 'sdxl', type: 'lora' } as ModelConfig,
    ]);
    useCharacters.getState().add('Mia', { imageNames: ['a.png'], weight: 0.6, tags: '', lora: { key: 'mia-lora', weight: 0.8, trigger: 'mia', enabled: true } });
    useCharacters.getState().add('Old', { imageNames: ['b.png'], weight: 0.6, tags: '', lora: { key: 'removed', weight: 0.8, trigger: 'old', enabled: true } });
    mount();
    openList();
    const [mia, old] = screen.getAllByTitle(t('character.row.use'));
    fireEvent.click(mia!);
    expect(lastToast()!.description).toContain(t('lora.usedNote'));
    openList();
    fireEvent.click(screen.getAllByTitle(t('character.row.use'))[1]!);
    expect(lastToast()!.description).toContain(t('lora.goneNote'));
    expect(old).toBeTruthy();
  });

  it('shows an error and no success when none of its pictures is left', () => {
    useCharacters.getState().add('Ghost', { imageNames: ['gone.png'], weight: 0.6, tags: '' });
    useCharacters.setState({ selectedId: null });
    mount();
    openList();
    fireEvent.click(screen.getByTitle(t('character.row.use')));
    expect(lastToast()).toMatchObject({ status: 'error', title: t('character.missingImage', { name: 'Ghost' }) });
    expect(useCharacters.getState().selectedId).toBeNull();
  });
});

describe('the actions of one character', () => {
  const add = (lora = false) =>
    useCharacters.getState().add('Mia', { imageNames: ['a.png'], weight: 0.6, tags: 'x', ...(lora ? { lora: { key: 'l', weight: 0.8, trigger: 'mia', enabled: true } } : {}) });

  it('opens the edit dialog with the character', async () => {
    const id = add();
    mount();
    openList();
    openItemMenu();
    fireEvent.click(await screen.findByText(t('character.row.edit')));
    expect(useCharacterDialog.getState().target).toMatchObject({ imageNames: ['a.png'], name: 'Mia', editId: id });
  });

  it('deletes the character only on the second press', async () => {
    add();
    mount();
    openList();
    openItemMenu();
    fireEvent.click(await screen.findByText(t('presets.delete')));
    expect(useCharacters.getState().presets).toHaveLength(1);
    fireEvent.click(await screen.findByText(t('common.deleteAgain')));
    expect(useCharacters.getState().presets).toHaveLength(0);
  });

  it('lists characters by name and look words when searching', () => {
    useCharacters.getState().add('Mia', { imageNames: ['a.png'], weight: 0.6, tags: 'pink hair' });
    useCharacters.getState().add('Rin', { imageNames: ['b.png'], weight: 0.6, tags: 'blue eyes' });
    mount();
    openList();
    fireEvent.change(screen.getByLabelText(t('character.row.search')), { target: { value: 'blue' } });
    const items = screen.getAllByTestId('character-item');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText('Rin')).toBeTruthy();
  });
});
