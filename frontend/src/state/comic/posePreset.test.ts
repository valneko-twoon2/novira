import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { POSE_PRESETS } from '@/state/pose/posePresets';
import { emptyPage, newProject, POSE_JOINT_COUNT } from './document';
import { findPosePreset, posesReady, putPosePeople, putPosePreset } from './posePreset';
import { findPanel, useComic } from './store';

// The state tests run without a DOM: a canvas that takes every drawing call, and a picture that is a plain blob.
const fakeContext = new Proxy({}, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
const fakeCanvas = {
  width: 0,
  height: 0,
  getContext: () => fakeContext,
  toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })),
};

let panelId = '';

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas });
  vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'control.png', url: 'novira://control.png' } as ImageDTO);
  const project = newProject('A');
  project.pages = [emptyPage(1)];
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.setState({
    projects: [project],
    activeProjectId: project.id,
    activePageId: project.pages[0]!.id,
    selectedPanelId: null,
    selectedBubbleId: null,
    pending: {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const panelOf = () => findPanel(useComic.getState().projects, panelId)!.panel;

describe('ready-made poses in a comic panel', () => {
  it('finds a preset of the canvas list by its id, and none for an unknown id', () => {
    expect(findPosePreset(POSE_PRESETS[0]!.id)).toBe(POSE_PRESETS[0]);
    expect(findPosePreset('no-such-pose')).toBeNull();
  });

  it('puts a single-person preset into the panel as one pose, with its control picture', async () => {
    const preset = POSE_PRESETS.find((p) => !p.composed)!;
    expect(await putPosePreset(panelId, preset.id, 512, 768)).toBe(true);
    const panel = panelOf();
    expect(panel.poses).toHaveLength(1);
    expect(panel.poses[0]).toHaveLength(POSE_JOINT_COUNT);
    for (const joint of panel.poses[0]!) {
      expect(Number.isFinite(joint.x)).toBe(true);
      expect(Number.isFinite(joint.y)).toBe(true);
    }
    expect(panel.poseImageName).toBe('control.png');
    expect(vi.mocked(backend.uploadImage).mock.calls[0]![1]).toMatchObject({ category: 'control' });
  });

  it('puts every person of a composition into the panel', async () => {
    const composition = POSE_PRESETS.find((p) => p.composed && p.people.length > 1)!;
    expect(composition).toBeDefined();
    expect(await putPosePreset(panelId, composition.id, 1024, 1024)).toBe(true);
    expect(panelOf().poses).toHaveLength(composition.people.length);
  });

  it('is not ready until the control picture of a pose being drawn is in the panel', async () => {
    let upload: (image: ImageDTO) => void = () => undefined;
    vi.mocked(backend.uploadImage).mockReturnValue(new Promise<ImageDTO>((resolve) => (upload = resolve)));
    const put = putPosePeople(panelId, [{ x: 0.3 }, { x: 0.7, back: true }], 512, 768);
    let ready = false;
    const waiting = posesReady().then(() => (ready = true));
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(panelOf().poseImageName).toBeNull();
    upload({ name: 'late.png', url: 'novira://late.png' } as ImageDTO);
    await waiting;
    expect(await put).toBe(true);
    expect(panelOf().poseImageName).toBe('late.png');
    expect(panelOf().poses).toHaveLength(2);
  });

  it('becomes ready even when the picture cannot be uploaded', async () => {
    vi.mocked(backend.uploadImage).mockRejectedValue(new Error('offline'));
    await expect(putPosePeople(panelId, [{}], 512, 768)).rejects.toThrow('offline');
    await posesReady();
  });

  it('does nothing for an unknown preset', async () => {
    expect(await putPosePreset(panelId, 'no-such-pose', 512, 512)).toBe(false);
    expect(backend.uploadImage).not.toHaveBeenCalled();
    expect(panelOf().poses).toEqual([]);
  });
});
