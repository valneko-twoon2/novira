// @vitest-environment jsdom
// The entry points of the picture tools: a run at once from the menu (or the band's settings when the tool is not
// ready), the settings without a run, and the viewer toolbar's toggle.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyNodeDefs, type ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useComfyNodes } from '../comfy/comfyNodes';
import { useModels } from '../models';
import { openToolSettings, quickRunTool, toggleToolBand } from './actions';
import { setToolViewer, useToolBand } from './band';
import { startToolRun } from './runs';

vi.mock('./runs', async (original) => ({ ...(await original<typeof import('./runs')>()), startToolRun: vi.fn(async () => undefined) }));

const all = { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as ComfyNodeDefs;
const main = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', path: '', size: 0 } as unknown as ModelConfig;
const viewer = { showPicture: vi.fn(), showResult: vi.fn() };

beforeEach(() => {
  setToolViewer(viewer);
  viewer.showPicture.mockReset();
  vi.mocked(startToolRun).mockClear();
  useModels.getState().setModels([main]);
  useToolBand.setState({ open: false, imageName: null, tool: 'facefix', mode: 'settings' });
  vi.spyOn(backend, 'nodePacks').mockResolvedValue({ available: true, installed: [], comfyVersion: null, restartNeeded: false });
});

describe('quickRunTool', () => {
  it('shows the picture, opens the band on the run and runs the tool once its nodes are read', async () => {
    useComfyNodes.setState({ defs: null, status: 'idle' });
    vi.spyOn(backend, 'nodeDefs').mockResolvedValue(all);
    await quickRunTool('caption', 'photo.png');
    expect(viewer.showPicture).toHaveBeenCalledWith('photo.png');
    expect(useToolBand.getState()).toMatchObject({ open: true, tool: 'caption', imageName: 'photo.png', mode: 'status' });
    expect(startToolRun).toHaveBeenCalledWith('caption', 'photo.png');
  });

  it('waits for a node list another caller is already reading', async () => {
    let answer!: (defs: ComfyNodeDefs) => void;
    useComfyNodes.setState({ defs: null, status: 'idle' });
    vi.spyOn(backend, 'nodeDefs').mockReturnValue(new Promise((resolve) => (answer = resolve)));
    void useComfyNodes.getState().load();
    const run = quickRunTool('cutout', 'photo.png');
    await Promise.resolve();
    expect(startToolRun).not.toHaveBeenCalled();
    answer(all);
    await run;
    expect(startToolRun).toHaveBeenCalledWith('cutout', 'photo.png');
  });

  it('opens the band on the settings instead of running when a pack is missing', async () => {
    const { RMBG: _gone, ...defs } = all;
    useComfyNodes.setState({ defs, status: 'ready' });
    await quickRunTool('cutout', 'photo.png');
    expect(startToolRun).not.toHaveBeenCalled();
    expect(useToolBand.getState()).toMatchObject({ open: true, tool: 'cutout', mode: 'settings' });
  });
});

describe('the settings and the toolbar toggle', () => {
  it('opens the settings without running, showing the picture unless asked not to', () => {
    useComfyNodes.setState({ defs: all, status: 'ready' });
    openToolSettings('facefix', 'photo.png');
    expect(viewer.showPicture).toHaveBeenCalledTimes(1);
    expect(useToolBand.getState()).toMatchObject({ open: true, tool: 'facefix', mode: 'settings' });
    openToolSettings('cutout', 'photo.png', { show: false });
    expect(viewer.showPicture).toHaveBeenCalledTimes(1);
    expect(startToolRun).not.toHaveBeenCalled();
  });

  it('closes the band when it already shows the tool, and switches it to the tool otherwise', () => {
    useComfyNodes.setState({ defs: all, status: 'ready' });
    toggleToolBand('caption', 'photo.png');
    expect(useToolBand.getState()).toMatchObject({ open: true, tool: 'caption' });
    toggleToolBand('facefix', 'photo.png');
    expect(useToolBand.getState()).toMatchObject({ open: true, tool: 'facefix' });
    toggleToolBand('facefix', 'photo.png');
    expect(useToolBand.getState().open).toBe(false);
    expect(viewer.showPicture).not.toHaveBeenCalled();
  });
});

describe('the band', () => {
  it('keeps the face fix choices for one picture and drops them for another', () => {
    const band = useToolBand.getState();
    band.show('facefix', 'photo.png', 'settings');
    band.setFace({ prompt: 'red eyes' });
    band.show('facefix', 'photo.png', 'status');
    expect(useToolBand.getState().face.prompt).toBe('red eyes');
    useToolBand.getState().retarget('other.png');
    expect(useToolBand.getState()).toMatchObject({ imageName: 'other.png', mode: 'status', face: { prompt: null, modelKey: null } });
  });
});
