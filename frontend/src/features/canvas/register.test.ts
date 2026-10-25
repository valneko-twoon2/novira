// What the canvas tells the Invoke button (readiness, request, change subscription) and how it keeps the bbox and the
// size parameters together.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import type { InvokeBuilder } from '@/state/invoke';

let builder: InvokeBuilder | undefined;
const dragSources = new Map<string, unknown>();
vi.mock('@/state/invoke', () => ({
  registerInvokeBuilder: (tab: string, b: InvokeBuilder) => {
    if (tab === 'canvas') builder = b;
  },
}));
vi.mock('@/state/dnd', () => ({
  registerDragSource: (kind: string, resolve: unknown) => {
    dragSources.set(kind, resolve);
    return () => {};
  },
}));
vi.mock('./request', () => ({ buildCanvasRequest: vi.fn(async () => ({ built: true })) }));
vi.mock('@/state/comfy/packNeeds', () => ({ refImagesPackReason: vi.fn(() => null) }));
import { refImagesPackReason } from '@/state/comfy/packNeeds';
import { buildCanvasRequest } from './request';

const canvasInitial = useCanvas.getState();
const { registerCanvasFeature } = await import('./register');
registerCanvasFeature();
const registeredImport = useCanvas.getState().importImage;

const model = (key: string): ModelConfig => ({ key, name: key, type: 'main', base: 'sdxl', format: 'diffusers', description: '', path: '', size: 0, source: '' }) as ModelConfig;
const paramsInitial = useParams.getState();
const reasons = () => builder!.readiness();

beforeEach(() => {
  registerCanvasFeature();
  useCanvas.setState(canvasInitial, true);
  useCanvas.setState({ importImage: registeredImport });
  useParams.setState(paramsInitial, true);
  useModels.setState({ models: [model('m1')] });
  useParams.setState({ modelKey: 'm1', refImages: [] });
  vi.mocked(refImagesPackReason).mockReturnValue(null);
});

describe('canvas registration', () => {
  it('registers the layer and staged-result drag sources once', () => {
    expect([...dragSources.keys()].sort()).toHaveLength(2);
    const before = builder;
    registerCanvasFeature();
    expect(builder).toBe(before);
  });

  it('puts the shared import action into the canvas store', () => {
    expect(registeredImport).not.toBe(canvasInitial.importImage);
  });
});

describe('canvas readiness', () => {
  it('is ready with a model and nothing else to check', () => {
    expect(reasons()).toEqual([]);
  });

  it('asks for a model, and for one that is installed', () => {
    useParams.setState({ modelKey: null });
    expect(reasons()).toEqual([t('canvas.readiness.noModel')]);
    useParams.setState({ modelKey: 'gone' });
    expect(reasons()).toEqual([t('canvas.readiness.noModel')]);
  });

  it('asks a control layer for its model, by the number in its name', () => {
    useCanvas.getState().addEntity('control');
    const seq = useCanvas.getState().entities[0]!.seq;
    expect(reasons()).toEqual([t('canvas.readiness.controlNoModel', { number: seq })]);
  });

  it('skips layers that are switched off or in a hidden group', () => {
    const id = useCanvas.getState().addEntity('control');
    useCanvas.getState().updateEntity(id, { isEnabled: false });
    expect(reasons()).toEqual([]);
    useCanvas.getState().updateEntity(id, { isEnabled: true });
    useCanvas.setState({ groupHidden: { ...useCanvas.getState().groupHidden, control: true } });
    expect(reasons()).toEqual([]);
  });

  it('asks a regional layer for a prompt or a reference image, and complete reference images', () => {
    const id = useCanvas.getState().addEntity('regional');
    const seq = useCanvas.getState().entities[0]!.seq;
    expect(reasons()).toEqual([t('canvas.readiness.regionalEmpty', { number: seq })]);
    useCanvas.getState().updateEntity(id, { positivePrompt: '  a cat  ' });
    expect(reasons()).toEqual([]);
    useCanvas.getState().updateEntity(id, {
      positivePrompt: '',
      refImages: [{ id: 'r', isEnabled: true, imageName: null, imageUrl: null, modelKey: null, weight: 1, beginEnd: [0, 1], method: 'full', clipVisionModel: 'ViT-H' }],
    } as never);
    expect(reasons()).toEqual([t('canvas.readiness.regionalRefIncomplete', { number: seq })]);
  });

  it('asks the global reference images to be complete and adds the missing node pack reason', () => {
    useParams.setState({
      refImages: [
        { id: 'a', isEnabled: true, imageName: 'x', imageUrl: '/x', modelKey: 'ip', weight: 1, beginEnd: [0, 1], method: 'full', clipVisionModel: 'ViT-H' },
        { id: 'b', isEnabled: true, imageName: null, imageUrl: null, modelKey: null, weight: 1, beginEnd: [0, 1], method: 'full', clipVisionModel: 'ViT-H' },
        { id: 'c', isEnabled: false, imageName: null, imageUrl: null, modelKey: null, weight: 1, beginEnd: [0, 1], method: 'full', clipVisionModel: 'ViT-H' },
      ],
    } as never);
    vi.mocked(refImagesPackReason).mockReturnValue('needs pack');
    expect(reasons()).toEqual([t('canvas.readiness.refIncomplete', { number: 2 }), 'needs pack']);
  });
});

describe('canvas request and change notification', () => {
  it('builds the request from the stores and the prepend flag', async () => {
    await expect(builder!.build({ prepend: true })).resolves.toEqual({ built: true });
    expect(vi.mocked(buildCanvasRequest).mock.calls[0]![2]).toBe(true);
  });

  it('reports changes of the model, layers, models and node packs until unsubscribed', () => {
    const onChange = vi.fn();
    const stop = builder!.subscribe!(onChange);
    useParams.setState({ modelKey: 'other' });
    expect(onChange).toHaveBeenCalledTimes(1);
    useCanvas.getState().addEntity('raster');
    expect(onChange).toHaveBeenCalledTimes(2);
    useModels.setState({ models: [] });
    expect(onChange).toHaveBeenCalledTimes(3);
    useNodePacks.setState({ packs: { installed: [] } as never });
    expect(onChange).toHaveBeenCalledTimes(4);
    useParams.setState({ steps: 5 });
    expect(onChange).toHaveBeenCalledTimes(4);
    stop();
    useCanvas.getState().addEntity('raster');
    expect(onChange).toHaveBeenCalledTimes(4);
  });
});

describe('bbox and size parameters', () => {
  it('moves the bbox to a new width and height without writing back to the parameters', () => {
    useParams.setState({ width: 768, height: 1024 });
    const { bbox } = useCanvas.getState();
    expect([bbox.width, bbox.height]).toEqual([768, 1024]);
  });

  it('leaves the bbox alone when only other parameters change or the size already matches', () => {
    const before = useCanvas.getState().bbox;
    useParams.setState({ steps: 12 });
    expect(useCanvas.getState().bbox).toBe(before);
    useParams.setState({ width: before.width, height: before.height });
    expect(useCanvas.getState().bbox).toBe(before);
  });
});
