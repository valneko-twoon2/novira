// @vitest-environment jsdom
// The LoRA part of the character dialog (shown when editing): its switch and weight, and cancelling a save.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t } from '@/i18n';
import { useCharacters } from '@/state/characters';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { runJob } from '@/state/comfy/runGraph';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { CharacterDialog } from './CharacterDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn() }));

const photo = {
  name: 'photo.png',
  mediaType: 'image',
  url: 'blob:photo',
  thumbnailUrl: 'blob:photo',
  width: 200,
  height: 100,
  boardId: 'b1',
  category: 'general',
  isIntermediate: false,
} as unknown as ImageDTO;
const lora = { key: 'mia-lora', weight: 0.8, trigger: 'mia', enabled: true };

const mount = () =>
  render(
    <TooltipProvider>
      <CharacterDialog />
    </TooltipProvider>,
  );
const openEdit = async (withLora: boolean) => {
  const id = useCharacters.getState().add('Mia', { imageNames: ['photo.png'], weight: 0.6, tags: '', ...(withLora ? { lora } : {}) });
  mount();
  useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia', editId: id });
  await screen.findByTestId('character-dialog');
  return id;
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.getState().setImages([photo]);
  useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
  useModels.getState().setModels([{ key: 'mia-lora', name: 'Mia LoRA', base: 'sdxl', type: 'lora' } as ModelConfig]);
  useCharacters.setState({ presets: [], selectedId: null });
  useCharacterDialog.setState({ target: null });
  vi.mocked(runJob).mockReset();
});
afterEach(async () => {
  cleanup();
  useCharacterDialog.getState().close();
  vi.unstubAllGlobals();
  await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
});

describe('the LoRA of a character', () => {
  it('offers the LoRAs of the model list when the character has none, and sets the one chosen with its trigger phrase', async () => {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    useModels.getState().setModels([{ key: 'mia-lora', name: 'Mia LoRA', base: 'sdxl', type: 'lora', triggerPhrases: ['mia_chr', 'other'] } as ModelConfig]);
    const id = await openEdit(false);
    const select = screen.getByTestId('character-lora-select');
    expect(select.textContent).toBe(t('lora.noneOption'));
    expect(screen.queryByLabelText(t('lora.use'))).toBeNull();
    fireEvent.keyDown(select, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Mia LoRA' }));
    expect(screen.getByLabelText(t('lora.use'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacterDialog.getState().target).toBeNull());
    expect(useCharacters.getState().presets.find((p) => p.id === id)!.data.lora).toEqual({ key: 'mia-lora', weight: 0.8, trigger: 'mia_chr', enabled: true });
  });

  it('takes the LoRA off the character when "no LoRA" is chosen', async () => {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const id = await openEdit(true);
    fireEvent.keyDown(screen.getByTestId('character-lora-select'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: t('lora.noneOption') }));
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacterDialog.getState().target).toBeNull());
    expect(useCharacters.getState().presets.find((p) => p.id === id)!.data.lora).toBeUndefined();
  });

  it('is not shown when registering a new character', async () => {
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    expect(screen.queryByTestId('character-lora')).toBeNull();
  });

  it('shows the LoRA with its name, and keeps the switch and weight that were set when saving', async () => {
    const id = await openEdit(true);
    expect(screen.getByTestId('character-lora').textContent).toContain('Mia LoRA');
    fireEvent.change(screen.getAllByLabelText(t('lora.weight')).find((e) => (e as HTMLInputElement).type === 'number')!, { target: { value: '1.2' } });
    fireEvent.blur(screen.getAllByLabelText(t('lora.weight')).find((e) => (e as HTMLInputElement).type === 'number')!);
    fireEvent.click(screen.getByLabelText(t('lora.use')));
    fireEvent.click(screen.getByTestId('character-save'));
    await waitFor(() => expect(useCharacterDialog.getState().target).toBeNull());
    const saved = useCharacters.getState().presets.find((p) => p.id === id)!;
    expect(saved.data.lora).toMatchObject({ key: 'mia-lora', enabled: false, weight: 1.2, trigger: 'mia' });
  });

  it('says when the LoRA file is gone', async () => {
    useModels.getState().setModels([]);
    await openEdit(true);
    expect(screen.getByTestId('character-lora').textContent).toContain(t('lora.gone'));
  });

});

describe('cancelling a save', () => {
  it('stops the white-background pass without an error and keeps the dialog open', async () => {
    vi.mocked(runJob).mockImplementation(
      (_request, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    mount();
    useCharacterDialog.getState().open({ imageNames: ['photo.png'], name: 'Mia' });
    await screen.findByTestId('character-dialog');
    fireEvent.click(screen.getByTestId('character-save'));
    fireEvent.click(await screen.findByTestId('character-cancel'));
    await waitFor(() => expect(screen.queryByTestId('character-cancel')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useCharacters.getState().presets).toEqual([]);
    expect(useCharacterDialog.getState().target).not.toBeNull();
  });
});
