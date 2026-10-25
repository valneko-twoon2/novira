// @vitest-environment jsdom
// The model detail panel and the forms inside it: facts, editing, trigger phrases, default settings, conversion, deletion.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { TooltipProvider } from '@/ui';
import { ModelDetail } from './ModelDetail';

const model: ModelConfig = {
  key: 'm1',
  name: 'Sunny XL',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: 'A bright model',
  path: 'models/sunny.safetensors',
  size: 6 * 1024 ** 3,
  source: 'https://civitai.com/models/1',
  triggerPhrases: ['sunny'],
  defaultSettings: { steps: 20 },
};

const initial = { models: useModels.getState(), toasts: useToasts.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);
const show = (m: ModelConfig = model) =>
  render(
    <TooltipProvider>
      <ModelDetail model={m} />
    </TooltipProvider>,
  );
let update: ReturnType<typeof vi.spyOn>;

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  // The mock cover pictures are drawn on a canvas.
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['x']));
  };
  URL.createObjectURL = () => 'blob:cover';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useModels.setState({ ...initial.models, models: [model], selectedKey: 'm1' }, true);
  useToasts.setState(initial.toasts, true);
  update = vi.spyOn(backend, 'updateModel').mockImplementation(async (_key, patch) => ({ ...model, ...patch }) as ModelConfig);
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ModelDetail facts', () => {
  it('shows the name, the facts and the license state, and closes with the X button', () => {
    show();
    expect(screen.getByText('Sunny XL')).toBeTruthy();
    expect(screen.getByText('models/sunny.safetensors')).toBeTruthy();
    expect(screen.getByText(t('models.details.licenseUnknown'))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t('models.detail.close')));
    expect(useModels.getState().selectedKey).toBeNull();
  });

  it('shows no description line without one, and hides the main-model parts for other types', () => {
    show({ ...model, description: '', type: 'vae', triggerPhrases: undefined, source: 'local' });
    expect(document.querySelector('.mm-detail__desc')).toBeNull();
    expect(screen.queryByTestId('mm-default-settings')).toBeNull();
    expect(screen.queryByTestId('mm-trigger-phrases')).toBeNull();
    expect(screen.queryByText(t('models.detail.openSource'))).toBeNull();
  });

  it('opens the source page through the backend, or only says so in the browser mock', () => {
    const open = vi.spyOn(backend, 'openSourcePage').mockResolvedValue(undefined);
    show();
    fireEvent.click(screen.getByText(t('models.detail.openSource')));
    expect(lastToast()?.status).toBe('info');
    expect(open).not.toHaveBeenCalled();
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as never);
    fireEvent.click(screen.getByText(t('models.detail.openSource')));
    expect(open).toHaveBeenCalledWith(model.source);
  });

  it('reports a source page that cannot be opened', async () => {
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as never);
    vi.spyOn(backend, 'openSourcePage').mockRejectedValue(new Error('blocked'));
    show();
    fireEvent.click(screen.getByText(t('models.detail.openSource')));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'blocked' }));
  });

  it('copies the path', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    show();
    fireEvent.click(screen.getByLabelText(t('models.detail.copyPath')));
    expect(writeText).toHaveBeenCalledWith(model.path);
    await waitFor(() => expect(lastToast()?.status).toBe('success'));
    vi.unstubAllGlobals();
  });
});

describe('editing', () => {
  it('saves a new name and description, falling back to the old name when emptied', async () => {
    show();
    fireEvent.click(screen.getByTestId('mm-edit'));
    const form = within(screen.getByTestId('mm-edit-form'));
    fireEvent.change(form.getAllByRole('textbox')[0]!, { target: { value: '  Moonlit  ' } });
    fireEvent.change(form.getAllByRole('textbox')[1]!, { target: { value: 'Dark' } });
    fireEvent.click(screen.getByTestId('mm-edit-save'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('m1', expect.objectContaining({ name: 'Moonlit', description: 'Dark' })));
    await waitFor(() => expect(screen.queryByTestId('mm-edit-form')).toBeNull());
    expect(useModels.getState().models[0]!.name).toBe('Moonlit');

    fireEvent.click(screen.getByTestId('mm-edit'));
    fireEvent.change(within(screen.getByTestId('mm-edit-form')).getAllByRole('textbox')[0]!, { target: { value: ' ' } });
    fireEvent.click(screen.getByTestId('mm-edit-save'));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('m1', expect.objectContaining({ name: model.name })));
  });

  it('reports a failed save and leaves the form open; cancel closes it', async () => {
    update.mockRejectedValue(new Error('read only'));
    show();
    fireEvent.click(screen.getByTestId('mm-edit'));
    fireEvent.click(screen.getByTestId('mm-edit-save'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'read only' }));
    expect(screen.getByTestId('mm-edit-form')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('mm-edit-form')).getByText(t('common.cancel')));
    expect(screen.queryByTestId('mm-edit-form')).toBeNull();
  });
});

describe('trigger phrases', () => {
  it('adds a phrase, refuses a duplicate or empty one, and removes one', async () => {
    show();
    const box = within(screen.getByTestId('mm-trigger-phrases'));
    const input = box.getByLabelText(t('models.triggers.placeholder'));
    const add = box.getByText(t('common.add')).closest('button')!;
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'sunny' } });
    expect(box.getByText(t('models.triggers.duplicate'))).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: ' glow ' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(update).toHaveBeenCalledWith('m1', { triggerPhrases: ['sunny', 'glow'] }));
    fireEvent.click(box.getByLabelText(t('common.remove')));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('m1', { triggerPhrases: [] }));
    fireEvent.submit(input.closest('form')!);
  });

  it('reports a failure to save the phrases', async () => {
    update.mockRejectedValue('no space');
    show();
    fireEvent.click(within(screen.getByTestId('mm-trigger-phrases')).getByLabelText(t('common.remove')));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'no space' }));
  });

  it('says when a model has no phrases yet', () => {
    show({ ...model, triggerPhrases: [] });
    expect(screen.getByText(t('models.triggers.empty'))).toBeTruthy();
  });
});

describe('default settings', () => {
  it('saves only the switched-on settings', async () => {
    show();
    const box = within(screen.getByTestId('mm-default-settings'));
    // Steps was set on the model, so only it is on; turn the CFG scale on too, and the steps off again.
    fireEvent.click(box.getByRole('switch', { name: t('models.defaults.cfgScale') }));
    fireEvent.click(box.getByRole('switch', { name: t('models.defaults.vaePrecision') }));
    fireEvent.click(box.getByRole('switch', { name: t('models.defaults.scheduler') }));
    fireEvent.click(box.getByRole('switch', { name: t('models.defaults.vae') }));
    fireEvent.click(box.getByRole('switch', { name: t('common.width') }));
    fireEvent.click(box.getByRole('switch', { name: t('common.height') }));
    fireEvent.click(box.getByText(t('common.save')));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![1]).toEqual({
      defaultSettings: { vae: null, vaePrecision: 'fp32', scheduler: 'euler', steps: 20, cfgScale: 7, width: 1024, height: 1024 },
    });
    await waitFor(() => expect(lastToast()?.status).toBe('success'));
  });

  it('starts from 512 px for an SD 1 model, and reports a failed save', async () => {
    update.mockRejectedValue(new Error('nope'));
    show({ ...model, base: 'sd-1', defaultSettings: undefined });
    const box = within(screen.getByTestId('mm-default-settings'));
    fireEvent.click(box.getByRole('switch', { name: t('common.width') }));
    fireEvent.click(box.getByText(t('common.save')));
    await waitFor(() => expect(update.mock.calls[0]![1]).toEqual({ defaultSettings: { width: 512 } }));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'nope' }));
  });
});

describe('converting and deleting', () => {
  it('converts a checkpoint after confirmation, and offers nothing for other formats', async () => {
    show();
    fireEvent.click(screen.getAllByText(t('models.convert'))[0]!);
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByText(t('models.convert')));
    await waitFor(() => expect(update).toHaveBeenCalledWith('m1', { format: 'diffusers' }));
    await waitFor(() => expect(lastToast()?.status).toBe('success'));
    cleanup();
    show({ ...model, format: 'diffusers' });
    expect(screen.queryByText(t('models.convert'))).toBeNull();
  });

  it('reports a failed conversion', async () => {
    update.mockRejectedValue(new Error('too big'));
    show();
    fireEvent.click(screen.getAllByText(t('models.convert'))[0]!);
    fireEvent.click(within(screen.getByRole('dialog')).getByText(t('models.convert')));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'too big' }));
  });

  it('deletes the model after confirmation, or reports why it could not', async () => {
    const del = vi.spyOn(backend, 'deleteModel').mockResolvedValue(undefined);
    show();
    fireEvent.click(screen.getByText(t('common.delete')));
    fireEvent.click(screen.getByTestId('mm-delete-confirm'));
    await waitFor(() => expect(del).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(useModels.getState().models).toHaveLength(0));
    expect(lastToast()?.status).toBe('success');

    cleanup();
    del.mockRejectedValue(new Error('in use'));
    show();
    fireEvent.click(screen.getByText(t('common.delete')));
    fireEvent.click(screen.getByTestId('mm-delete-confirm'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'in use' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByText(t('common.cancel')));
  });
});
