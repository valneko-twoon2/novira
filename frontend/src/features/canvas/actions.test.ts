// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig } from '@/backend';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { registerInvokeBuilder } from '@/state/invoke';
import { useUi } from '@/state/ui';
import { useModels } from '@/state/models';
import {
  acceptStaged,
  addGlobalRefImage,
  addPoseLayer,
  posesForAssistant,
  applyFilterPreview,
  discardAllStaged,
  discardCurrentStaged,
  entityAsGalleryImage,
  generateWithRandomPoses,
  importImage,
  MAX_POSE_BATCH,
  mergeVisible,
  randomizePoses,
  saveEntityToGallery,
  saveStagedToGallery,
  applyPosePreset,
  placeExtractedPoses,
  setPoses,
  stagedAsGalleryImage,
  transformEntity,
} from './actions';
import { jointBounds } from '@/state/pose/pose';
import { seededRandom } from '@/state/pose/poseSpec';

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), params: useParams.getState(), toasts: useToasts.getState(), ui: useUi.getState() };
const c = () => useCanvas.getState();
const lastToast = () => useToasts.getState().toasts.at(-1);

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 400, height: 200, isIntermediate: false, ...over }) as ImageDTO;

beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState(initial.gallery, true);
  useParams.setState(initial.params, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => vi.restoreAllMocks());

/** Puts pictures in the gallery and stages them in order. */
function stage(...images: ImageDTO[]) {
  useGallery.setState({ images });
  for (const i of images) c().addStagedImage(i.name);
}

describe('importing a picture', () => {
  it('adds it as a layer of the asked type, fitted into the bbox, and shows the canvas', () => {
    importImage(image('a'), 'raster');
    expect(c().entities.map((e) => e.type)).toEqual(['raster']);
    const obj = c().entities[0]!.objects[0]!;
    expect(obj).toMatchObject({ kind: 'image', url: 'blob:a', imageName: 'a' });
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(lastToast()?.status).toBe('success');
  });

  it('starts a new canvas the size of the picture for the new-canvas targets', () => {
    importImage(image('old'), 'raster');
    importImage(image('b', { width: 640, height: 320 }), 'newCanvasControl');
    expect(c().entities.map((e) => e.type)).toEqual(['control']);
    expect(c().bbox).toMatchObject({ x: 0, y: 0, width: 640, height: 320 });
  });

  it('adds a regional layer holding the picture as its reference', () => {
    importImage(image('r'), 'regional');
    const e = c().entities[0]!;
    expect(e.type).toBe('regional');
    expect(e.type === 'regional' && e.refImages[0]).toMatchObject({ imageName: 'r', imageUrl: 'blob:r', weight: 1, method: 'full' });
  });
});

describe('global reference images', () => {
  it('adds one with the picture, or an empty one when there is none', () => {
    addGlobalRefImage(image('a'));
    addGlobalRefImage(null);
    const refs = useParams.getState().refImages;
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ imageName: 'a', imageUrl: 'blob:a' });
    expect(refs[1]?.imageName).toBeNull();
  });
});

describe('commands that need layers', () => {
  it('says there is nothing to merge with fewer than two visible raster layers', async () => {
    c().addEntity('raster');
    await mergeVisible();
    expect(lastToast()?.status).toBe('info');
    expect(c().entities).toHaveLength(1);
  });

  it('ignores an unknown layer when saving it', async () => {
    const save = vi.spyOn(backend, 'saveImageFromUrl');
    await saveEntityToGallery('missing');
    expect(save).not.toHaveBeenCalled();
    expect(await entityAsGalleryImage('missing')).toBeNull();
  });

  it('hands out the gallery image of a layer that is one untouched picture without saving anything', async () => {
    useGallery.setState({ images: [image('a')] });
    importImage(image('a'), 'raster');
    const save = vi.spyOn(backend, 'saveImageFromUrl');
    expect(await entityAsGalleryImage(c().entities[0]!.id)).toBe('a');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('staging', () => {
  it('accepts the shown result as a raster layer and clears the staging area', () => {
    stage(image('a'), image('b'));
    c().setStagedIndex(0);
    acceptStaged();
    expect(c().stagedImageNames).toEqual([]);
    expect(c().entities.map((e) => e.type)).toEqual(['raster']);
    expect(c().entities[0]!.objects[0]).toMatchObject({ imageName: 'a' });
  });

  it('does nothing when the shown result is no longer in the gallery', () => {
    c().addStagedImage('gone');
    acceptStaged();
    expect(c().entities).toEqual([]);
    expect(c().stagedImageNames).toEqual(['gone']);
  });

  it('deletes only the intermediate results that were not accepted', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    stage(image('a', { isIntermediate: true }), image('b', { isIntermediate: true }), image('keep', { isIntermediate: false }));
    c().setStagedIndex(0);
    acceptStaged();
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(['b']));
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['a', 'keep']);
  });

  it('discards the shown result, and everything when asked', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    stage(image('a', { isIntermediate: true }), image('b', { isIntermediate: true }));
    c().setStagedIndex(1);
    discardCurrentStaged();
    expect(c().stagedImageNames).toEqual(['a']);
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(['b']));
    discardAllStaged();
    expect(c().stagedImageNames).toEqual([]);
    await vi.waitFor(() => expect(del).toHaveBeenLastCalledWith(['a']));
  });

  it('does nothing when there is nothing staged', () => {
    const del = vi.spyOn(backend, 'deleteImages');
    discardCurrentStaged();
    discardAllStaged();
    expect(del).not.toHaveBeenCalled();
  });

  it('keeps a failed intermediate delete silent', async () => {
    vi.spyOn(backend, 'deleteImages').mockRejectedValue(new Error('x'));
    stage(image('a', { isIntermediate: true }));
    discardAllStaged();
    await Promise.resolve();
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('keeps the shown result in the gallery on the auto-add board, once', async () => {
    stage(image('a', { isIntermediate: true }));
    useGallery.setState({ autoAddBoardId: 'b1' });
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([image('a', { boardId: 'b1' })]);
    expect(await stagedAsGalleryImage()).toBe('a');
    expect(update).toHaveBeenCalledWith(['a'], { isIntermediate: false, boardId: 'b1' });
    stage(image('c'));
    useGallery.setState({ images: [image('c')] });
    c().setStagedIndex(c().stagedImageNames.length - 1);
    update.mockClear();
    expect(await stagedAsGalleryImage()).toBe('c');
    expect(update).not.toHaveBeenCalled();
    c().clearStaged();
    expect(await stagedAsGalleryImage()).toBeNull();
  });

  it('reports a failure to keep the result', async () => {
    stage(image('a', { isIntermediate: true }));
    vi.spyOn(backend, 'updateImages').mockRejectedValue(new Error('disk'));
    expect(await stagedAsGalleryImage()).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk' });
    await saveStagedToGallery();
    expect(lastToast()?.status).toBe('error');
  });

  it('saves the shown result to the gallery and says so', async () => {
    stage(image('a', { isIntermediate: true }));
    vi.spyOn(backend, 'updateImages').mockResolvedValue([image('a')]);
    await saveStagedToGallery();
    expect(lastToast()?.status).toBe('success');
  });
});

describe('random poses', () => {
  const poses = (id: string) => c().entities.find((e) => e.id === id)!.objects as PoseObject[];

  it('adds one pose filling the bbox to a new control layer when no control layer is selected', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    const raster = c().addEntity('raster');
    randomizePoses(raster, seededRandom(3));
    const control = c().entities.find((e) => e.type === 'control')!;
    expect(c().selectedEntityId).toBe(control.id);
    expect(poses(control.id)).toHaveLength(1);
    const b = jointBounds(poses(control.id)[0]!)!;
    expect(Math.max(b.width, b.height)).toBeCloseTo(512 - 2 * 26, 0);
    expect(poses(control.id)[0]!.width).toBe(4);
  });

  it('gives every pose of the layer a new shape in its place, as one undo step, and keeps other objects', () => {
    const id = c().addEntity('control');
    randomizePoses(id, seededRandom(1));
    randomizePoses(id, seededRandom(2));
    c().updateEntity(id, { objects: [...c().entities[0]!.objects, ...poses(id).map((p) => ({ ...p, id: 'second' }))] }, { history: false });
    const rect = { kind: 'rect', id: 'r', x: 0, y: 0, width: 4, height: 4, color: { r: 0, g: 0, b: 0, a: 1 } } as const;
    c().addObject(id, rect);
    const before = poses(id);
    const past = c().past.length;
    randomizePoses(id, seededRandom(9));
    expect(poses(id).map((p) => p.id)).toEqual([before[0]!.id, 'second', 'r']);
    expect(poses(id)[0]!.points).not.toEqual(before[0]!.points);
    expect(poses(id)[2]).toBe(before[2]);
    expect(c().past.length).toBe(past + 1);
  });

  it('makes the new layer follow the pose fully, with an OpenPose model that fits the main model', () => {
    const model = (key: string, name: string, base: string, type = 'controlnet') => ({ key, name, base, type, path: `${name}.safetensors` }) as unknown as ModelConfig;
    useModels.setState({ models: [model('main', 'main', 'sdxl', 'main'), model('op15', 'openpose-sd15', 'sd-1'), model('opxl', 'openpose-sdxl', 'sdxl')] });
    useParams.setState({ modelKey: 'main' });
    const first = addPoseLayer();
    expect(c().entities.find((e) => e.id === first)).toMatchObject({ type: 'control', modelKey: 'opxl', weight: 1, beginEnd: [0, 1], withTransparencyEffect: false });
    useModels.setState({ models: [] });
    const second = addPoseLayer();
    expect(c().entities.find((e) => e.id === second)).toMatchObject({ modelKey: null, weight: 1 });
  });

  it('warns and changes nothing on a locked layer', () => {
    const id = c().addEntity('control', { isLocked: true });
    randomizePoses(id, seededRandom(1));
    expect(poses(id)).toHaveLength(0);
    expect(lastToast()).toMatchObject({ status: 'warning' });
  });

  it('turns and scales a layer of poses by its joints, so it stays editable', async () => {
    const id = c().addEntity('control');
    randomizePoses(id, seededRandom(4));
    const before = poses(id)[0]!;
    await transformEntity(id, 'scaleUp');
    const after = poses(id)[0]!;
    expect(after.kind).toBe('pose');
    expect(jointBounds(after)!.width).toBeCloseTo(jointBounds(before)!.width * 2, 5);
  });
});

describe('poses from the assistant', () => {
  const control = () => c().entities.find((e) => e.type === 'control')!;
  const poses = () => control().objects.filter((o): o is PoseObject => o.kind === 'pose');

  it('places the people on a new pose layer, replaces them next time and adds when asked', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    expect(setPoses([{ x: 0.3 }, { x: 0.7, size: 0.5 }], false)).toBe(true);
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(1);
    expect(poses()).toHaveLength(2);
    expect(c().selectedEntityId).toBe(control().id);
    expect(jointBounds(poses()[0]!)!.x).toBeLessThan(jointBounds(poses()[1]!)!.x);
    expect(setPoses([{ lean: 10 }], false)).toBe(true);
    expect(poses()).toHaveLength(1);
    expect(setPoses([{ x: 0.2 }], true)).toBe(true);
    expect(poses()).toHaveLength(2);
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(1);
  });

  it('keeps other objects of the layer, makes one undo step and uses a new layer when the selected one is locked', () => {
    const id = c().addEntity('control');
    const rect = { kind: 'rect', id: 'r', x: 0, y: 0, width: 4, height: 4, color: { r: 0, g: 0, b: 0, a: 1 } } as const;
    c().addObject(id, rect);
    const past = c().past.length;
    setPoses([{}], false);
    expect(c().past.length).toBe(past + 1);
    expect(c().entities.find((e) => e.id === id)!.objects.map((o) => o.kind)).toEqual(['rect', 'pose']);
    c().updateEntity(id, { isLocked: true });
    setPoses([{}], false);
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(2);
    expect(c().entities.find((e) => e.id === id)!.objects).toHaveLength(2);
  });

  it('places at most four people and nothing when nobody was described', () => {
    expect(setPoses([null, 3, 'x', []], false)).toBe(false);
    expect(c().entities).toHaveLength(0);
    setPoses([{}, {}, {}, {}, {}, {}], false);
    expect(poses()).toHaveLength(4);
  });

  it('tells the assistant about the people on the selected control layer, and says none on other layers', () => {
    expect(posesForAssistant()).toEqual({ poses: [] });
    setPoses([{ lean: 12, lArm: { upper: 150, fore: 170 } }], false);
    const [person] = posesForAssistant().poses;
    expect(person).toMatchObject({ lean: 12, lArm: { upper: 150, fore: 170 } });
    c().select(c().addEntity('raster'));
    expect(posesForAssistant()).toEqual({ poses: [] });
  });
});
describe('poses found in a picture', () => {
  const control = () => c().entities.find((e) => e.type === 'control')!;
  const poses = () => control().objects.filter((o): o is PoseObject => o.kind === 'pose');
  const person = (x: number, hidden: number[] = []) => ({ points: Array.from({ length: 36 }, (_, i) => (i % 2 === 0 ? x : 0.2 + (i / 2) * 0.03)), hidden });

  it('places the people on a new pose layer, replaces them next time and adds when asked', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    expect(placeExtractedPoses({ people: [person(0.3), person(0.7)], aspect: 1 }, false)).toBe(true);
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(1);
    expect(poses()).toHaveLength(2);
    expect(c().selectedEntityId).toBe(control().id);
    expect(placeExtractedPoses({ people: [person(0.5)], aspect: 1 }, false)).toBe(true);
    expect(poses()).toHaveLength(1);
    expect(placeExtractedPoses({ people: [person(0.2)], aspect: 1 }, true)).toBe(true);
    expect(poses()).toHaveLength(2);
  });

  it('does nothing and makes no layer when nobody was found', () => {
    expect(placeExtractedPoses({ people: [], aspect: 1 }, false)).toBe(false);
    expect(c().entities).toHaveLength(0);
  });

  it('is one undo step', () => {
    c().select(c().addEntity('control'));
    const past = c().past.length;
    placeExtractedPoses({ people: [person(0.5)], aspect: 1 }, false);
    expect(c().past.length).toBe(past + 1);
  });
});
describe('ready-made poses on the canvas', () => {
  const control = () => c().entities.find((e) => e.type === 'control')!;
  const poses = () => control().objects.filter((o): o is PoseObject => o.kind === 'pose');

  it('make a new pose layer when none is selected, with a pose in the middle of the box', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    expect(applyPosePreset('handsOnHips')).toBe(true);
    expect(poses()).toHaveLength(1);
    const b = jointBounds(poses()[0]!)!;
    expect(b.x + b.width / 2).toBeCloseTo(256, -1);
  });

  it('give the first pose a new shape in the same place, size and id, and leave the others', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    setPoses([{ x: 0.3, size: 0.6 }, { x: 0.75, size: 0.5 }], false);
    const [first, second] = poses();
    applyPosePreset('wave');
    const [first2, second2] = poses();
    expect(first2!.id).toBe(first!.id);
    expect(first2!.points).not.toEqual(first!.points);
    expect(second2).toEqual(second);
    expect(jointBounds(first2!)!.x + jointBounds(first2!)!.width / 2).toBeCloseTo(jointBounds(first!)!.x + jointBounds(first!)!.width / 2, -1);
  });

  it('keep every pose inside the generation box, shrinking the ones with raised arms or kicks', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    for (const id of ['armsUp', 'highKick', 'jumping', 'sprinting', 'drawingBow']) {
      c().select(null);
      c().replaceEntities([]);
      applyPosePreset(id);
      const b = jointBounds(poses().at(-1)!)!;
      expect(b.width, id).toBeLessThanOrEqual(512 * 0.97);
      expect(b.height, id).toBeLessThanOrEqual(512 * 0.97);
    }
  });

  it('put a composition on the layer in place of every pose, keeping what is not a pose', () => {
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
    setPoses([{ x: 0.3 }, { x: 0.7 }, { x: 0.5 }], false);
    const id = c().selectedEntityId!;
    const past = c().past.length;
    expect(applyPosePreset('faceToFace')).toBe(true);
    expect(poses()).toHaveLength(2);
    expect(c().past.length).toBe(past + 1);
    expect(c().selectedEntityId).toBe(id);
    expect(applyPosePreset('lineUpThree')).toBe(true);
    expect(poses()).toHaveLength(3);
  });

  it('refuse an unknown pose and a locked layer, and are one undo step', () => {
    expect(applyPosePreset('nope')).toBe(false);
    expect(c().entities).toHaveLength(0);
    const id = c().addEntity('control');
    c().select(id);
    const past = c().past.length;
    expect(applyPosePreset('standing')).toBe(true);
    expect(c().past.length).toBe(past + 1);
    c().updateEntity(id, { isLocked: true });
    expect(applyPosePreset('standing')).toBe(false);
  });
});
describe('a batch of random poses', () => {
  let reasons: string[] = [];
  beforeEach(() => {
    reasons = [];
    useUi.setState({ activeTab: 'canvas' });
    // The real builder draws pixels; here only the order of events matters.
    registerInvokeBuilder('canvas', { readiness: () => reasons, build: async () => ({}) as never, subscribe: () => () => {} });
  });

  it('queues one generation per pose, each with a new random pose on the same layer', async () => {
    const seen: string[] = [];
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async () => {
      seen.push(JSON.stringify(c().entities.find((e) => e.type === 'control')!.objects));
      return [];
    });
    await generateWithRandomPoses(3);
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'success' });
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(1);
    expect(new Set(seen).size).toBe(3);
  });

  it('keeps queueing on the canvas when the user opens another tab meanwhile', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async () => {
      useUi.setState({ activeTab: 'queue' });
      return [];
    });
    await generateWithRandomPoses(3);
    expect(enqueue).toHaveBeenCalledTimes(3);
  });

  it('stops with one error when a request fails', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockRejectedValue(new Error('boom'));
    await generateWithRandomPoses(3);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(useToasts.getState().toasts).toEqual([expect.objectContaining({ status: 'error', description: 'boom' })]);
  });

  it('warns once and queues nothing when the canvas cannot be invoked', async () => {
    reasons = ['no model'];
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    await generateWithRandomPoses(5);
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toHaveLength(1);
    expect(c().entities).toHaveLength(0);
  });

  it('keeps the count between one and the limit', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    await generateWithRandomPoses(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
    await generateWithRandomPoses(1000);
    expect(enqueue).toHaveBeenCalledTimes(1 + MAX_POSE_BATCH);
  });
});

describe('filter previews', () => {
  it('replaces the layer with the previewed picture and drops the filter and the preview', () => {
    const id = c().addEntity('control');
    c().setFilterPreview(id, { url: 'blob:p', x: 1, y: 2, width: 30, height: 40 });
    applyFilterPreview(id);
    const e = c().entities.find((x) => x.id === id)!;
    expect(e.objects).toHaveLength(1);
    expect(e.objects[0]).toMatchObject({ kind: 'image', url: 'blob:p', x: 1, y: 2, width: 30, height: 40 });
    expect(e.type === 'control' && e.filter).toBe('none');
    expect(c().filterPreviews[id]).toBeUndefined();
  });

  it('does nothing without a preview', () => {
    const id = c().addEntity('control');
    const before = c().entities;
    applyFilterPreview(id);
    expect(c().entities).toBe(before);
  });
});
