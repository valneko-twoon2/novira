// @vitest-environment jsdom
// The pose dialog: choosing a preset and size, mirroring, and putting the drawn pose on the canvas as a control layer.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig } from '@/backend';
import { installRecordingCanvas, recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { PoseDialog } from './PoseDialog';
import { POSE_JOINT_NAMES } from '@/state/poseSkeleton';
import { PRESETS, mirrorPose } from './poseModel';

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

const initialCanvas = useCanvas.getState();
const initialParams = useParams.getState();
const saved: ImageDTO = { name: 'pose.png', mediaType: 'image', url: 'blob:pose', thumbnailUrl: 'blob:pose', width: 64, height: 64, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'control', metadata: null, workflow: null };
const controlnet = (name: string, base: string): ModelConfig => ({ key: name, name, base, type: 'controlnet', format: 'checkpoint', description: '', path: `${name}.safetensors`, size: 1, source: '' }) as ModelConfig;

const importImage = vi.fn((_image: ImageDTO, _target: string) => {
  useCanvas.getState().addEntity('control');
});

const mount = () =>
  render(
    <TooltipProvider>
      <PoseDialog />
    </TooltipProvider>,
  );
const openDialog = async () => {
  mount();
  usePoseDialog.getState().open();
  await screen.findByTestId('pose-dialog');
};
const joint = (name: string) => screen.getByTestId(`pose-joint-${name}`);

let restoreCanvas = () => {};
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initialCanvas, true);
  // The canvas feature registers the real import; here it adds the control layer the dialog then configures.
  importImage.mockClear();
  useCanvas.setState({ importImage });
  useParams.setState(initialParams, true);
  useGallery.getState().setImages([]);
  useModels.setState({ models: [] });
  useToasts.setState({ toasts: [] });
  restoreCanvas = installRecordingCanvas(recordingContext());
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
  vi.spyOn(backend, 'uploadImage').mockResolvedValue(saved);
});
afterEach(() => {
  cleanup();
  usePoseDialog.getState().close();
  restoreCanvas();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('editing the pose', () => {
  it('mirrors the figure, and goes back to the chosen preset', async () => {
    await openDialog();
    const wrist = POSE_JOINT_NAMES.indexOf('rightWrist');
    const before = PRESETS.standing[wrist]!;
    expect(joint('rightWrist').getAttribute('aria-valuetext')).toBe(`${Math.round(before.x * 100)}%, ${Math.round(before.y * 100)}%`);
    fireEvent.click(screen.getByTestId('pose-mirror'));
    const mirrored = mirrorPose(PRESETS.standing)[wrist]!;
    expect(joint('rightWrist').getAttribute('aria-valuetext')).toBe(`${Math.round(mirrored.x * 100)}%, ${Math.round(mirrored.y * 100)}%`);
    fireEvent.click(screen.getByTestId('pose-reset'));
    expect(joint('rightWrist').getAttribute('aria-valuetext')).toBe(`${Math.round(before.x * 100)}%, ${Math.round(before.y * 100)}%`);
  });

  it('starts from another preset and discards the edits made on the first one', async () => {
    await openDialog();
    fireEvent.keyDown(joint('nose'), { key: 'ArrowDown', shiftKey: true });
    fireEvent.change(screen.getByLabelText(t('pose.preset')), { target: { value: 'armsUp' } });
    const nose = PRESETS.armsUp[POSE_JOINT_NAMES.indexOf('nose')]!;
    expect(joint('nose').getAttribute('aria-valuetext')).toBe(`${Math.round(nose.x * 100)}%, ${Math.round(nose.y * 100)}%`);
    fireEvent.click(screen.getByTestId('pose-reset'));
    expect(joint('nose').getAttribute('aria-valuetext')).toBe(`${Math.round(nose.x * 100)}%, ${Math.round(nose.y * 100)}%`);
  });

  it('shapes the stage like the chosen size', async () => {
    await openDialog();
    const stage = screen.getByTestId('pose-stage');
    expect(stage.getAttribute('viewBox')).toBe(`0 0 ${useCanvas.getState().bbox.width} ${useCanvas.getState().bbox.height}`);
    fireEvent.change(screen.getByLabelText(t('pose.size')), { target: { value: 'landscape' } });
    expect(stage.getAttribute('viewBox')).toBe('0 0 1216 832');
    fireEvent.change(screen.getByLabelText(t('pose.size')), { target: { value: 'portrait' } });
    expect(stage.getAttribute('viewBox')).toBe('0 0 832 1216');
    fireEvent.change(screen.getByLabelText(t('pose.size')), { target: { value: 'square' } });
    expect(stage.getAttribute('viewBox')).toBe('0 0 1024 1024');
  });
});

describe('using the pose', () => {
  it('puts it on an empty canvas as a control layer that follows it to the end, with the OpenPose model chosen', async () => {
    useModels.setState({ models: [controlnet('depth-xl', 'sdxl'), controlnet('xinsir-openpose', 'sdxl')] });
    await openDialog();
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(usePoseDialog.getState().isOpen).toBe(false));
    expect(backend.uploadImage).toHaveBeenCalledWith(expect.any(Blob), { boardId: null, category: 'control' });
    expect(useGallery.getState().images.some((i) => i.name === 'pose.png')).toBe(true);
    const layers = useCanvas.getState().entities.filter((e) => e.type === 'control');
    expect(layers).toHaveLength(1);
    expect(importImage).toHaveBeenCalledWith(saved, 'newCanvasControl');
    expect(layers[0]).toMatchObject({ weight: 1, beginEnd: [0, 1], modelKey: 'xinsir-openpose' });
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'success', title: t('pose.saved') });
  });

  it('warns when no model reads OpenPose, and adds another layer when the canvas is not empty', async () => {
    await openDialog();
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(usePoseDialog.getState().isOpen).toBe(false));
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'warning', description: t('pose.noModel') });
    expect(useCanvas.getState().entities.filter((e) => e.type === 'control')[0]!.modelKey ?? null).toBeNull();

    usePoseDialog.getState().open();
    await screen.findByTestId('pose-dialog');
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(usePoseDialog.getState().isOpen).toBe(false));
    expect(useCanvas.getState().entities.filter((e) => e.type === 'control')).toHaveLength(2);
    expect(importImage).toHaveBeenLastCalledWith(saved, 'control');
  });

  it('stays open and shows the reason when the picture cannot be saved', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    await openDialog();
    fireEvent.click(screen.getByTestId('pose-use'));
    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
    expect(usePoseDialog.getState().isOpen).toBe(true);
    expect(useCanvas.getState().entities).toHaveLength(0);
  });

  it('shows a failure that is not an Error as text, and fails when the canvas gives no picture', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue('plain text');
    await openDialog();
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('plain text'));
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((cb) => cb(null));
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('empty image'));
  });

  it('fails when there is no 2D context', async () => {
    restoreCanvas();
    restoreCanvas = () => {};
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await openDialog();
    fireEvent.click(screen.getByTestId('pose-use'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no canvas'));
  });
});
