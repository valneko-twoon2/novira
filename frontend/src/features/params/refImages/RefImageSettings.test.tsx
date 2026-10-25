// @vitest-environment jsdom
// The settings of one reference image: enabling, the picture, the model hints, the weight and range, and the reset.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams, type RefImage } from '@/state/params';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { RefImageSettings } from './RefImageSettings';

const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), ui: useUi.getState(), canvas: useCanvas.getState() };
const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'] = 'sdxl'): ModelConfig =>
  ({ key, name: key, type, base, format: 'diffusers', description: '', path: '', size: 0, source: '' }) as ModelConfig;
const state = () => useParams.getState();
const current = () => state().refImages[0]!;
const num = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  fireEvent.change(num(label), { target: { value: String(value) } });
  fireEvent.blur(num(label));
};

function show(onImage = vi.fn()) {
  const ref = state().refImages[0] as RefImage;
  render(
    <TooltipProvider>
      <LiveSettings id={ref.id} onImage={onImage} />
    </TooltipProvider>,
  );
  return onImage;
}
function LiveSettings({ id, onImage }: { id: string; onImage: (i: { name: string; url: string } | undefined) => void }) {
  const ref = useParams((s) => s.refImages.find((r) => r.id === id));
  return ref ? <RefImageSettings refImage={ref} index={0} onImage={onImage} /> : <p>gone</p>;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState({ ...initial.params, modelKey: 'main1' }, true);
  useModels.setState({ ...initial.models, models: [model('main1', 'main'), model('ip1', 'ip_adapter')] }, true);
  useGallery.setState({ ...initial.gallery, images: [{ name: 'a.png', url: 'blob:a', thumbnailUrl: 't', width: 4, height: 4 } as never] }, true);
  useUi.setState(initial.ui, true);
  state().addRefImage({ modelKey: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RefImageSettings', () => {
  it('turns the image on and off, and deletes it', () => {
    show();
    const toggle = screen.getByRole('switch', { name: t('params.refImage.enabled') });
    fireEvent.click(toggle);
    expect(current().isEnabled).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByLabelText(t('params.refImage.delete')));
    expect(state().refImages).toHaveLength(0);
  });

  it('edits the weight and the range, keeping the start before the end, and resets them', () => {
    show();
    setNum(t('params.refImage.weight'), 1.5);
    setNum(t('params.refImage.begin'), 0.3);
    setNum(t('params.refImage.end'), 0.8);
    expect(current()).toMatchObject({ weight: 1.5, beginEnd: [0.3, 0.8] });
    setNum(t('params.refImage.begin'), 0.95);
    expect(current().beginEnd).toEqual([0.8, 0.8]);
    setNum(t('params.refImage.end'), 0.1);
    expect(current().beginEnd[1]).toBe(0.8);
    fireEvent.click(screen.getByText(t('params.refImage.resetSettings')));
    expect(current()).toMatchObject({ weight: 1, beginEnd: [0, 1], method: 'full' });
  });

  it('shows the picture, can clear it, and opens it as the start of an image-to-image canvas', () => {
    useParams.getState().updateRefImage(current().id, { imageName: 'a.png', imageUrl: 'blob:a' });
    const importImage = vi.fn();
    useCanvas.setState({ importImage });
    show();
    expect(document.querySelector('.pp-refpop__image img')!.getAttribute('src')).toBe('blob:a');
    fireEvent.click(screen.getByTestId('ref-to-canvas'));
    expect(importImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }), 'newCanvasRaster');
    fireEvent.click(screen.getByLabelText(t('params.refImage.clearImage')));
    expect(current()).toMatchObject({ imageName: null, imageUrl: null });
    useCanvas.setState({ importImage: initial.canvas.importImage });
  });

  it('hands a dropped gallery picture or an uploaded file to the caller', async () => {
    const onImage = show();
    const zone = document.querySelector('.pp-refpop__image')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['a.png']) } });
    await waitFor(() => expect(onImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' })));
    const uploaded = { name: 'up.png', url: 'blob:up' };
    vi.spyOn(backend, 'uploadImage').mockResolvedValue(uploaded as never);
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'x.png', { type: 'image/png' })], getData: () => '' } });
    await waitFor(() => expect(onImage).toHaveBeenCalledWith(uploaded));
  });

  it('tells where to get an IP-Adapter model when there is none, and opens the Models tab', () => {
    useModels.setState({ models: [model('main1', 'main')] });
    show();
    expect(screen.getByTestId('ref-no-models')).toBeTruthy();
    fireEvent.click(screen.getByText(t('params.refImage.installModels')));
    expect(useUi.getState().activeTab).toBe('models');
  });

  it('has no hint when models exist, and leaves out the CLIP vision and method choices for FLUX', () => {
    show();
    expect(screen.queryByTestId('ref-no-models')).toBeNull();
    expect(screen.getByLabelText(t('params.refImage.clipVision'))).toBeTruthy();
    expect(screen.getByLabelText(t('params.refImage.methodLabel'))).toBeTruthy();
    act(() => useModels.setState({ models: [model('main1', 'main', 'flux'), model('ip1', 'ip_adapter', 'flux')] }));
    expect(screen.queryByLabelText(t('params.refImage.clipVision'))).toBeNull();
    expect(screen.queryByLabelText(t('params.refImage.methodLabel'))).toBeNull();
  });
});
