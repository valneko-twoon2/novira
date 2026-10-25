// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useCharacters } from '@/state/characters';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { runJob } from '@/state/comfy/runGraph';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { CharacterDialog } from './CharacterDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn() }));

const photo: ImageDTO = {
  name: 'photo.png',
  mediaType: 'image',
  url: 'blob:photo',
  thumbnailUrl: 'blob:photo',
  width: 200,
  height: 100,
  createdAt: 0,
  boardId: 'b1',
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
};

const mount = () =>
  render(
    <TooltipProvider>
      <CharacterDialog />
    </TooltipProvider>,
  );

const fill = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('register a character', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useCharacters.setState({ presets: [], selectedId: null });
    useCharacterDialog.setState({ target: null });
    vi.mocked(runJob).mockReset().mockResolvedValue({ ...photo, name: 'white.png', url: 'blob:white' });
  });
  afterEach(async () => {
    cleanup();
    useCharacterDialog.getState().close();
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
  });

  it('stays closed until a picture is chosen, and needs a name before it can save', async () => {
    mount();
    expect(screen.queryByTestId('character-dialog')).toBeNull();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'] });
    expect((await screen.findByTestId('character-save') as HTMLButtonElement).disabled).toBe(true);
    fill('character-name', 'Mia');
    expect((screen.getByTestId('character-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('puts the picture on a white background first and saves that picture', async () => {
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'] });
    await screen.findByTestId('character-dialog');
    fill('character-name', ' Mia ');
    fill('character-tags', ' brown hair, blue skirt ');
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacters.getState().presets).toHaveLength(1));
    const request = vi.mocked(runJob).mock.calls[0]![0];
    expect(request.boardId).toBe('b1');
    const cut = Object.values(request.comfyGraph!.prompt).find((n) => n.class_type === 'RMBG')!;
    expect(cut.inputs).toMatchObject({ background: 'Color', background_color: '#FFFFFF' });
    expect(useCharacters.getState().presets[0]).toMatchObject({ name: 'Mia', data: { imageNames: ['white.png'], tags: 'brown hair, blue skirt', weight: 0.6 } });
    expect(useCharacterDialog.getState().target).toBeNull();
  });

  it('saves the picture as it is when the background-removal pack is missing', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacters.getState().presets).toHaveLength(1));
    expect(runJob).not.toHaveBeenCalled();
    expect(useCharacters.getState().presets[0]!.data.imageNames).toEqual(['photo.png']);
  });

  it('keeps the dialog open and shows why when the background removal fails', async () => {
    vi.mocked(runJob).mockRejectedValueOnce(new Error('out of memory'));
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    fireEvent.click(screen.getByTestId('character-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('out of memory');
    expect(useCharacters.getState().presets).toEqual([]);
    expect(useCharacterDialog.getState().target).not.toBeNull();
  });

  it('edits a character in place without touching its picture', async () => {
    const id = useCharacters.getState().add('Old', { imageNames: ['photo.png'], weight: 0.4, tags: 'a' });
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Old', editId: id });
    await screen.findByTestId('character-dialog');
    expect((screen.getByTestId('character-tags') as HTMLTextAreaElement).value).toBe('a');
    fill('character-name', 'New');
    fill('character-tags', 'b');
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacters.getState().presets[0]!.name).toBe('New'));
    expect(runJob).not.toHaveBeenCalled();
    expect(useCharacters.getState().presets).toHaveLength(1);
    expect(useCharacters.getState().presets[0]).toMatchObject({ id, data: { imageNames: ['photo.png'], weight: 0.4, tags: 'b' } });
  });

  const second: ImageDTO = { ...photo, name: 'photo2.png', url: 'blob:photo2', thumbnailUrl: 'blob:photo2' };

  it('registers several pictures at once, each put on white, in the order they were given', async () => {
    useGallery.getState().setImages([photo, second]);
    vi.mocked(runJob)
      .mockReset()
      .mockResolvedValueOnce({ ...photo, name: 'white1.png' })
      .mockResolvedValueOnce({ ...photo, name: 'white2.png' });
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png', 'photo2.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    expect(screen.getAllByTestId('character-picture')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacters.getState().presets).toHaveLength(1));
    expect(runJob).toHaveBeenCalledTimes(2);
    expect(useCharacters.getState().presets[0]!.data.imageNames).toEqual(['white1.png', 'white2.png']);
  });

  it('adds the pictures selected in the gallery, removes them again, and needs at least one picture to save', async () => {
    useGallery.getState().setImages([photo, second]);
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    act(() => useGallery.setState({ selection: ['photo2.png'] }));
    fireEvent.click(screen.getByTestId('character-add-selected'));
    expect(screen.getAllByTestId('character-picture')).toHaveLength(2);
    // Adding again does nothing: the picture is already there.
    fireEvent.click(screen.getByTestId('character-add-selected'));
    expect(screen.getAllByTestId('character-picture')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('character-picture-remove')[0]!);
    fireEvent.click(screen.getByTestId('character-picture-remove'));
    expect(screen.queryAllByTestId('character-picture')).toHaveLength(0);
    expect((screen.getByTestId('character-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('puts only the pictures added while editing on white, and keeps the older ones as they are', async () => {
    useGallery.getState().setImages([photo, second]);
    const id = useCharacters.getState().add('Mia', { imageNames: ['photo.png'], weight: 0.6, tags: '' });
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia', editId: id });
    await screen.findByTestId('character-dialog');
    act(() => useGallery.setState({ selection: ['photo2.png'] }));
    fireEvent.click(screen.getByTestId('character-add-selected'));
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacters.getState().presets[0]!.data.imageNames).toHaveLength(2));
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(useCharacters.getState().presets[0]!.data.imageNames).toEqual(['photo.png', 'white.png']);
  });
});
