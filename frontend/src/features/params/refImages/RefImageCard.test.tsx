// @vitest-environment jsdom
// A reference image thumbnail: its picture or a placeholder, warnings for a missing picture or model, and what a drop does.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams, type RefImage } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { RefImageCard } from './RefImageCard';

const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState() };
const ip = { key: 'ip', name: 'ip', type: 'ip_adapter', base: 'sdxl' } as ModelConfig;

function show(over: Partial<RefImage> = {}) {
  const id = useParams.getState().addRefImage(over);
  const ref = useParams.getState().refImages.find((r) => r.id === id)!;
  render(
    <TooltipProvider>
      <RefImageCard refImage={ref} index={1} />
    </TooltipProvider>,
  );
  return id;
}
const current = (id: string) => useParams.getState().refImages.find((r) => r.id === id)!;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState({ ...initial.params, refImages: [] }, true);
  useModels.setState({ models: [ip] });
  useGallery.setState({ images: [{ name: 'a.png', url: '/novira-image/a.png' } as ImageDTO] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
});

describe('a reference image card', () => {
  it('shows the picture and no warning when the picture and the model are there', { tags: ['condition'] }, () => {
    show({ imageName: 'a.png', imageUrl: '/novira-image/a.png', modelKey: 'ip' });
    expect(document.querySelector('.pp-ref__thumb img')?.getAttribute('src')).toBe('/novira-image/a.png');
    expect(document.querySelector('.pp-ref__warn')).toBeNull();
    expect(screen.getByTestId('ref-image').getAttribute('aria-label')).toBe(t('params.refImage.title', { index: 2 }));
  });

  it('shows the gallery thumbnail in the 48 px card, not the picture itself', { tags: ['condition'] }, () => {
    useGallery.setState({ images: [{ name: 'a.png', url: '/novira-image/a.png', thumbnailUrl: '/novira-image/thumb/a.png' } as ImageDTO] });
    show({ imageName: 'a.png', imageUrl: '/novira-image/a.png', modelKey: 'ip' });
    expect(document.querySelector('.pp-ref__thumb img')?.getAttribute('src')).toBe('/novira-image/thumb/a.png');
    cleanup();
    // A picture the gallery does not hold (a page-only address) is shown from its own address.
    show({ imageName: 'gone.png', imageUrl: 'blob:gone', modelKey: 'ip' });
    expect(document.querySelector('.pp-ref__thumb img')?.getAttribute('src')).toBe('blob:gone');
  });

  it('warns about a missing picture and a missing model, and greys out a disabled one', { tags: ['condition'] }, () => {
    show({ imageName: null, imageUrl: null, modelKey: 'gone', isEnabled: false });
    const warn = document.querySelector('.pp-ref__warn')!;
    expect(warn.getAttribute('aria-label')).toBe(`${t('params.refImage.warnNoImage')} ${t('params.refImage.warnNoModel')}`);
    expect(screen.getByTestId('ref-image').className).toContain('is-disabled');
    expect(screen.getByTestId('ref-image').className).toContain('has-warning');
  });

  it('takes a gallery picture dropped on it', { tags: ['scenario'] }, async () => {
    const id = show({ imageName: null, imageUrl: null, modelKey: 'ip' });
    const zone = document.querySelector('.pp-ref')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['a.png']) } });
    await waitFor(() => expect(current(id)).toMatchObject({ imageName: 'a.png', imageUrl: '/novira-image/a.png' }));
  });

  it('keeps the old picture for a name the gallery does not know, and uploads a dropped file', { tags: ['error-guessing'] }, async () => {
    const id = show({ imageName: 'old.png', imageUrl: 'old', modelKey: 'ip' });
    const zone = document.querySelector('.pp-ref')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['unknown.png']) } });
    await new Promise((r) => setTimeout(r, 20));
    expect(current(id).imageName).toBe('old.png');
    vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'up.png', url: 'blob:up' } as never);
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'x.png', { type: 'image/png' })], getData: () => '' } });
    await waitFor(() => expect(current(id).imageName).toBe('up.png'));
  });

  it('opens its settings from the thumbnail', { tags: ['scenario'] }, async () => {
    show({ imageName: 'a.png', imageUrl: '/novira-image/a.png', modelKey: 'ip' });
    fireEvent.click(screen.getByTestId('ref-image'));
    expect(await screen.findByLabelText(t('params.refImage.clearImage'))).toBeTruthy();
  });
});
