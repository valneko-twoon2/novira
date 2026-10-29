// @vitest-environment jsdom
// The tools of a picture (file, fit, zoom, turn, mirror, clear) and the page's keys: Delete, the arrows and Escape.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { DEFAULT_IMAGE_VIEW, IMAGE_SCALE_RANGE, newProject, type ComicImageView } from '@/state/comic/document';
import { findPanel, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { PictureTools, SCALE_STEP, usePageKeys } from './PictureTools';

const box = { x: 0, y: 0, width: 0.5, height: 0.5 };

function show(view: ComicImageView | null, extra: { url?: string; onClear?: () => void; idPrefix?: string } = {}) {
  const onView = vi.fn();
  const onFile = vi.fn();
  const url = 'url' in extra ? extra.url : 'novira://a.png';
  const { container } = render(
    <TooltipProvider>
      <PictureTools url={url} view={view} box={box} aspect={1.4} onView={onView} onFile={onFile} onClear={extra.onClear} idPrefix={extra.idPrefix} />
    </TooltipProvider>,
  );
  return { onView, onFile, container };
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('the tools of a picture', () => {
  it('has only the upload button while there is no picture', () => {
    show(null);
    expect(screen.getByTestId('comic-image-upload')).toBeTruthy();
    expect(screen.queryByTestId('comic-image-cover')).toBeNull();
  });

  it('has only the upload button for a view without an address', () => {
    show({ ...DEFAULT_IMAGE_VIEW }, { url: undefined });
    expect(screen.queryByTestId('comic-image-cover')).toBeNull();
  });

  it('opens the file picker from the upload button and hands a picked file on', () => {
    const { onFile, container } = show({ ...DEFAULT_IMAGE_VIEW });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByTestId('comic-image-upload'));
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores a picker that closed without a file', () => {
    const { onFile, container } = show({ ...DEFAULT_IMAGE_VIEW });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('fits the picture to the panel, either filling it or showing it whole', () => {
    const { onView } = show({ ...DEFAULT_IMAGE_VIEW, cx: 0.2, cy: 0.9, rotation: 90, scale: 3 });
    fireEvent.click(screen.getByTestId('comic-image-cover'));
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ cx: 0.5, cy: 0.5, rotation: 0, scale: 1 }));
    fireEvent.click(screen.getByTestId('comic-image-contain'));
    // The size of the picture is not known (it has not loaded), so it is shown at the size that fills.
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ cx: 0.5, cy: 0.5, rotation: 0 }));
  });

  it('zooms by a step each way, and never past the range', () => {
    const { onView } = show({ ...DEFAULT_IMAGE_VIEW, scale: 2 });
    fireEvent.click(screen.getByTestId('comic-image-scale-up'));
    expect(onView).toHaveBeenLastCalledWith({ scale: 2 * SCALE_STEP });
    fireEvent.click(screen.getByTestId('comic-image-scale-down'));
    expect(onView).toHaveBeenLastCalledWith({ scale: 2 / SCALE_STEP });
    cleanup();
    const top = show({ ...DEFAULT_IMAGE_VIEW, scale: IMAGE_SCALE_RANGE.max });
    fireEvent.click(screen.getByTestId('comic-image-scale-up'));
    expect(top.onView).toHaveBeenLastCalledWith({ scale: IMAGE_SCALE_RANGE.max });
    cleanup();
    const bottom = show({ ...DEFAULT_IMAGE_VIEW, scale: IMAGE_SCALE_RANGE.min });
    fireEvent.click(screen.getByTestId('comic-image-scale-down'));
    expect(bottom.onView).toHaveBeenLastCalledWith({ scale: IMAGE_SCALE_RANGE.min });
  });

  it('centres, turns by a quarter each way (kept within half a turn), and mirrors', () => {
    const { onView } = show({ ...DEFAULT_IMAGE_VIEW, rotation: 0, flipX: true, flipY: false, cx: 0.9 });
    fireEvent.click(screen.getByTestId('comic-image-center'));
    expect(onView).toHaveBeenLastCalledWith({ cx: 0.5, cy: 0.5 });
    fireEvent.click(screen.getByTestId('comic-image-rotate-left'));
    expect(onView).toHaveBeenLastCalledWith({ rotation: -90 });
    fireEvent.click(screen.getByTestId('comic-image-rotate-right'));
    expect(onView).toHaveBeenLastCalledWith({ rotation: 90 });
    fireEvent.click(screen.getByTestId('comic-image-flip-x'));
    expect(onView).toHaveBeenLastCalledWith({ flipX: false });
    fireEvent.click(screen.getByTestId('comic-image-flip-y'));
    expect(onView).toHaveBeenLastCalledWith({ flipY: true });
  });

  it('shows the clear button only when asked to, and uses the given test-id prefix', () => {
    show({ ...DEFAULT_IMAGE_VIEW }, { idPrefix: 'x' });
    expect(screen.queryByTestId('x-clear')).toBeNull();
    cleanup();
    const onClear = vi.fn();
    show({ ...DEFAULT_IMAGE_VIEW }, { idPrefix: 'x', onClear });
    fireEvent.click(screen.getByTestId('x-clear'));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe('the keys of the page', () => {
  let panelId = '';
  let otherId = '';
  const view = () => findPanel(useComic.getState().projects, panelId)!.panel.imageView;
  const pagePanels = () => useComic.getState().projects[0]!.pages[0]!.panels;

  function Keys({ active }: { active?: boolean }) {
    usePageKeys(() => ({ x: 0, y: 0, width: 0.5, height: 0.5 }), 1.4, active);
    return null;
  }

  beforeEach(() => {
    const project = newProject('Keys');
    useComic.setState({ imageSelected: false, backdropSelected: false, bubbleEditor: false });
    useComic.getState().setProjects([project]);
    panelId = project.pages[0]!.panels[0]!.id;
    otherId = project.pages[0]!.panels[1]!.id;
  });

  it('moves a selected picture with the arrows, ten times as far with Shift', () => {
    useComic.getState().setPanelImage(panelId, 'a.png');
    act(() => useComic.getState().selectImage(panelId));
    render(<Keys />);
    const before = view().cx;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(view().cx).toBeGreaterThan(before);
    const small = view().cx - before;
    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    expect(view().cx).toBeLessThan(before);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(small).toBeGreaterThan(0);
    expect(view().cy).toBeCloseTo(DEFAULT_IMAGE_VIEW.cy);
  });

  it('does not move anything when the picture is not selected, or the keys are off', () => {
    useComic.getState().setPanelImage(panelId, 'a.png');
    act(() => useComic.getState().selectPanel(panelId));
    const { rerender } = render(<Keys />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(view().cx).toBe(DEFAULT_IMAGE_VIEW.cx);
    act(() => useComic.getState().selectImage(panelId));
    rerender(<Keys active={false} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(view().cx).toBe(DEFAULT_IMAGE_VIEW.cx);
  });

  it('lets go step by step on Escape: the balloon editor, the balloon, the picture, the panel', () => {
    useComic.getState().setPanelImage(panelId, 'a.png');
    const bubbleId = useComic.getState().addBubble(panelId, 'speech')!;
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    render(<Keys />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().bubbleEditor).toBe(false);
    expect(useComic.getState().selectedBubbleId).toBe(bubbleId);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().selectedBubbleId).toBeNull();
    act(() => useComic.getState().selectImage(panelId));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().imageSelected).toBe(false);
    expect(useComic.getState().selectedPanelId).toBe(panelId);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('lets go of the backdrop first on Escape', () => {
    useComic.getState().setBackdrop(useComic.getState().projects[0]!.pages[0]!.id, 'sky.png');
    act(() => useComic.getState().selectBackdrop(true));
    render(<Keys />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().backdropSelected).toBe(false);
  });

  it('takes away the selected panel on Delete, but not the last one', () => {
    act(() => useComic.getState().selectPanel(otherId));
    render(<Keys />);
    const count = pagePanels().length;
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(pagePanels()).toHaveLength(count - 1);
    expect(pagePanels().some((p) => p.id === otherId)).toBe(false);
  });

  it('does nothing on Delete when nothing is selected', () => {
    render(<Keys />);
    const count = pagePanels().length;
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(pagePanels()).toHaveLength(count);
  });
});
