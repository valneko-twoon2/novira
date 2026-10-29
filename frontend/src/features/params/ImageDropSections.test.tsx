// @vitest-environment jsdom
// The parameter blocks that take a dropped picture: the global reference images row, the image to image section and the
// picture to upscale.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { RefImageList, addDefaultRefImage } from './refImages/RefImageList';
import { I2iSection } from './sections/I2iSection';
import { UpscaleInitialImage } from './upscale/UpscaleInitialImage';

const initial = { params: useParams.getState(), gallery: useGallery.getState() };
const picture = { name: 'pic.png', url: '/img/pic.png', thumbnailUrl: '/img/pic-t.png', width: 640, height: 960, createdAt: 1 } as unknown as ImageDTO;
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState(initial.params, true);
  useGallery.setState({ ...initial.gallery, images: [picture] }, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Drops gallery images, by name, on the first drop zone below the container. */
function dropNames(zone: Element, names: string[]) {
  const data: Record<string, string> = { [IMAGE_MIME]: JSON.stringify(names) };
  fireEvent.drop(zone, { dataTransfer: { types: [IMAGE_MIME], getData: (k: string) => data[k] ?? '', files: [] } });
}
/** Drops an OS file. */
function dropFile(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { types: ['Files'], getData: () => '', files: [file] } });
}
const png = () => new File(['x'], 'drop.png', { type: 'image/png' });

describe('RefImageList', () => {
  it('adds an empty reference image from the add button', () => {
    show(<RefImageList />);
    expect(useParams.getState().refImages).toHaveLength(0);
    fireEvent.click(screen.getByTestId('add-ref-image'));
    expect(useParams.getState().refImages).toHaveLength(1);
    expect(useParams.getState().refImages[0]!.imageName).toBeFalsy();
  });

  it('shows one card for each reference image', () => {
    addDefaultRefImage();
    addDefaultRefImage();
    const { container } = show(<RefImageList />);
    expect(container.querySelectorAll('.pp-refcard, [data-testid^="ref-image"]').length).toBeGreaterThan(0);
    expect(useParams.getState().refImages).toHaveLength(2);
  });

  it('adds a reference image holding a gallery picture dropped on the row', async () => {
    const { container } = show(<RefImageList />);
    dropNames(container.querySelector('.pp-refs')!, ['pic.png']);
    await waitFor(() => expect(useParams.getState().refImages).toHaveLength(1));
    expect(useParams.getState().refImages[0]).toMatchObject({ imageName: 'pic.png', imageUrl: '/img/pic.png' });
  });

  it('uploads a file dropped on the row, and adds it as a reference image', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture);
    const { container } = show(<RefImageList />);
    const file = png();
    dropFile(container.querySelector('.pp-refs')!, file);
    await waitFor(() => expect(useParams.getState().refImages).toHaveLength(1));
    expect(upload.mock.calls[0]![0]).toBe(file);
    expect(useParams.getState().refImages[0]).toMatchObject({ imageName: 'pic.png' });
  });

  it('adds nothing for a name the gallery does not know, or when the upload gives no picture', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(undefined as never);
    const { container } = show(<RefImageList />);
    dropNames(container.querySelector('.pp-refs')!, ['missing.png']);
    dropFile(container.querySelector('.pp-refs')!, png());
    await waitFor(() => expect(upload).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(useParams.getState().refImages).toHaveLength(0);
  });
});

describe('I2iSection', () => {
  const openSection = () => fireEvent.click(document.querySelector('.ui-section__toggle')!);

  it('is closed while empty, shows the drop hint once opened, and opens by itself when a picture is placed from elsewhere', () => {
    show(<I2iSection />);
    expect(screen.queryByText(t('params.i2i.dropHint'))).toBeNull();
    openSection();
    expect(screen.getByText(t('params.i2i.dropHint'))).toBeTruthy();
    openSection();
    expect(screen.queryByText(t('params.i2i.dropHint'))).toBeNull();
    act(() => useParams.getState().setInitImage(picture, 1024));
    expect(screen.getByTestId('i2i-image')).toBeTruthy();
  });

  it('takes a dropped gallery picture and shows its size and strength badge', async () => {
    const { container } = show(<I2iSection />);
    openSection();
    dropNames(container.querySelector('.pp-upimg')!, ['pic.png']);
    expect(await screen.findByTestId('i2i-image')).toBeTruthy();
    expect(useParams.getState().initImage).toMatchObject({ name: 'pic.png' });
    expect(screen.getByText('640×960')).toBeTruthy();
    expect(screen.getByText(useParams.getState().strength.toFixed(2))).toBeTruthy();
  });

  it('uploads a dropped file', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture);
    const { container } = show(<I2iSection />);
    openSection();
    dropFile(container.querySelector('.pp-upimg')!, png());
    await waitFor(() => expect(useParams.getState().initImage).toMatchObject({ name: 'pic.png' }));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('ignores a drop of an unknown picture, and clears the picture with its button', async () => {
    const { container } = show(<I2iSection />);
    openSection();
    dropNames(container.querySelector('.pp-upimg')!, ['missing.png']);
    await act(async () => {
      await Promise.resolve();
    });
    expect(useParams.getState().initImage).toBeFalsy();
    dropNames(container.querySelector('.pp-upimg')!, ['pic.png']);
    fireEvent.click(await screen.findByTestId('i2i-clear'));
    expect(useParams.getState().initImage).toBeFalsy();
    expect(screen.queryByTestId('i2i-image')).toBeNull();
  });

  it('sets the strength from the slider box', async () => {
    const { container } = show(<I2iSection />);
    openSection();
    dropNames(container.querySelector('.pp-upimg')!, ['pic.png']);
    await screen.findByTestId('i2i-image');
    const box = screen.getAllByLabelText(t('params.image.strength')).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
    fireEvent.change(box, { target: { value: '0.35' } });
    fireEvent.blur(box);
    expect(useParams.getState().strength).toBeCloseTo(0.35);
  });
});

describe('UpscaleInitialImage', () => {
  const image = () => useParams.getState().upscale.initialImage;

  it('shows the drop hint while there is no picture', () => {
    show(<UpscaleInitialImage />);
    expect(screen.getByText(t('params.upscale.dropHint'))).toBeTruthy();
    expect(screen.queryByTestId('upscale-initial-image')).toBeNull();
  });

  it('takes a dropped gallery picture, shows its size, and clears it', async () => {
    const { container } = show(<UpscaleInitialImage />);
    dropNames(container.querySelector('.pp-upimg')!, ['pic.png']);
    expect(await screen.findByTestId('upscale-initial-image')).toBeTruthy();
    expect(image()).toMatchObject({ name: 'pic.png' });
    expect(screen.getByText('640×960')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('params.upscale.clearImage') }));
    expect(image()).toBeNull();
    expect(screen.getByText(t('params.upscale.dropHint'))).toBeTruthy();
  });

  it('uploads a dropped file, and ignores an unknown name', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture);
    const { container } = show(<UpscaleInitialImage />);
    dropNames(container.querySelector('.pp-upimg')!, ['missing.png']);
    await act(async () => {
      await Promise.resolve();
    });
    expect(image()).toBeFalsy();
    dropFile(container.querySelector('.pp-upimg')!, png());
    await waitFor(() => expect(image()).toMatchObject({ name: 'pic.png' }));
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
