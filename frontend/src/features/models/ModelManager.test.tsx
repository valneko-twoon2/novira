// @vitest-environment jsdom
// The model manager tab as a whole: rail, toolbar, card grid, selection, favourites, deletion, import, empty states, default settings.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { ImportDialog } from './ImportDialog';
import { ModelManager } from './ModelManager';

const model = (key: string, name: string, over: Partial<ModelConfig> = {}): ModelConfig => ({
  key,
  name,
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: `${name} description`,
  path: `models/${key}.safetensors`,
  size: 1024 ** 3,
  source: 'local',
  ...over,
});

const MODELS = [
  model('m1', 'Sunny XL', { size: 3 * 1024 ** 3 }),
  model('m2', 'Moon Light', { base: 'sd-1', size: 2 * 1024 ** 3 }),
  model('l1', 'Cat Style', { type: 'lora', size: 100 * 1024 ** 2 }),
  model('v1', 'Good VAE', { type: 'vae' }),
];

const initial = { models: useModels.getState(), toasts: useToasts.getState(), ui: useUi.getState() };
let canvases: ReturnType<typeof installRecordingCanvases>;

const show = () =>
  render(
    <TooltipProvider>
      <ModelManager />
      <ImportDialog />
    </TooltipProvider>,
  );
/** The button over a card, which selects it (a native button: Enter and Space press it in the browser). */
const selectButton = (card: HTMLElement) => card.querySelector('.mm-card-item__select') as HTMLElement;
const items = () => screen.queryAllByTestId('mm-item').map((el) => el.getAttribute('aria-label'));
const choose = (label: string, option: string) => {
  fireEvent.keyDown(screen.getAllByLabelText(label).find((el) => el.getAttribute('role') === 'combobox')!, { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};
const emptyBox = () => within(screen.getByText(t('models.empty.title')).closest('.mm-grid-empty') as HTMLElement);

beforeEach(() => {
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['x']));
  };
  URL.createObjectURL = () => 'blob:cover';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useModels.setState({ ...initial.models, models: MODELS, selectedKey: null, favorites: [] }, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ModelManager list', () => {
  it('lists every model by name and counts them in the rail', () => {
    show();
    expect(items()).toEqual(['Cat Style', 'Good VAE', 'Moon Light', 'Sunny XL']);
    expect(screen.getByTestId('mm-cat-all').textContent).toContain('4');
    expect(screen.getByTestId('mm-cat-lora').textContent).toContain('1');
  });

  it('narrows by category, search text and base, and says when nothing matches', () => {
    show();
    fireEvent.click(screen.getByTestId('mm-cat-lora'));
    expect(items()).toEqual(['Cat Style']);
    fireEvent.click(screen.getByTestId('mm-cat-all'));
    fireEvent.change(screen.getByTestId('mm-search'), { target: { value: 'moon' } });
    expect(items()).toEqual(['Moon Light']);
    fireEvent.change(screen.getByTestId('mm-search'), { target: { value: 'no such model' } });
    expect(screen.getByText(t('models.noMatch'))).toBeTruthy();
    fireEvent.change(screen.getByTestId('mm-search'), { target: { value: '' } });
    choose(t('models.filter.base'), 'SD1.X');
    expect(items()).toEqual(['Moon Light']);
  });

  it('sorts by size and by type', () => {
    show();
    choose(t('models.sort.label'), t('models.sort.size'));
    expect(items()[0]).toBe('Sunny XL');
    choose(t('models.sort.label'), t('models.sort.type'));
    expect(items()[0]).toBe('Cat Style');
  });

  it('switches to the list view and back, and sizes the thumbnails', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: t('models.view.list') }));
    expect(screen.getByTestId('mm-grid').className).toContain('mm-grid--list');
    fireEvent.click(screen.getByRole('button', { name: t('models.view.grid') }));
    expect(screen.getByTestId('mm-grid').className).toContain('mm-grid--grid');
    expect(screen.getByTestId('mm-grid').getAttribute('style')).toContain('--mm-thumb: 180px');
    fireEvent.keyDown(screen.getByRole('slider', { name: t('models.thumbSize') }), { key: 'ArrowRight' });
    expect(screen.getByTestId('mm-grid').getAttribute('style')).toContain('--mm-thumb: 190px');
  });

  it('shows the favourites only, after a model is starred, and removes the star again', () => {
    show();
    fireEvent.click(within(screen.getAllByTestId('mm-item')[3]!).getByRole('button', { name: t('models.card.favorite') }));
    expect(useModels.getState().favorites).toEqual(['m1']);
    fireEvent.click(screen.getByTestId('mm-cat-favorites'));
    expect(items()).toEqual(['Sunny XL']);
    fireEvent.click(within(screen.getByTestId('mm-item')).getByRole('button', { name: t('models.card.unfavorite') }));
    expect(items()).toEqual([]);
  });
});

describe('ModelManager selection and deletion', () => {
  it('opens the detail panel when a card is pressed and closes it by pressing the same card again', () => {
    show();
    fireEvent.click(selectButton(screen.getAllByTestId('mm-item')[3]!));
    expect(useModels.getState().selectedKey).toBe('m1');
    expect(screen.getByTestId('mm-default-settings')).toBeTruthy();
    fireEvent.click(selectButton(screen.getAllByTestId('mm-item')[3]!));
    expect(useModels.getState().selectedKey).toBeNull();
    fireEvent.click(selectButton(screen.getAllByTestId('mm-item')[2]!));
    expect(useModels.getState().selectedKey).toBe('m2');
    expect(screen.getAllByTestId('mm-item')[2]!.querySelector('.mm-card-item__select')?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(selectButton(screen.getAllByTestId('mm-item')[2]!));
    expect(useModels.getState().selectedKey).toBeNull();
  });

  it('deletes a model from the card menu after confirmation', async () => {
    const del = vi.spyOn(backend, 'deleteModel').mockResolvedValue(undefined);
    show();
    fireEvent.keyDown(within(screen.getAllByTestId('mm-item')[0]!).getByRole('button', { name: t('models.card.menu') }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('common.delete') }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button', { name: t('common.delete') })[0]!);
    await waitFor(() => expect(del).toHaveBeenCalled());
  });

  it('opens a model from the card menu', async () => {
    show();
    fireEvent.keyDown(within(screen.getAllByTestId('mm-item')[2]!).getByRole('button', { name: t('models.card.menu') }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('models.card.open') }));
    expect(useModels.getState().selectedKey).toBe('m2');
  });
});

describe('ModelManager empty and import', () => {
  it('invites to find or import models when none are installed', async () => {
    useModels.setState({ models: [] });
    show();
    expect(screen.getByText(t('models.empty.title'))).toBeTruthy();
    fireEvent.click(emptyBox().getByRole('button', { name: t('models.import') }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('common.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(emptyBox().getByRole('button', { name: t('models.find') }));
    expect(useUi.getState().activeTab).toBe('browse');
  });

  it('opens the import dialog from the toolbar and goes to the online search with Find', async () => {
    show();
    fireEvent.click(screen.getByTestId('mm-import'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('common.close') }));
    fireEvent.click(screen.getByTestId('mm-find'));
    expect(useUi.getState().activeTab).toBe('browse');
  });
});

describe('default settings editing', () => {
  it('saves the edited values of every switched-on setting', async () => {
    const update = vi.spyOn(backend, 'updateModel').mockImplementation(async (_key, patch) => ({ ...MODELS[0]!, ...patch }) as ModelConfig);
    useModels.setState({
      models: [
        model('m1', 'Sunny XL', { defaultSettings: { vae: null, vaePrecision: 'fp16', scheduler: 'euler', steps: 20, cfgScale: 7, width: 1024, height: 1024 } }),
        model('vae1', 'Fine VAE', { type: 'vae' }),
      ],
    });
    show();
    fireEvent.click(selectButton(screen.getAllByTestId('mm-item').find((el) => el.getAttribute('aria-label') === 'Sunny XL')!));
    const box = within(screen.getByTestId('mm-default-settings'));
    choose(t('models.defaults.vae'), 'Fine VAE');
    choose(t('models.defaults.vaePrecision'), 'FP32');
    choose(t('models.defaults.scheduler'), 'DPM++ 2M');
    const setNum = (label: string, value: number) => {
      const input = box.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: String(value) } });
      fireEvent.blur(input);
    };
    setNum(t('models.defaults.steps'), 35);
    setNum(t('models.defaults.cfgScale'), 4.5);
    setNum(t('common.width'), 768);
    setNum(t('common.height'), 832);
    fireEvent.click(box.getByText(t('common.save')));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![1]).toEqual({
      defaultSettings: { vae: 'vae1', vaePrecision: 'fp32', scheduler: 'dpmpp_2m', steps: 35, cfgScale: 4.5, width: 768, height: 832 },
    });
  });
});
