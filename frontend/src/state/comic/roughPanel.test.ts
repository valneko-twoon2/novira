import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { emptyPage, newProject } from './document';
import { newPerson, newProp, newRough } from './rough';
import { applyRough, roughFor, roughPoses } from './roughPanel';
import { personJoints, project } from './roughView';
import { findPanel, useComic } from './store';

describe('the rough of a panel', () => {
  const rough = { ...newRough(), props: [newProp('box', 1, 0)] };
  const flat = (x: number) => Array.from({ length: 18 }, (_, i) => ({ x: x + (i % 3) * 0.01, y: 0.2 + i * 0.03 }));

  it('opens the panel own rough while its depth map is current', () => {
    expect(roughFor({ rough, depthImageName: 'depth.png', poses: [flat(0.5)] }, 1)).toBe(rough);
  });

  it('keeps the camera and props but stands up the panel pose once the pose was changed another way', () => {
    const camera = { ...rough.camera, pitch: 0 };
    const pose = personJoints(newPerson(0.3, 0, 0)).map((p) => project(camera, 0.8, p));
    const opened = roughFor({ rough: { ...rough, camera }, poses: [pose] }, 0.8);
    expect(opened.props).toEqual(rough.props);
    expect(opened.camera).toEqual(camera);
    expect(opened.people).toHaveLength(1);
    expect(opened.people[0]!.id).not.toBe(rough.people[0]!.id);
  });

  it('starts a panel without a rough from its pose, or from one standing person', () => {
    expect(roughFor({ poses: [] }, 1).people).toHaveLength(1);
    const pose = personJoints(newPerson()).map((p) => project(newRough().camera, 1, p));
    expect(roughFor({ poses: [pose, pose] }, 1).people).toHaveLength(2);
    // A rough whose pose was taken away has nobody left.
    expect(roughFor({ rough, poses: [] }, 1).people).toEqual([]);
  });

  it('gives the people as fractions of the panel', () => {
    const points = Array.from({ length: 36 }, (_, i) => (i % 2 ? 50 : 100));
    const [person] = roughPoses([{ points, hidden: [] }], 200, 100);
    expect(person).toHaveLength(18);
    expect(person![0]).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('a rough put into its panel', () => {
  // The state tests run without a DOM: a canvas that takes every drawing call, and a picture that is a plain blob.
  const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true });
  const fakeCanvas = { width: 0, height: 0, getContext: () => fakeContext, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })) };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function seed(upload: () => Promise<ImageDTO>) {
    vi.stubGlobal('document', { createElement: () => fakeCanvas });
    vi.stubGlobal('ImageData', class {});
    vi.spyOn(backend, 'uploadImage').mockImplementation(upload);
    const comic = newProject('R');
    comic.pages = [emptyPage(1)];
    useComic.setState({ projects: [comic], activeProjectId: comic.id, activePageId: comic.pages[0]!.id, selectedPanelId: null, selectedBubbleId: null, pending: {} });
    return comic.pages[0]!.panels[0]!.id;
  }
  const panelOf = (id: string) => findPanel(useComic.getState().projects, id)!.panel;

  it('takes the rough, its people and both pictures', async () => {
    const id = seed(async () => ({ name: 'baked.png', url: 'novira://baked.png' }) as ImageDTO);
    expect(await applyRough(id, newRough(), 64, 64)).toBe(true);
    expect(panelOf(id)).toMatchObject({ poseImageName: 'baked.png', depthImageName: 'baked.png' });
    expect(panelOf(id).poses).toHaveLength(1);
  });

  it('keeps a pose put in while the pictures were stored, and says so', async () => {
    // The assistant's pose op landed during the upload and the rough overwrote it without a word.
    let id = '';
    const later = [Array.from({ length: 18 }, () => ({ x: 0.1, y: 0.1 }))];
    id = seed(async () => {
      useComic.getState().setPanelPose(id, later, null);
      return { name: 'baked.png', url: 'novira://baked.png' } as ImageDTO;
    });
    expect(await applyRough(id, newRough(), 64, 64)).toBe(false);
    expect(panelOf(id).poses).toEqual(later);
    expect(panelOf(id).depthImageName).toBeUndefined();
  });
});
