// @vitest-environment jsdom
// The comic screen's three columns: the left one holds the drawing form and the planning forms as two tabs, the middle one only
// the page, and there is no row of stages. Painting on the page puts the Canvas's parts on the page's own store: the switch
// starts painting, Escape and a slot row go back to the page, a raster row starts painting again, and Ctrl+Z belongs
// to the page's layers meanwhile.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { isSlot } from '@/state/canvas';
import { newProject } from '@/state/comic/document';
import { pageCanvasStore, resetPageCanvases } from '@/state/comic/pageCanvas';
import { usePagePaint } from '@/state/comic/paintMode';
import { useComicSideTab } from '@/state/comic/sideTab';
import { activePage, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { ComicWorkspace } from './ComicWorkspace';

let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  canvases = installRecordingCanvases();
  resetPageCanvases();
  usePagePaint.setState({ painting: false });
  useComicSideTab.setState({ right: 'assistant' });
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useComic.getState().setProjects([newProject('Rain')]);
});
afterEach(() => {
  cleanup();
  canvases.restore();
  resetPageCanvases();
  vi.unstubAllGlobals();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

const mount = () =>
  render(
    <TooltipProvider>
      <ComicWorkspace />
    </TooltipProvider>,
  );

describe('the comic screen', () => {
  it('starts on the drawing form, with the page in the middle and no stage bar', () => {
    mount();
    expect(screen.getByTestId('parameters-panel')).toBeTruthy();
    expect(screen.getByTestId('invoke-button')).toBeTruthy();
    expect(screen.getByTestId('comic-editor')).toBeTruthy();
  });
});

describe('painting on the page', () => {
  const page = () => activePage(useComic.getState())!;
  const rows = () => within(screen.getByTestId('canvas-layers')).getAllByTestId('canvas-entity');
  const rowOf = (text: string) => rows().find((r) => r.textContent?.includes(text))!.querySelector('.canvas-entity__row')!;

  it('switches to painting with the layers panel, and back with Escape', () => {
    mount();
    expect(screen.getByTestId('comic-delete')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    expect(screen.getByTestId('comic-paint')).toBeTruthy();
    expect(screen.getByTestId('canvas-paint-tools')).toBeTruthy();
    // The painting tools and the box tool for inpainting; no pose or view tool.
    expect(screen.getByTestId('canvas-tool-bbox')).toBeTruthy();
    expect(screen.queryByTestId('canvas-tool-pose')).toBeNull();
    expect(screen.queryByTestId('canvas-tool-view')).toBeNull();
    expect(screen.queryByTestId('comic-delete')).toBeNull();
    // A new raster layer over the balloons and the panels, drawn by the paint stage in the page's stack.
    expect(rows()).toHaveLength(3);
    expect(screen.getByTestId('canvas-embedded-content')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('comic-paint')).toBeNull();
    expect(screen.getByTestId('comic-delete')).toBeTruthy();
  });

  it('follows the layers panel: a slot row goes back to the page, a raster row paints again', () => {
    mount();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    fireEvent.click(rowOf(t('comic.layers.panels')));
    expect(usePagePaint.getState().painting).toBe(false);
    expect(screen.queryByTestId('comic-paint')).toBeNull();
    const raster = rows()[0]!.querySelector('.canvas-entity__row')!;
    fireEvent.click(raster);
    expect(usePagePaint.getState().painting).toBe(true);
    expect(screen.getByTestId('comic-paint')).toBeTruthy();
  });

  it('gives Ctrl+Z to the page layers while painting, and to the comic otherwise', () => {
    mount();
    act(() => useComic.getState().setPanelCount(page().id, page().panels.length + 1));
    expect(useComic.getState().past).toHaveLength(1);
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    const store = pageCanvasStore(page().id)!;
    expect(store.getState().entities.filter((e) => !isSlot(e))).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(store.getState().entities.filter((e) => !isSlot(e))).toHaveLength(0);
    expect(useComic.getState().past).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useComic.getState().past).toHaveLength(0);
  });

  it('paints on an inpaint mask without leaving paint mode, and Escape discards a waiting result before it leaves', () => {
    mount();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    const store = pageCanvasStore(page().id)!;
    let maskId = '';
    act(() => {
      maskId = store.getState().addEntity('inpaint');
      store.getState().select(maskId);
    });
    expect(usePagePaint.getState().painting).toBe(true);
    expect(screen.getByTestId('comic-inpaint-run')).toBeTruthy();
    expect(screen.queryByTestId('canvas-staging')).toBeNull();
    act(() => store.getState().addStagedImage('result.png'));
    expect(screen.getByTestId('canvas-staging')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(store.getState().stagedImageNames).toEqual([]);
    expect(usePagePaint.getState().painting).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(usePagePaint.getState().painting).toBe(false);
  });

  it('accepts a staged result into a new raster layer of the page', () => {
    mount();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    const store = pageCanvasStore(page().id)!;
    useGallery.getState().addImage({ name: 'result.png', url: 'blob:result', width: 512, height: 512, isIntermediate: true } as ImageDTO);
    const before = store.getState().entities.filter((e) => e.type === 'raster').length;
    act(() => store.getState().addStagedImage('result.png'));
    fireEvent.click(screen.getByTestId('canvas-staging-accept'));
    expect(store.getState().stagedImageNames).toEqual([]);
    const rasters = store.getState().entities.filter((e) => e.type === 'raster');
    expect(rasters).toHaveLength(before + 1);
    expect(rasters.some((e) => e.objects.some((o) => o.kind === 'image' && o.imageName === 'result.png'))).toBe(true);
  });

  it('stops painting on another page', () => {
    mount();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    act(() => {
      useComic.getState().addPage();
    });
    expect(usePagePaint.getState().painting).toBe(false);
    expect(screen.queryByTestId('comic-paint')).toBeNull();
  });
});
