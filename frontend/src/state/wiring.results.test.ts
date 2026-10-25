// Where the gallery goes when a finished result arrives: pictures to the images view, assets (logos) to the assets view; a
// comic page's inpaint result to the page that asked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type BackendEvent, type ImageDTO, type Packs, type QueueItem } from '@/backend';
import { useCanvas } from './canvas';
import { newProject } from './comic/document';
import { pageCanvasStore, resetPageCanvases } from './comic/pageCanvas';
import { resetPageInpaints, trackPageInpaint } from './comic/pageInpaint';
import { activePage, useComic } from './comic/store';
import { useGallery } from './gallery';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

afterEach(() => vi.restoreAllMocks());

const image = (name: string, category: ImageDTO['category']): ImageDTO =>
  ({ name, category, boardId: null, mediaType: 'image', isIntermediate: false, createdAt: 1 }) as unknown as ImageDTO;

const item = { params: {}, origin: 'generate', destination: 'gallery' } as unknown as QueueItem;

describe('a finished result', () => {
  it('switches the gallery to the view that lists it', async () => {
    let emit: (e: BackendEvent) => void = () => undefined;
    vi.spyOn(backend, 'subscribe').mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    vi.spyOn(backend, 'bootstrap').mockResolvedValue({
      models: [],
      boards: [],
      images: [],
      workflows: [],
      engine: { state: 'ready' },
      packs: {} as Packs,
    } as BootstrapData);
    await startBackend();
    useGallery.setState({ view: 'images', selectedBoardId: 'none' });
    useGallery.setState({ settings: { ...useGallery.getState().settings, autoSwitch: true } });

    emit({ type: 'image_added', image: image('logo.png', 'other'), item });
    expect(useGallery.getState().view).toBe('assets');
    expect(useGallery.getState().selection).toEqual(['logo.png']);

    emit({ type: 'image_added', image: image('pic.png', 'general'), item });
    expect(useGallery.getState().view).toBe('images');

    // The result of a comic page's inpaint is staged on that page, not on the Image tab; an item no page asked for is the tab's.
    resetPageCanvases();
    useComic.getState().setProjects([newProject('Inpaint')]);
    const pageId = activePage(useComic.getState())!.id;
    const store = pageCanvasStore(pageId)!;
    trackPageInpaint([7], pageId);
    const staged = useCanvas.getState().stagedImageNames.length;
    const canvasItem = { id: 7, params: {}, origin: 'canvas', destination: 'canvas' } as unknown as QueueItem;
    emit({ type: 'image_added', image: image('page-result.png', 'general'), item: canvasItem });
    expect(store.getState().stagedImageNames).toEqual(['page-result.png']);
    expect(useCanvas.getState().stagedImageNames).toHaveLength(staged);
    emit({ type: 'image_added', image: image('tab-result.png', 'general'), item: { ...canvasItem, id: 8 } as QueueItem });
    expect(useCanvas.getState().stagedImageNames).toContain('tab-result.png');
    resetPageCanvases();
    resetPageInpaints();
  });
});
