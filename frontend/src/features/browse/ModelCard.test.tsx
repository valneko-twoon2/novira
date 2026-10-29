// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { formatCount } from './format';
import { ModelCard } from './ModelCard';

const openOnCivitai = vi.hoisted(() => vi.fn());
vi.mock('./openCivitai', () => ({ openOnCivitai }));
vi.mock('./covers', async (original) => ({ ...(await original<typeof import('./covers')>()), coverUrl: () => 'blob:cover' }));

const initialModels = useModels.getState();
const file = { id: 'f1', name: 'a.safetensors', sizeBytes: 1, format: 'SafeTensor', precision: 'fp16' };
const model = (over: Partial<CivitaiModel> = {}): CivitaiModel =>
  ({
    id: 'm1',
    name: 'Sunny XL',
    creator: 'someone',
    kind: 'Checkpoint',
    baseModel: 'SDXL 1.0',
    commercial: 'allowed',
    permissions: [],
    license: [],
    source: 'civitai',
    downloads: 12345,
    likes: 321,
    imageCount: 4,
    imageUrls: [],
    triggerWords: [],
    versions: [{ id: 'v1', name: 'v1', baseModel: 'sdxl', createdAt: 0, triggerWords: [], files: [file] }],
    ...over,
  }) as CivitaiModel;
const ui = (m: CivitaiModel, onOpen = vi.fn()) => (
  <TooltipProvider>
    <ModelCard model={m} onOpen={onOpen} />
  </TooltipProvider>
);
const mount = (m: CivitaiModel, onOpen = vi.fn()) => {
  render(ui(m, onOpen));
  return onOpen;
};

beforeEach(() => {
  useModels.setState(initialModels, true);
  openOnCivitai.mockClear();
});
afterEach(() => cleanup());

describe('ModelCard', () => {
  it('shows the name, creator, kind and base, and the counts', () => {
    mount(model());
    expect(screen.getByText('Sunny XL')).toBeTruthy();
    expect(screen.getByText('someone')).toBeTruthy();
    expect(screen.getByText('Checkpoint · SDXL 1.0')).toBeTruthy();
    expect(screen.getByTitle(t('browse.stats.downloads')).textContent).toBe(' ' + formatCount(12345));
    expect(screen.getByTitle(t('browse.card.images', { count: 4 }))).toBeTruthy();
    expect(screen.queryByTestId('browse-paid-badge')).toBeNull();
  });

  it('opens on a press, and on Enter or Space on the card itself only', () => {
    const onOpen = mount(model());
    const card = screen.getByTestId('browse-card');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(card, { key: 'a' });
    expect(onOpen).toHaveBeenCalledTimes(3);
    // A key pressed on a button inside the card belongs to that button.
    fireEvent.keyDown(screen.getByText(t('browse.card.download')), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('shows at most three trigger words, and none when the model has none', () => {
    const { unmount } = render(ui(model({ triggerWords: ['a', 'b', 'c', 'd'] })));
    expect(screen.getAllByTitle(t('browse.detail.copyHint')).length).toBe(3);
    unmount();
    mount(model());
    expect(screen.queryAllByTitle(t('browse.detail.copyHint')).length).toBe(0);
  });

  it('marks a paid model with its badge and locks the download', () => {
    const m = model();
    m.versions[0]!.paid = true;
    mount(m);
    expect(screen.getByTestId('browse-paid-badge').textContent).toBe(t('browse.paid.badge'));
    expect(screen.getByTestId('browse-paid-locked')).toBeTruthy();
  });

  it('opens the model page without opening the card', () => {
    const m = model();
    const onOpen = mount(m);
    fireEvent.click(screen.getByLabelText(t('browse.card.openCivitai')));
    expect(openOnCivitai).toHaveBeenCalledWith(m);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
