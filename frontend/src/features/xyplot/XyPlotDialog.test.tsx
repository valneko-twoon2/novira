// @vitest-environment jsdom
// The comparison-grid dialog: choosing the two axes, running the cells, the failure branches and cancelling.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { runJob } from '@/state/comfy/runGraph';
import { useXyPlotDialog } from '@/state/dialogs/xyplot';
import { useGallery } from '@/state/gallery';
import { buildRequestFor, useReadiness } from '@/state/invoke';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { XyPlotDialog } from './XyPlotDialog';
import { drawGrid } from './drawGrid';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn(), runTextJob: vi.fn() }));
vi.mock('./drawGrid', () => ({ drawGrid: vi.fn() }));
vi.mock('@/state/invoke', async (original) => ({ ...(await original<typeof import('@/state/invoke')>()), useReadiness: vi.fn(() => []), buildRequestFor: vi.fn(), autoAddBoardId: () => null }));
// A native select stands in for the popper menu, which jsdom cannot drive.
vi.mock('@/ui', async (original) => {
  const real = await original<typeof import('@/ui')>();
  return {
    ...real,
    Select: ({ value, onChange, options, 'aria-label': label }: { value: string | null; onChange: (v: string) => void; options: { value: string; label: unknown }[]; 'aria-label'?: string }) => (
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {String(o.label)}
          </option>
        ))}
      </select>
    ),
  };
});

const picture = (name: string): ImageDTO => ({ name, mediaType: 'image', url: `blob:${name}`, thumbnailUrl: `blob:${name}`, width: 64, height: 48, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null });
const baseRequest = { params: { positivePrompt: 'a cat', seed: 7, modelKey: 'm1', modelName: 'Model One', cfgScale: 5, steps: 20, scheduler: 'euler' }, boardId: null } as unknown as EnqueueRequest;

class FakeImage {
  naturalWidth = 64;
  naturalHeight = 48;
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    queueMicrotask(() => (value.includes('bad') ? this.onerror?.() : this.onload?.()));
  }
}

const mount = () =>
  render(
    <TooltipProvider>
      <XyPlotDialog />
    </TooltipProvider>,
  );
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const xAxis = () => t('xyplot.x');
const yAxis = () => t('xyplot.y');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('Image', FakeImage);
  useModels.setState({ models: [] });
  useGallery.getState().setImages([]);
  useToasts.setState({ toasts: [] });
  vi.mocked(useReadiness).mockReturnValue([]);
  vi.mocked(buildRequestFor).mockResolvedValue(baseRequest);
  vi.mocked(runJob).mockReset().mockImplementation((request) => Promise.resolve(picture(`cell-${request.params.steps}-${request.params.cfgScale}.png`)));
  vi.mocked(drawGrid).mockReset().mockResolvedValue(new Blob(['grid'], { type: 'image/png' }));
  vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('grid.png'));
});
afterEach(() => {
  cleanup();
  useXyPlotDialog.getState().close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const openDialog = async () => {
  mount();
  useXyPlotDialog.getState().open();
  await screen.findByTestId('xyplot-dialog');
};

describe('choosing the axes', () => {
  it('asks for an axis first, then fills in a starting list of values and counts the pictures', async () => {
    await openDialog();
    expect(screen.getByTestId('xyplot-problem').textContent).toBe(t('xyplot.problem.noAxis'));
    expect((screen.getByTestId('xyplot-run') as HTMLButtonElement).disabled).toBe(true);
    pick(xAxis(), 'steps');
    expect((screen.getByTestId('xyplot-x-values') as HTMLInputElement).value).toBe('15, 25, 35');
    expect(screen.getByTestId('xyplot-summary').textContent).toBe(t('xyplot.summary', { columns: 3, rows: 1, count: 3 }));
    pick(yAxis(), 'cfgScale');
    expect(screen.getByTestId('xyplot-summary').textContent).toBe(t('xyplot.summary', { columns: 3, rows: 4, count: 12 }));
  });

  it('refuses the same setting twice, unreadable numbers, too many values and an empty list', async () => {
    await openDialog();
    pick(xAxis(), 'steps');
    pick(yAxis(), 'steps');
    expect(screen.getByTestId('xyplot-problem').textContent).toBe(t('xyplot.problem.sameAxis'));
    pick(yAxis(), 'none');
    fireEvent.change(screen.getByTestId('xyplot-x-values'), { target: { value: '10, abc' } });
    expect(screen.getByText(t('xyplot.error.invalid'))).toBeTruthy();
    expect((screen.getByTestId('xyplot-run') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('xyplot-x-values'), { target: { value: '1 2 3 4 5 6 7 8 9' } });
    expect(screen.getByText(t('xyplot.error.tooMany', { max: 8 }))).toBeTruthy();
    fireEvent.change(screen.getByTestId('xyplot-x-values'), { target: { value: ' ' } });
    expect(screen.getAllByText(t('xyplot.error.empty')).length).toBeGreaterThan(0);
  });

  it('refuses a grid of more than 36 pictures', async () => {
    await openDialog();
    pick(xAxis(), 'seed');
    fireEvent.change(screen.getByTestId('xyplot-x-values'), { target: { value: '1 2 3 4 5 6 7' } });
    pick(yAxis(), 'cfgScale');
    fireEvent.change(screen.getByTestId('xyplot-y-values'), { target: { value: '2 3 4 5 6 7 8' } });
    expect(screen.getByTestId('xyplot-problem').textContent).toBe(t('xyplot.problem.tooMany', { max: 36 }));
  });

  it('lists the schedulers and the models of the same family as checkboxes, and says when there are none', async () => {
    useModels.setState({ models: [] });
    await openDialog();
    pick(xAxis(), 'scheduler');
    const choices = screen.getByTestId('xyplot-x-choices');
    expect(screen.getByTestId('xyplot-problem').textContent).toBe(t('xyplot.problem.empty'));
    fireEvent.click(screen.getByLabelText('euler'));
    fireEvent.click(screen.getByLabelText('dpmpp_2m'));
    expect(choices.querySelectorAll('input:checked')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('euler'));
    expect(choices.querySelectorAll('input:checked')).toHaveLength(1);
    pick(yAxis(), 'model');
    expect(screen.getByText(t('xyplot.noModels'))).toBeTruthy();
  });

  it('offers the diffusion models of a newer family as the Generate tab draws them, not only main models', async () => {
    useModels.setState({
      models: [
        { key: 'a1', name: 'NyaNya Anima', base: 'anima', type: 'diffusion_model', path: 'nyanya.safetensors' },
        { key: 'a2', name: 'Other Anima', base: 'anima', type: 'diffusion_model', path: 'other.safetensors' },
        { key: 'x1', name: 'Anime XL', base: 'sdxl', type: 'main', path: 'animeXL.safetensors' },
        { key: 'l1', name: 'Anima Style', base: 'anima', type: 'lora', path: 'style.safetensors' },
      ] as never,
    });
    useParams.setState({ modelKey: 'a1' });
    await openDialog();
    pick(xAxis(), 'model');
    const choices = screen.getByTestId('xyplot-x-choices');
    expect([...choices.querySelectorAll('label')].map((l) => l.textContent)).toEqual(['NyaNya Anima', 'Other Anima']);
  });

  it('takes one prompt per line and shows a note for the denoising strength', async () => {
    await openDialog();
    pick(xAxis(), 'prompt');
    expect((screen.getByTestId('xyplot-x-values') as HTMLTextAreaElement).value).toContain('smiling');
    expect(screen.getByTestId('xyplot-summary').textContent).toContain('3');
    pick(yAxis(), 'strength');
    expect(screen.getByText(t('xyplot.strengthNote'))).toBeTruthy();
  });
});

describe('making the grid', () => {
  it('runs every cell with the same seed, saves the table to the gallery and opens it in the viewer', async () => {
    await openDialog();
    pick(xAxis(), 'steps');
    pick(yAxis(), 'cfgScale');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    await screen.findByTestId('xyplot-done');
    const requests = vi.mocked(runJob).mock.calls.map((c) => c[0]);
    expect(requests).toHaveLength(12);
    expect(new Set(requests.map((r) => r.params.seed)).size).toBe(1);
    const content = vi.mocked(drawGrid).mock.calls[0]![0];
    expect([content.columns, content.rows, content.images.length]).toEqual([3, 4, 12]);
    expect(content.columnLabels).toEqual(['15', '25', '35']);
    expect(content.rowLabels).toEqual(['3', '4.5', '6', '8']);
    expect(content.picture).toEqual({ width: 64, height: 48 });
    expect(useGallery.getState().images.some((i) => i.name === 'grid.png')).toBe(true);
    expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('xyplot.done'));
    expect(screen.queryByText(/could not be made/)).toBeNull();

    fireEvent.click(screen.getByTestId('xyplot-open'));
    expect(useGallery.getState().selection).toEqual(['grid.png']);
    expect(useXyPlotDialog.getState().isOpen).toBe(false);
  });

  it('draws only one axis with a dash for the unused one in the title', async () => {
    await openDialog();
    pick(yAxis(), 'seed');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    await screen.findByTestId('xyplot-done');
    const content = vi.mocked(drawGrid).mock.calls[0]![0];
    expect(content.columnLabels).toEqual([]);
    expect(content.rowLabels).toHaveLength(4);
    expect(content.title).toContain(t('xyplot.unused'));
    expect(content.title).toContain('Model One');
  });

  it('keeps going when some pictures fail and says how many are missing', async () => {
    vi.mocked(runJob).mockImplementation((request) => (request.params.steps === 25 ? Promise.reject(new Error('boom')) : Promise.resolve(picture(request.params.steps === 35 ? 'bad.png' : 'ok.png'))));
    await openDialog();
    pick(xAxis(), 'steps');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    await screen.findByTestId('xyplot-done');
    expect(vi.mocked(drawGrid).mock.calls[0]![0].images.map((i) => i !== null)).toEqual([true, false, false]);
    expect(screen.getByText(t('xyplot.partFailed', { count: 2 }))).toBeTruthy();
  });

  it('reports the engine message when every picture fails, and the generic one when none could be loaded', async () => {
    vi.mocked(runJob).mockRejectedValue(new Error('out of memory'));
    await openDialog();
    pick(xAxis(), 'steps');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('out of memory');
    expect(drawGrid).not.toHaveBeenCalled();

    vi.mocked(runJob).mockResolvedValue(picture('bad.png'));
    fireEvent.click(screen.getByTestId('xyplot-run'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(t('xyplot.failed')));
    expect(screen.getByRole('alert').textContent).not.toContain('out of memory');
  });

  it('says the generation is not set up when no request can be built, and shows non-Error failures as text', async () => {
    vi.mocked(buildRequestFor).mockResolvedValueOnce(null);
    await openDialog();
    pick(xAxis(), 'steps');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    expect((await screen.findByRole('alert')).textContent).toContain(t('xyplot.notReady'));
    vi.mocked(drawGrid).mockRejectedValueOnce('plain text');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('plain text'));
  });

  it('cannot start while the Generate form is not ready', async () => {
    vi.mocked(useReadiness).mockReturnValue(['No model chosen']);
    await openDialog();
    pick(xAxis(), 'steps');
    expect(screen.getByRole('alert').textContent).toContain('No model chosen');
    expect((screen.getByTestId('xyplot-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the progress while running and stops quietly when cancelled', async () => {
    vi.mocked(runJob).mockImplementation((_request, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    await openDialog();
    pick(xAxis(), 'steps');
    fireEvent.click(screen.getByTestId('xyplot-run'));
    const cancel = await screen.findByTestId('xyplot-cancel');
    expect(screen.getByTestId('xyplot-run').textContent).toContain(t('xyplot.running', { done: 0, total: 3 }));
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByTestId('xyplot-cancel')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(drawGrid).not.toHaveBeenCalled();
  });
});
