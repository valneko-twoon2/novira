// @vitest-environment jsdom
// The picture viewer's toolbar: every button runs its command for the picture shown, and is off without one.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useCutout } from '@/state/dialogs/cutout';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { useMangaDialog } from '@/state/dialogs/manga';
import { useSegment } from '@/state/dialogs/segment';
import { useShareDialog } from '@/state/dialogs/share';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { ViewerToolbar } from './ViewerToolbar';

// Features do not import each other, not even in tests: the gallery commands are replaced by hoisted mocks.
const actions = vi.hoisted(() => ({
  addAsReference: vi.fn(),
  downloadImages: vi.fn(),
  canLoadImageWorkflow: vi.fn(() => true),
  canOpenInNewTab: vi.fn(() => true),
  loadImageWorkflow: vi.fn(),
  openInNewTab: vi.fn(),
  recall: vi.fn(),
  sendToCanvas: vi.fn(),
  sendToUpscale: vi.fn(),
  setStarred: vi.fn(),
}));
const requestDeleteImages = vi.hoisted(() => vi.fn());
vi.mock('@/features/gallery/actions', () => actions);
vi.mock('@/features/gallery/deleteRequest', () => ({ requestDeleteImages }));
vi.mock('@/state/derive', async (original) => ({ ...(await original<typeof import('@/state/derive')>()), deriveFrom: vi.fn() }));
import { deriveFrom } from '@/state/derive';

const initial = useGallery.getState();
const image = (over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name: 'a.png', url: 'u', thumbnailUrl: 't', width: 1, height: 1, mediaType: 'image', starred: false, metadata: { modelKey: 'm', generationMode: 'txt2img' }, ...over }) as ImageDTO;
const show = (img: ImageDTO | undefined) =>
  render(
    <TooltipProvider>
      <ViewerToolbar image={img} />
    </TooltipProvider>,
  );
const button = (label: string) => screen.getByLabelText(label) as HTMLButtonElement;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ ...initial, images: [image(), image({ name: 'b.png' })] }, true);
  vi.clearAllMocks();
  vi.mocked(actions.canOpenInNewTab).mockReturnValue(true);
  vi.mocked(actions.canLoadImageWorkflow).mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ViewerToolbar buttons', () => {
  it('toggles the metadata panel', () => {
    show(image());
    const before = useGallery.getState().showMetadata;
    fireEvent.click(screen.getByTestId('toggle-metadata'));
    expect(useGallery.getState().showMetadata).toBe(!before);
  });

  it('recalls the settings, loads the workflow, sends to the other tabs and downloads', () => {
    show(image());
    for (const [label, mode] of [
      ['gallery.menu.remix', 'remix'],
      ['gallery.menu.usePrompt', 'prompt'],
      ['gallery.menu.useSeed', 'seed'],
      ['gallery.menu.useAll', 'all'],
    ] as const) {
      fireEvent.click(button(t(label)));
      expect(actions.recall).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'a.png' }), mode);
    }
    fireEvent.click(button(t('gallery.menu.loadWorkflow')));
    expect(actions.loadImageWorkflow).toHaveBeenCalled();
    fireEvent.click(button(t('gallery.menu.useAsReference')));
    expect(actions.addAsReference).toHaveBeenCalled();
    fireEvent.click(button(t('gallery.menu.upscale')));
    expect(actions.sendToUpscale).toHaveBeenCalled();
    fireEvent.click(button(t('common.download')));
    expect(actions.downloadImages).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' })]);
    fireEvent.click(button(t('gallery.menu.openInNewTab')));
    expect(actions.openInNewTab).toHaveBeenCalled();
  });

  it('opens the editing dialogs', () => {
    show(image());
    fireEvent.click(screen.getByTestId('viewer-segment'));
    expect(useSegment.getState().imageName).toBe('a.png');
    fireEvent.click(screen.getByTestId('viewer-cutout'));
    expect(useCutout.getState().imageName).toBe('a.png');
    fireEvent.click(screen.getByTestId('viewer-facefix'));
    expect(useFaceFixDialog.getState().imageName).toBe('a.png');
    fireEvent.click(screen.getByTestId('viewer-manga'));
    expect(useMangaDialog.getState().imageName).toBe('a.png');
    fireEvent.click(screen.getByTestId('viewer-caption'));
    expect(useCaptionDialog.getState().imageName).toBe('a.png');
    fireEvent.click(screen.getByTestId('viewer-character'));
    expect(useCharacterDialog.getState().open).toBeTruthy();
    fireEvent.click(screen.getByTestId('viewer-share'));
    expect(useShareDialog.getState().names).toEqual(['a.png']);
  });

  it('stars, unstars and deletes', () => {
    const { unmount } = show(image());
    fireEvent.click(button(t('gallery.menu.star')));
    expect(actions.setStarred).toHaveBeenCalledWith(['a.png'], true);
    fireEvent.click(button(t('gallery.menu.delete')));
    expect(requestDeleteImages).toHaveBeenCalledWith(['a.png']);
    unmount();
    show(image({ starred: true }));
    fireEvent.click(button(t('gallery.menu.unstar')));
    expect(actions.setStarred).toHaveBeenLastCalledWith(['a.png'], false);
  });

  it('compares with the previously selected picture, and turns the comparison off again', () => {
    useGallery.setState({ selection: ['b.png', 'a.png'], viewerImageName: 'a.png' });
    show(image());
    fireEvent.click(button(t('gallery.compare.toggle')));
    expect(useGallery.getState().compareImageName).toBe('b.png');
    fireEvent.click(button(t('gallery.compare.toggle')));
    expect(useGallery.getState().compareImageName).toBeNull();
  });

  it('sends to the canvas through its menu, and offers the ways to derive new pictures', async () => {
    show(image());
    fireEvent.keyDown(button(t('gallery.menu.sendToCanvas')), { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu')).getByText(t('gallery.canvas.raster')));
    expect(actions.sendToCanvas).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }), 'raster');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.keyDown(screen.getByTestId('viewer-derive'), { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu')).getByText(t('gallery.derive.variation', { count: 4 })));
    expect(deriveFrom).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }), 'variation', 4);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.keyDown(screen.getByTestId('viewer-derive'), { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu')).getByText(t('gallery.derive.custom')));
    expect(useDeriveDialog.getState().imageName).toBe('a.png');
  });
});

describe('ViewerToolbar without a picture or settings', () => {
  it('turns everything off when there is no picture', () => {
    show(undefined);
    for (const label of [t('gallery.menu.remix'), t('gallery.menu.useAsReference'), t('common.download'), t('gallery.menu.delete'), t('gallery.menu.star')]) {
      expect(button(label).disabled).toBe(true);
    }
    fireEvent.click(screen.getByTestId('toggle-metadata'));
    expect(actions.recall).not.toHaveBeenCalled();
  });

  it('turns off recalling for a picture without settings, and picture tools for a video', () => {
    vi.mocked(actions.canOpenInNewTab).mockReturnValue(false);
    vi.mocked(actions.canLoadImageWorkflow).mockReturnValue(false);
    show(image({ metadata: null, mediaType: 'video' }));
    expect(button(t('gallery.menu.remix')).disabled).toBe(true);
    expect(button(t('gallery.menu.loadWorkflow')).disabled).toBe(true);
    expect((screen.getByTestId('viewer-segment') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('viewer-share') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText(t('gallery.menu.openInNewTab'))).toBeNull();
    expect(button(t('gallery.menu.useAsReference')).disabled).toBe(false);
  });
});
