// @vitest-environment jsdom
// The model detail drawer of the model browser: facts, version and files, and the ways to close it.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { DetailDrawer } from './DetailDrawer';

vi.mock('./covers', async (original) => ({ ...(await original<typeof import('./covers')>()), coverUrl: () => 'blob:cover' }));

const initial = { models: useModels.getState(), toasts: useToasts.getState() };
const file = (id: string) => ({ id, name: `${id}.safetensors`, sizeBytes: 2 * 1024 ** 3, format: 'SafeTensor', precision: 'fp16' });
const model = (over: Partial<CivitaiModel> = {}): CivitaiModel =>
  ({
    id: 'm1',
    name: 'Sunny XL',
    creator: 'someone',
    kind: 'Checkpoint',
    baseModel: 'SDXL 1.0',
    commercial: 'allowed',
    permissions: [],
    license: ['CreativeML Open RAIL++-M'],
    source: 'civitai',
    downloads: 12345,
    likes: 321,
    rating: 4.5,
    ratingCount: 20,
    imageCount: 3,
    tags: ['anime', 'style'],
    description: 'A bright model.',
    versions: [
      { id: 'v1', name: 'v1.0', baseModel: 'SDXL 1.0', createdAt: 0, triggerWords: ['sunny', 'bright'], files: [file('f1'), file('f2')] },
      { id: 'v2', name: 'v2.0', baseModel: 'SDXL 1.0', createdAt: 1, triggerWords: [], files: [file('f3')] },
    ],
    ...over,
  }) as CivitaiModel;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useModels.setState(initial.models, true);
  useToasts.setState(initial.toasts, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const show = (m = model(), onClose = vi.fn()) => {
  render(
    <TooltipProvider>
      <DetailDrawer model={m} onClose={onClose} />
    </TooltipProvider>,
  );
  return onClose;
};

describe('DetailDrawer', () => {
  it('shows the facts, the files of the first version, the trigger words, the tags and the description', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Sunny XL' })).toBeTruthy();
    expect(screen.getByText(t('browse.detail.by', { creator: 'someone' }))).toBeTruthy();
    expect(screen.getByText('f1.safetensors')).toBeTruthy();
    expect(screen.getByText('f2.safetensors')).toBeTruthy();
    expect(screen.getByText('sunny')).toBeTruthy();
    expect(screen.getByText('anime')).toBeTruthy();
    expect(screen.getByText('A bright model.')).toBeTruthy();
    expect(screen.getByText('CreativeML Open RAIL++-M')).toBeTruthy();
    expect(document.querySelectorAll('.browse-thumbs button')).toHaveLength(3);
  });

  it('hides the rating when nobody rated, and the trigger words when there are none', () => {
    show(model({ ratingCount: 0, versions: [{ id: 'v2', name: 'v2.0', baseModel: 'SDXL 1.0', createdAt: 1, triggerWords: [], files: [file('f3')] } as never] }));
    expect(document.querySelector('.browse-drawer__rating')).toBeNull();
    expect(screen.queryByText(t('browse.detail.triggerWords'))).toBeNull();
  });

  it('picks another picture from the thumbnails', () => {
    show();
    const thumbs = document.querySelectorAll('.browse-thumbs button');
    fireEvent.click(thumbs[2]!);
    expect(thumbs[2]!.className).toBe('is-on');
    expect(thumbs[0]!.className).toBe('');
  });

  it('closes with the button, with Escape and with a press outside, but not with a press inside or in a dialog', () => {
    const onClose = show();
    fireEvent.click(screen.getByLabelText(t('browse.detail.close')));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'a' });
    const press = (el: Element) => {
      const e = new Event('pointerdown', { bubbles: true });
      el.dispatchEvent(e);
    };
    press(screen.getByTestId('browse-drawer'));
    expect(onClose).toHaveBeenCalledTimes(2);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    press(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    press(document.body);
    expect(onClose).toHaveBeenCalledTimes(3);
    dialog.remove();
  });

  it('opens the model page, only reporting it in the browser mock', () => {
    show();
    fireEvent.click(screen.getByText(t('browse.detail.openCivitai')));
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('info');
    const open = vi.spyOn(backend, 'openCivitaiPage').mockResolvedValue(undefined);
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as never);
    fireEvent.click(screen.getByText(t('browse.detail.openCivitai')));
    expect(open).toHaveBeenCalledWith('m1');
  });
});
