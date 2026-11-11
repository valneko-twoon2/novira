// @vitest-environment jsdom
// The tool band over the viewer: settings and Run, the run with its result and "change the settings and run again", a
// tool that is not ready, a failure, closing while a job runs, and following the viewer to another picture.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyNodeDefs, type ImageDTO, type ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t, tCount } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runJob, runTextJob } from '@/state/comfy/runGraph';
import { useGallery } from '@/state/gallery';
import { setToolViewer, useToolBand } from '@/state/imageTools/band';
import { registerPosePlacer } from '@/state/imageTools/posePlacer';
import { useToolRuns } from '@/state/imageTools/runs';
import { useImageToolSettings } from '@/state/imageTools/settings';
import { DEFAULT_TOOL_SETTINGS, type ImageToolId } from '@/state/imageTools/tools';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { ToolBand } from './ToolBand';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn(), runTextJob: vi.fn() }));

const picture = (name: string) => ({ name, url: `blob:${name}`, thumbnailUrl: '', width: 64, height: 64, boardId: null, mediaType: 'image', metadata: { positivePrompt: '1girl', modelKey: 'main-xl', modelName: 'Main XL' } }) as unknown as ImageDTO;
const main = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', path: '', size: 0 } as unknown as ModelConfig;
const all = { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as ComfyNodeDefs;
const viewer = { showPicture: vi.fn(), showResult: vi.fn() };

/** A job that ends when the test says, aborting like the real one. */
function pendingJob<T>() {
  let finish!: (value: T) => void;
  let signal: AbortSignal | undefined;
  const impl = (_r: unknown, s?: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      signal = s;
      finish = resolve;
      s?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  return { impl, finish: (v: T) => act(() => finish(v)), aborted: () => signal?.aborted ?? false };
}

const mount = (shown: string | null = 'photo.png', tools?: readonly ImageToolId[]) =>
  render(
    <TooltipProvider>
      <ToolBand shown={shown} tools={tools} />
    </TooltipProvider>,
  );
const openBand = (tool: ImageToolId, mode: 'settings' | 'status' = 'settings') => act(() => useToolBand.getState().show(tool, 'photo.png', mode));
const status = () => screen.getByTestId('tool-band-status').getAttribute('data-status');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.getState().setImages([picture('photo.png'), picture('other.png'), picture('cut.png')]);
  useModels.getState().setModels([main]);
  useComfyNodes.setState({ defs: all, status: 'ready' });
  useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false }, jobs: {} });
  vi.spyOn(backend, 'nodePacks').mockResolvedValue({ available: true, installed: [], comfyVersion: null, restartNeeded: false });
  useImageToolSettings.setState({ values: DEFAULT_TOOL_SETTINGS });
  useToolRuns.setState({ runs: {} });
  useToolBand.setState({ open: false, imageName: null, tool: 'facefix', mode: 'settings', face: { modelKey: null, prompt: null } });
  setToolViewer(viewer);
  viewer.showResult.mockReset();
  vi.mocked(runJob).mockReset();
  vi.mocked(runTextJob).mockReset();
});
afterEach(() => {
  cleanup();
  setToolViewer(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the band', { tags: [] }, () => {
  it('stays hidden until a tool is opened, and closes with its button', { tags: ['state-transition'] }, () => {
    mount();
    expect(screen.queryByTestId('tool-band')).toBeNull();
    openBand('cutout');
    expect(screen.getByTestId('tool-band').getAttribute('data-tool')).toBe('cutout');
    fireEvent.click(screen.getByTestId('tool-band-close'));
    expect(screen.queryByTestId('tool-band')).toBeNull();
  });

  it(
    'runs a tool from its settings, shows the result with the settings it used, and goes back to the settings',
    { tags: ['state-transition'] },
    async () => {
      const job = pendingJob<ImageDTO>();
      vi.mocked(runJob).mockImplementation(job.impl);
      mount();
      openBand('cutout');
      fireEvent.click(screen.getByTestId('tool-band-run'));
      expect(status()).toBe('running');
      expect(screen.getByTestId('tool-band-cancel')).toBeTruthy();
      expect(screen.queryByTestId('tool-band-edit')).toBeNull();
      await job.finish(picture('cut.png'));
      await waitFor(() => expect(status()).toBe('done'));
      expect(screen.getByTestId('tool-band-used').textContent).toContain('RMBG-2.0');
      expect(viewer.showResult).toHaveBeenCalledWith('cut.png', 'photo.png');
      expect(screen.getByTestId('tool-band-trim')).toBeTruthy();
      fireEvent.click(screen.getByTestId('tool-band-edit'));
      expect(screen.getByTestId('tool-band-run')).toBeTruthy();
    },
  );

  it('keeps the job running when the band is closed, and shows its end when opened again', { tags: ['state-transition'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    mount();
    openBand('facefix');
    fireEvent.click(screen.getByTestId('tool-band-run'));
    fireEvent.click(screen.getByTestId('tool-band-close'));
    expect(job.aborted()).toBe(false);
    expect(useToolRuns.getState().runs.facefix?.status).toBe('running');
    await job.finish(picture('fixed.png'));
    await waitFor(() => expect(useToolRuns.getState().runs.facefix?.status).toBe('done'));
    openBand('facefix', 'status');
    expect(status()).toBe('done');
  });

  it('cancels the job with its own button', { tags: ['state-transition'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    mount();
    openBand('cutout');
    fireEvent.click(screen.getByTestId('tool-band-run'));
    fireEvent.click(screen.getByTestId('tool-band-cancel'));
    await waitFor(() => expect(status()).toBe('canceled'));
    expect(job.aborted()).toBe(true);
  });

  it('shows why a run failed and offers to change the settings', { tags: ['error-guessing'] }, async () => {
    vi.mocked(runJob).mockRejectedValue(new Error('out of memory'));
    mount();
    openBand('facefix');
    fireEvent.click(screen.getByTestId('tool-band-run'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(t('facefix.failed'));
    expect(alert.textContent).toContain('out of memory');
    expect(screen.getByTestId('tool-band-edit')).toBeTruthy();
  });

  it('offers the missing pack instead of the settings, and installs it in the background', { tags: ['condition'] }, () => {
    const { RMBG: _gone, ...defs } = all;
    useComfyNodes.setState({ defs, status: 'ready' });
    const install = vi.spyOn(backend, 'installNodePack').mockResolvedValue(undefined as never);
    mount();
    openBand('cutout');
    expect(screen.queryByTestId('tool-band-run')).toBeNull();
    expect(screen.getByTestId('tool-band-needs').getAttribute('data-pack')).toBe('rmbg');
    fireEvent.click(screen.getByTestId('tool-band-install'));
    expect(install).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tool-band-close'));
    expect(Object.keys(useNodePacks.getState().jobs)).toHaveLength(1);
  });

  it('says what is missing when it is not a pack', { tags: ['condition'] }, () => {
    useModels.getState().setModels([]);
    mount();
    openBand('facefix');
    expect(screen.getByTestId('tool-band-problem').textContent).toContain(t('facefix.noModel'));
  });

  it('keeps changed settings for the next run', { tags: ['scenario'] }, () => {
    mount();
    openBand('facefix');
    fireEvent.change(screen.getByTestId('tool-band-face-prompt'), { target: { value: 'red eyes' } });
    expect(useToolBand.getState().face.prompt).toBe('red eyes');
    // The model is picked with the Generate screen's picker.
    fireEvent.click(screen.getByTestId('tool-band-face-model'));
    const items = screen.getByTestId('model-picker-list').querySelectorAll('.pp-picker__item');
    const last = items[items.length - 1] as HTMLElement;
    const name = last.textContent ?? '';
    fireEvent.click(last);
    const picked = useModels.getState().models.find((m) => m.key === useToolBand.getState().face.modelKey);
    expect(picked?.name).toBe(name);
    expect(screen.getByTestId('tool-band-face-model').textContent).toContain(name);
    fireEvent.click(screen.getByTestId('tool-band-tool-caption'));
    expect(screen.getByTestId('tool-band-caption-style')).toBeTruthy();
  });
});

describe('results that are not pictures', { tags: [] }, () => {
  it('puts a description into the prompt', { tags: ['scenario'] }, async () => {
    vi.mocked(runTextJob).mockResolvedValue('1girl, smile');
    useParams.setState({ positivePrompt: 'masterpiece' });
    mount();
    openBand('caption');
    fireEvent.click(screen.getByTestId('tool-band-run'));
    const text = (await screen.findByTestId('tool-band-text')) as HTMLTextAreaElement;
    expect(text.value).toBe('1girl, smile');
    fireEvent.change(text, { target: { value: '1girl, frown' } });
    fireEvent.click(screen.getByTestId('tool-band-append'));
    expect(useParams.getState().positivePrompt).toBe('masterpiece, 1girl, frown');
    fireEvent.click(screen.getByTestId('tool-band-replace'));
    expect(useParams.getState().positivePrompt).toBe('1girl, frown');
  });

  it('puts the people read from a picture on the canvas', { tags: ['scenario'] }, async () => {
    const person = { pose_keypoints_2d: Array.from({ length: 18 }, (_, j) => [10 + j, 10 + j * 2, 1]).flat() };
    vi.mocked(runTextJob).mockResolvedValue(JSON.stringify([{ canvas_width: 100, canvas_height: 100, people: [person] }]));
    const placer = vi.fn(() => true);
    registerPosePlacer(placer);
    mount();
    openBand('pose');
    fireEvent.click(screen.getByTestId('tool-band-run'));
    await screen.findByText(tCount('canvas.poseFromImage.found', 1));
    fireEvent.click(screen.getByTestId('tool-band-add-poses'));
    expect(placer).toHaveBeenCalledWith(expect.objectContaining({ people: [expect.anything()] }), true);
  });
});

describe('following the viewer', { tags: [] }, () => {
  it(
    'moves to another picture the viewer shows, but stays on the original while its result is shown',
    { tags: ['condition'] },
    async () => {
      vi.mocked(runJob).mockResolvedValue(picture('cut.png'));
      const view = mount('photo.png');
      openBand('cutout');
      fireEvent.click(screen.getByTestId('tool-band-run'));
      await waitFor(() => expect(status()).toBe('done'));
      view.rerender(
        <TooltipProvider>
          <ToolBand shown="cut.png" />
        </TooltipProvider>,
      );
      expect(useToolBand.getState().imageName).toBe('photo.png');
      view.rerender(
        <TooltipProvider>
          <ToolBand shown="other.png" />
        </TooltipProvider>,
      );
      expect(useToolBand.getState().imageName).toBe('other.png');
      expect(screen.getByTestId('tool-band-run')).toBeTruthy();
    },
  );

  it('offers only the tools the layout can use, and no comparing where the layout cannot', { tags: ['condition'] }, async () => {
    vi.mocked(runJob).mockResolvedValue(picture('cut.png'));
    render(
      <TooltipProvider>
        <ToolBand shown="photo.png" tools={['facefix', 'cutout', 'caption']} compare={false} />
      </TooltipProvider>,
    );
    openBand('cutout');
    expect(screen.queryByTestId('tool-band-tool-pose')).toBeNull();
    fireEvent.click(screen.getByTestId('tool-band-run'));
    await waitFor(() => expect(status()).toBe('done'));
    expect(screen.queryByTestId('tool-band-compare')).toBeNull();
  });
});
