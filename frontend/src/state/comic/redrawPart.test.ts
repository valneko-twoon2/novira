// A part of a panel's picture drawn again: the inpaint request (the picture as the source, the mask, the strength, the
// panel's words) and the job queued for the panel, whose picture then replaces the panel's and keeps the old one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO, type ModelConfig, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { newProject } from './document';
import { redrawPart } from './generate';
import { fixRequest, fixSize } from './request';
import { onComicImage } from './results';
import { findPanel, useComic } from './store';

vi.mock('@/state/toasts', () => ({ toast: vi.fn() }));
// The mask is drawn on a canvas, which the test page lacks; its geometry is tested in panelFix.test.ts.
vi.mock('./panelFix', async (original) => ({ ...(await original<typeof import('./panelFix')>()), fixMaskPicture: vi.fn(async () => new Blob(['mask'])) }));

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const image = (name: string, width = 832, height = 1216): ImageDTO =>
  ({ name, url: `/img/${name}`, thumbnailUrl: `/thumb/${name}`, width, height, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null }) as ImageDTO;
const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), queue: useQueue.getState() };

/** One panel with a prompt, a character and a picture. */
function seed(picture: string | null = 'girl.png') {
  const project = newProject('P');
  project.style = { positive: 'quality', negative: 'bad' };
  project.cast = [{ id: 'c', name: 'Mina', tags: '1girl, red scarf', imageName: null }];
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, id: 'panel-0', prompt: 'reading a book', cast: ['c'] }];
  useComic.getState().setProjects([project]);
  if (picture) useComic.getState().setPanelImage('panel-0', picture);
  return findPanel(useComic.getState().projects, 'panel-0')!;
}

beforeEach(() => {
  useParams.setState({ ...initial.params, modelKey: 'main', seed: 7, shouldRandomizeSeed: false, hires: { ...initial.params.hires, enabled: true } }, true);
  useModels.setState({ ...initial.models, models: [model({})] }, true);
  useGallery.setState({ ...initial.gallery, images: [image('girl.png')] }, true);
  useQueue.setState({ ...initial.queue, items: [] }, true);
  vi.mocked(toast).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  useQueue.setState(initial.queue, true);
});

describe('fixSize', () => {
  it('keeps the size of the picture in whole eights and shrinks a picture past the largest side', () => {
    expect(fixSize(832, 1216)).toEqual({ width: 832, height: 1216 });
    expect(fixSize(1001, 643)).toEqual({ width: 1000, height: 640 });
    expect(fixSize(4096, 2048)).toEqual({ width: 2048, height: 1024 });
  });
});

describe('fixRequest', () => {
  it('redraws the masked part of the picture with the panel words, the characters and the style, and no hires pass', () => {
    const ref = seed();
    const req = fixRequest(ref, image('girl.png'), '/img/mask.png', { strength: 0.6 });
    expect(req).toMatchObject({ origin: 'generate', destination: 'gallery', iterations: 1, initImageUrl: '/img/girl.png', maskImageUrl: '/img/mask.png' });
    expect(req.params).toMatchObject({ generationMode: 'inpaint', strength: 0.6, width: 832, height: 1216 });
    expect(req.params.hiresFix).toBeUndefined();
    expect(req.params.positivePrompt).toBe('quality, 1girl, red scarf, reading a book');
    expect(req.params.negativePrompt).toBe('bad');
    expect(req.controlLayers).toBeUndefined();
  });

  it('draws the part from the words given instead of the panel prompt, with the characters still in front', () => {
    const ref = seed();
    const req = fixRequest(ref, image('girl.png'), '/img/mask.png', { words: ' detailed hand ', strength: 0.75 });
    expect(req.params.positivePrompt).toBe('quality, 1girl, red scarf, detailed hand');
  });
});

describe('redrawPart', () => {
  function mockBackend() {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(image('mask.png'));
    const sent: EnqueueRequest[] = [];
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (request) => {
      sent.push(request);
      const item = { id: 9, status: 'pending', params: request.params } as unknown as QueueItem;
      useQueue.setState({ items: [item] });
      return [item];
    });
    return { upload, enqueue, sent };
  }
  const box = { strokes: [], boxes: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.3 }] };

  it('stores the mask as a hidden picture, queues the redraw, and the result replaces the picture and keeps the old one', async () => {
    seed();
    const { upload, sent } = mockBackend();
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(true);
    expect(upload).toHaveBeenCalledWith(expect.any(Blob), { boardId: null, isIntermediate: true, category: 'mask' });
    expect(sent[0]!.maskImageUrl).toBe('/img/mask.png');
    onComicImage(useQueue.getState().items[0]!, image('girl-fixed.png'));
    const panel = findPanel(useComic.getState().projects, 'panel-0')!.panel;
    expect(panel.imageName).toBe('girl-fixed.png');
    expect(panel.takes.map((take) => take.imageName)).toEqual(['girl.png']);
  });

  it('queues nothing for a panel without a picture, a mask with nothing painted, or no model', async () => {
    const { enqueue } = mockBackend();
    seed(null);
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'warning', title: t('comic.fix.noPicture') });
    seed();
    expect(await redrawPart('panel-0', { strokes: [], boxes: [] }, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'warning', title: t('comic.fix.empty') });
    useParams.setState({ modelKey: null });
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'warning', title: t('comic.readiness.noModel') });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('says so when the job cannot be queued', async () => {
    seed();
    mockBackend();
    vi.spyOn(backend, 'enqueue').mockRejectedValue(new Error('engine is down'));
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'error', title: t('comic.draw.failed'), description: 'engine is down' });
  });

  it('refuses a panel that is not there, as one without a picture', async () => {
    seed();
    const { enqueue } = mockBackend();
    expect(await redrawPart('gone', box, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'warning', title: t('comic.fix.noPicture') });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('passes on the text the desktop shell refuses the job with', async () => {
    seed();
    mockBackend();
    // The shell rejects a command with the error's text, not an Error.
    vi.spyOn(backend, 'enqueue').mockRejectedValue('queue is full');
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(false);
    expect(toast).toHaveBeenLastCalledWith({ status: 'error', title: t('comic.draw.failed'), description: 'queue is full' });
  });

  it('does not say the redraw is queued when the queue takes no job', async () => {
    seed();
    mockBackend();
    vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    expect(await redrawPart('panel-0', box, { strength: 0.7 })).toBe(false);
    expect(toast).not.toHaveBeenCalled();
    expect(useComic.getState().pending).toEqual({});
  });
});
