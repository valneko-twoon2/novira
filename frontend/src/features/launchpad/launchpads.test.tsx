// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO, SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { CanvasLaunchpad } from './CanvasLaunchpad';
import { GenerateLaunchpad } from './GenerateLaunchpad';
import { WorkflowsLaunchpad } from './WorkflowsLaunchpad';

const image = { name: 'pic', url: '/img/pic.png', thumbnailUrl: '/img/pic.png', width: 64, height: 64, createdAt: 1 } as unknown as ImageDTO;

/** Drops the named gallery images on the card with the given title. */
function dropOn(title: string, names: string[]) {
  const zone = screen.getByText(title).closest('.ui-dropzone')!;
  const data: Record<string, string> = { [IMAGE_MIME]: JSON.stringify(names) };
  fireEvent.drop(zone, { dataTransfer: { types: [IMAGE_MIME], getData: (k: string) => data[k] ?? '', files: [] } });
}

const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ images: [image] });
  useParams.setState({ refImages: [] });
  useUi.setState({ activeTab: 'generate', modal: null, focusPromptNonce: 0 });
  useUi.getState().setMainView('canvas', 'launchpad');
  useUi.getState().setMainView('workflows', 'launchpad');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('canvas launchpad', () => {
  it('opens the canvas from the draw card', () => {
    show(<CanvasLaunchpad />);
    fireEvent.click(screen.getByTestId('lp-draw'));
    expect(useUi.getState().mainView.canvas).toBe('canvas');
  });

  it.each([
    ['params.launchpad.canvas.imageTitle', 'newCanvasRaster'],
    ['params.launchpad.canvas.controlTitle', 'newCanvasControl'],
    ['params.launchpad.canvas.inpaintTitle', 'inpaint'],
  ] as const)('imports an image dropped on %s as %s and opens the canvas', async (key, target) => {
    const importImage = vi.fn();
    useCanvas.setState({ importImage });
    show(<CanvasLaunchpad />);
    dropOn(t(key), ['pic']);
    await waitFor(() => expect(importImage).toHaveBeenCalledWith(image, target));
    expect(useUi.getState().mainView.canvas).toBe('canvas');
  });

  it('opens the canvas from a click on a drop card', () => {
    show(<CanvasLaunchpad />);
    fireEvent.click(screen.getByText(t('params.launchpad.canvas.inpaintTitle')));
    expect(useUi.getState().mainView.canvas).toBe('canvas');
  });

  it('ignores a drop of an image the gallery does not know', async () => {
    const importImage = vi.fn();
    useCanvas.setState({ importImage });
    show(<CanvasLaunchpad />);
    dropOn(t('params.launchpad.canvas.imageTitle'), ['unknown']);
    await act(async () => {
      await Promise.resolve();
    });
    expect(importImage).not.toHaveBeenCalled();
    expect(useUi.getState().mainView.canvas).toBe('launchpad');
  });
});

describe('generate launchpad', () => {
  it('focuses the prompt from the text card', () => {
    show(<GenerateLaunchpad />);
    fireEvent.click(screen.getByTestId('lp-text'));
    expect(useUi.getState().focusPromptNonce).toBe(1);
  });

  it('adds an empty reference image from a click and a filled one from a drop', async () => {
    show(<GenerateLaunchpad />);
    fireEvent.click(screen.getByTestId('lp-ref'));
    expect(useParams.getState().refImages).toHaveLength(1);
    dropOn(t('params.launchpad.generate.refTitle'), ['pic']);
    await waitFor(() => expect(useParams.getState().refImages).toHaveLength(2));
    expect(useParams.getState().refImages[1]).toMatchObject({ imageName: 'pic', imageUrl: '/img/pic.png' });
  });

  it('puts a picture dropped on the start card in the image to image section, and stays on this tab', async () => {
    useParams.setState({ initImage: null });
    show(<GenerateLaunchpad />);
    dropOn(t('params.launchpad.generate.startTitle'), ['pic']);
    await waitFor(() => expect(useParams.getState().initImage).toEqual(image));
    expect(useUi.getState().activeTab).toBe('generate');
  });

  it('opens a file chooser from the start card', () => {
    show(<GenerateLaunchpad />);
    const input = screen.getByTestId('lp-start-file') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByText(t('params.launchpad.generate.startTitle')));
    expect(click).toHaveBeenCalled();
    expect(useUi.getState().activeTab).toBe('generate');
  });

  it('opens the canvas itself from the canvas card', () => {
    show(<GenerateLaunchpad />);
    fireEvent.click(screen.getByText(t('params.launchpad.generate.canvasTitle')));
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(useUi.getState().mainView.canvas).toBe('canvas');
  });
});

describe('workflows launchpad', () => {
  const wf = (id: string, name: string, updatedAt: number): SavedWorkflow => ({ id, name, description: `about ${name}`, author: '', tags: [], category: 'user', updatedAt, graph: { nodes: [] } });

  it('opens the editor from the new card and the library from the library card', () => {
    show(<WorkflowsLaunchpad />);
    fireEvent.click(screen.getByTestId('lp-new-workflow'));
    expect(useUi.getState().mainView.workflows).toBe('editor');
    fireEvent.click(screen.getByText(t('params.launchpad.workflows.libraryTitle')));
    expect(useUi.getState().modal).toBe('workflowLibrary');
  });

  it('asks for the file at once from the load card and opens the one picked', () => {
    act(() => useUi.setState({ modal: null }));
    const loadFile = vi.fn();
    useWorkflows.setState({ loadFile });
    show(<WorkflowsLaunchpad />);
    const input = screen.getByTestId('lp-load-workflow-file') as HTMLInputElement;
    const pick = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('lp-load-workflow'));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(useUi.getState().modal).toBeNull();
    const file = new File(['{}'], 'flow.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(loadFile).toHaveBeenCalledWith(file);
  });

  it('lists no recent section for an empty library', () => {
    act(() => useWorkflows.getState().setLibrary([]));
    show(<WorkflowsLaunchpad />);
    expect(screen.queryByText(t('params.launchpad.workflows.recent'))).toBeNull();
  });

  it('lists the six most recently changed workflows and opens one in the editor', () => {
    const library = Array.from({ length: 8 }, (_, i) => wf(`w${i}`, `Flow ${i}`, i));
    act(() => useWorkflows.getState().setLibrary(library));
    const load = vi.fn();
    useWorkflows.setState({ loadWorkflow: load });
    show(<WorkflowsLaunchpad />);
    const items = document.querySelectorAll('.lp-recent__item');
    expect(items).toHaveLength(6);
    expect(items[0]!.textContent).toContain('Flow 7');
    expect(screen.queryByText('Flow 0')).toBeNull();
    fireEvent.click(items[0]!);
    expect(load).toHaveBeenCalledWith({ nodes: [] }, 'Flow 7');
    expect(useUi.getState().mainView.workflows).toBe('editor');
  });
});
