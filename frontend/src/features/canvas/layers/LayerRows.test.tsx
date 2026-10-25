// @vitest-environment jsdom
// The layers list rows of the canvas tab: renaming, hiding, locking and deleting a layer, the settings of each layer
// type, and the global reference images.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas, type CanvasEntity } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { EntityRow } from './EntityRow';
import { LayersHostContext } from './layersHost';
import { RefImagesGroup } from './RefImagesGroup';

vi.mock('../actions', () => ({ processFilter: vi.fn(), applyFilterPreview: vi.fn() }));
import { applyFilterPreview, processFilter } from '../actions';

const initial = { canvas: useCanvas.getState(), params: useParams.getState(), gallery: useGallery.getState() };
const state = () => useCanvas.getState();
let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
  useCanvas.setState(initial.canvas, true);
  useParams.setState(initial.params, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  vi.mocked(processFilter).mockClear();
  vi.mocked(applyFilterPreview).mockClear();
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The row follows the store, as the layers panel does. */
function LiveRow({ id }: { id: string }) {
  const e = useCanvas((s) => s.entities.find((x) => x.id === id));
  return e ? <EntityRow entity={e as CanvasEntity} /> : null;
}
/** Shows a layer; its settings are open when it is selected. */
const row = (id: string, open = true) => {
  state().select(open ? id : null);
  return render(
    <TooltipProvider>
      <LiveRow id={id} />
    </TooltipProvider>,
  );
};
const num = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  fireEvent.change(num(label), { target: { value: String(value) } });
  fireEvent.blur(num(label));
};
const entity = (id: string) => state().entities.find((e) => e.id === id)!;

describe('EntityRow', () => {
  it('selects on click or Enter, and shows the settings only while selected', () => {
    const id = state().addEntity('raster');
    const { container } = row(id, false);
    expect(screen.queryByText(t('canvas.entity.opacity'))).toBeNull();
    const button = container.querySelector('.canvas-entity__row') as HTMLElement;
    fireEvent.click(button);
    expect(state().selectedEntityId).toBe(id);
    act(() => state().select(null));
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(state().selectedEntityId).toBe(id);
    cleanup();
    row(id);
    expect(screen.getByText(t('canvas.entity.opacity'))).toBeTruthy();
  });

  it('locks, hides and deletes without selecting the row', () => {
    const id = state().addEntity('raster');
    row(id, false);
    fireEvent.click(screen.getByLabelText(t('canvas.entity.lock')));
    expect(entity(id).isLocked).toBe(true);
    fireEvent.click(screen.getByLabelText(t('canvas.entity.hide')));
    expect(entity(id).isEnabled).toBe(false);
    expect(state().selectedEntityId).toBeNull();
    fireEvent.click(screen.getByLabelText(t('common.delete')));
    expect(state().entities).toHaveLength(0);
  });

  it('renames on double click; Enter or blur keeps it, an empty name goes back to the default, Escape cancels', () => {
    const id = state().addEntity('raster');
    row(id, false);
    const start = () => fireEvent.doubleClick(document.querySelector('.canvas-entity__name')!);
    start();
    let input = screen.getByLabelText(t('common.rename')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Sky  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(entity(id).name).toBe('Sky');
    start();
    input = screen.getByLabelText(t('common.rename')) as HTMLInputElement;
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'Ground' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(entity(id).name).toBe('Sky');
    start();
    input = screen.getByLabelText(t('common.rename')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(entity(id).name).toBeNull();
  });

  it('shows a slot under its own name without rename or delete, but with lock, visibility and opacity', () => {
    const id = state().addEntity('raster', { slot: 'panels', name: 'Frames' });
    row(id);
    fireEvent.doubleClick(document.querySelector('.canvas-entity__name')!);
    expect(screen.queryByLabelText(t('common.rename'))).toBeNull();
    expect(screen.getByText('Frames')).toBeTruthy();
    expect(screen.queryByLabelText(t('common.delete'))).toBeNull();
    fireEvent.click(screen.getByLabelText(t('canvas.entity.hide')));
    fireEvent.click(screen.getByLabelText(t('canvas.entity.lock')));
    setNum(t('canvas.entity.opacity'), 60);
    expect(entity(id)).toMatchObject({ isEnabled: false, isLocked: true, opacity: 0.6, objects: [] });
  });

  it('labels a slot row as the host says', () => {
    const id = state().addEntity('raster', { slot: 'panels' });
    state().select(null);
    render(
      <TooltipProvider>
        <LayersHostContext.Provider value={{ slotLabels: { panels: 'Panels' } }}>
          <LiveRow id={id} />
        </LayersHostContext.Provider>
      </TooltipProvider>,
    );
    expect(screen.getByText('Panels')).toBeTruthy();
  });

  it('edits the opacity of a raster layer', () => {
    const id = state().addEntity('raster');
    row(id);
    setNum(t('canvas.entity.opacity'), 40);
    expect(entity(id).opacity).toBe(0.4);
  });

  it('sets the blend of a raster layer next to its opacity, normal by default; other layers have none', () => {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const id = state().addEntity('raster');
    row(id);
    const blend = screen.getByLabelText(t('canvas.entity.blend'));
    expect(blend.textContent).toBe(t('canvas.entity.blend.normal'));
    fireEvent.keyDown(blend, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: t('canvas.entity.blend.multiply') }));
    expect(entity(id)).toMatchObject({ blend: 'multiply' });
    state().undo();
    expect((entity(id) as { blend?: string }).blend).toBeUndefined();
    cleanup();
    row(state().addEntity('control'));
    expect(screen.queryByLabelText(t('canvas.entity.blend'))).toBeNull();
  });
});

describe('inpaint mask settings', () => {
  it('turns the denoise limit and noise level on and off, and changes the mask colour', () => {
    const id = state().addEntity('inpaint');
    row(id);
    const denoise = screen.getByRole('switch', { name: t('canvas.mask.denoiseLimit') });
    fireEvent.click(denoise);
    expect(entity(id)).toMatchObject({ denoiseLimit: 1 });
    setNum(t('canvas.mask.denoiseLimit'), 0.4);
    expect(entity(id)).toMatchObject({ denoiseLimit: 0.4 });
    fireEvent.click(screen.getByRole('switch', { name: t('canvas.mask.noiseLevel') }));
    expect((entity(id) as { noiseLevel: number | null }).noiseLevel).toBe(1);
    fireEvent.click(denoise);
    expect((entity(id) as { denoiseLimit: number | null }).denoiseLimit).toBeNull();
    fireEvent.change(screen.getByLabelText(t('canvas.mask.color')), { target: { value: '#00ff00' } });
    expect((entity(id) as { color: { g: number } }).color.g).toBe(255);
  });
});

describe('regional guidance settings', () => {
  it('adds, edits and removes the prompts', () => {
    const id = state().addEntity('regional');
    row(id);
    fireEvent.click(screen.getByText(t('canvas.regional.addPositive')));
    fireEvent.click(screen.getByText(t('canvas.regional.addNegative')));
    fireEvent.change(screen.getByLabelText(t('canvas.regional.positivePrompt')), { target: { value: 'a dog' } });
    fireEvent.change(screen.getByLabelText(t('canvas.regional.negativePrompt')), { target: { value: 'blur' } });
    expect(entity(id)).toMatchObject({ positivePrompt: 'a dog', negativePrompt: 'blur' });
    const removes = screen.getAllByLabelText(t('canvas.regional.removePrompt'));
    fireEvent.click(removes[0]!);
    fireEvent.click(removes[1]!);
    expect(entity(id)).toMatchObject({ positivePrompt: null, negativePrompt: null });
  });

  it('adds a reference picture, edits its weight and removes it, and turns the auto-negative on', () => {
    const id = state().addEntity('regional');
    row(id);
    fireEvent.click(screen.getByText(t('canvas.regional.addRefImage')));
    expect((entity(id) as { refImages: unknown[] }).refImages).toHaveLength(1);
    setNum(t('canvas.ref.weight'), 0.5);
    expect((entity(id) as { refImages: { weight: number }[] }).refImages[0]!.weight).toBe(0.5);
    fireEvent.click(screen.getByRole('switch', { name: t('canvas.regional.autoNegative') }));
    expect((entity(id) as { autoNegative: boolean }).autoNegative).toBe(true);
    fireEvent.click(screen.getByLabelText(t('canvas.regional.removeRefImage')));
    expect((entity(id) as { refImages: unknown[] }).refImages).toHaveLength(0);
  });
});

describe('control layer settings', () => {
  it('edits the weight and the start and end of the effect, and the transparency effect', () => {
    const id = state().addEntity('control');
    row(id);
    setNum(t('canvas.control.weight'), 1.2);
    setNum(t('canvas.control.begin'), 0.2);
    setNum(t('canvas.control.end'), 0.9);
    expect(entity(id)).toMatchObject({ weight: 1.2, beginEnd: [0.2, 0.9] });
    setNum(t('canvas.control.begin'), 0.95);
    expect((entity(id) as { beginEnd: number[] }).beginEnd).toEqual([0.9, 0.9]);
    setNum(t('canvas.control.end'), 0.1);
    expect((entity(id) as { beginEnd: number[] }).beginEnd[1]).toBe(0.9);
    fireEvent.click(screen.getByRole('switch', { name: t('canvas.control.transparencyEffect') }));
    expect((entity(id) as { withTransparencyEffect: boolean }).withTransparencyEffect).toBe(false);
  });

  it('processes, applies and cancels a filter preview', () => {
    const id = state().addEntity('control');
    state().updateEntity(id, { filter: 'canny' });
    row(id);
    const apply = screen.getByText(t('common.apply')).closest('button') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(screen.getByText(t('canvas.control.process')));
    expect(processFilter).toHaveBeenCalledWith(id, useCanvas);
    act(() => state().setFilterPreview(id, { url: 'blob:p', x: 0, y: 0, width: 4, height: 4 }));
    fireEvent.click(apply);
    expect(applyFilterPreview).toHaveBeenCalledWith(id, useCanvas);
    fireEvent.click(screen.getByText(t('common.cancel')));
    expect(state().filterPreviews[id]).toBeUndefined();
  });

  it('processes automatically when asked, and clears the preview for no filter', () => {
    const id = state().addEntity('control');
    state().updateEntity(id, { filter: 'canny' });
    state().setSettings({ autoProcess: true });
    row(id);
    expect(processFilter).toHaveBeenCalledWith(id, useCanvas);
    act(() => state().setFilterPreview(id, { url: 'blob:p', x: 0, y: 0, width: 4, height: 4 }));
    act(() => state().updateEntity(id, { filter: 'none' }));
    expect(state().filterPreviews[id]).toBeUndefined();
  });
});

describe('RefImagesGroup', () => {
  const group = () =>
    render(
      <TooltipProvider>
        <RefImagesGroup />
      </TooltipProvider>,
    );

  it('shows nothing without reference images', () => {
    const { container } = group();
    expect(container.firstChild).toBeNull();
  });

  it('lists the reference images, selects, hides and deletes them, and adds another', () => {
    useParams.getState().addRefImage({ modelKey: null });
    useParams.getState().addRefImage({ modelKey: null, imageName: 'a.png', imageUrl: 'blob:a' });
    group();
    expect(screen.getByTestId('canvas-group-ref')).toBeTruthy();
    const rows = document.querySelectorAll('.canvas-entity__row');
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelector('img')!.getAttribute('src')).toBe('blob:a');
    fireEvent.click(rows[0]!);
    expect(state().selectedEntityId).toBe(useParams.getState().refImages[0]!.id);
    fireEvent.click(within(rows[1] as HTMLElement).getByLabelText(t('canvas.entity.hide')));
    expect(useParams.getState().refImages[1]!.isEnabled).toBe(false);
    fireEvent.click(screen.getByLabelText(t('canvas.add.globalRef')));
    expect(useParams.getState().refImages).toHaveLength(3);
    fireEvent.click(within(document.querySelectorAll('.canvas-entity__row')[2] as HTMLElement).getByLabelText(t('common.delete')));
    expect(useParams.getState().refImages).toHaveLength(2);
  });

  it('edits the weight and the range of the selected reference image', () => {
    useParams.getState().addRefImage({ modelKey: null });
    const id = useParams.getState().refImages[0]!.id;
    act(() => state().select(id));
    group();
    setNum(t('canvas.ref.weight'), 1.5);
    setNum(t('canvas.control.begin'), 0.3);
    setNum(t('canvas.control.end'), 0.8);
    expect(useParams.getState().refImages[0]).toMatchObject({ weight: 1.5, beginEnd: [0.3, 0.8] });
    setNum(t('canvas.control.begin'), 0.95);
    expect(useParams.getState().refImages[0]!.beginEnd).toEqual([0.8, 0.8]);
    setNum(t('canvas.control.end'), 0.1);
    expect(useParams.getState().refImages[0]!.beginEnd[1]).toBe(0.8);
  });

  it('fills the image slot from a drop, an upload, and clears it', async () => {
    useParams.getState().addRefImage({ modelKey: null });
    const ref = useParams.getState().refImages[0]!;
    act(() => state().select(ref.id));
    useGallery.setState({ images: [{ name: 'g.png', url: 'blob:g', thumbnailUrl: 't', width: 1, height: 1 } as never] });
    group();
    const zone = document.querySelector('.canvas-imgpick')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['g.png']) } });
    await waitFor(() => expect(useParams.getState().refImages[0]!.imageName).toBe('g.png'));
    fireEvent.click(screen.getByLabelText(t('canvas.ref.clearImage')));
    expect(useParams.getState().refImages[0]!.imageName).toBeNull();

    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'u.png', url: 'blob:u', thumbnailUrl: 't', width: 1, height: 1 } as never);
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const input = document.querySelector('.canvas-imgpick input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(useParams.getState().refImages[0]!.imageName).toBe('u.png'));
    expect(upload).toHaveBeenCalled();
    fireEvent.drop(document.querySelector('.canvas-imgpick')!, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
  });
});
