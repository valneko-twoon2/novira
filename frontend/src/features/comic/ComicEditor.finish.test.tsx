// @vitest-environment jsdom
// The page view's stacking buttons, the reset menu, the finishing effect, and who wins a press on a selected picture of a
// free page: the panel (carried), or the picture (outside the panel, or with Alt).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { setLocale, t } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { shapeCentre } from '@/state/comic/freeShapes';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { ComicEditor } from './ComicEditor';

const initialGallery = useGallery.getState();
const page = () => useComic.getState().projects[0]!.pages[0]!;

function show() {
  const project = newProject('Finish');
  useComic.getState().setProjects([project]);
  return render(
    <TooltipProvider>
      <ComicEditor />
    </TooltipProvider>,
  );
}

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setLocale('en');
  useGallery.setState({ ...initialGallery, images: [{ name: 'a.png', url: 'novira://a.png' } as ImageDTO] }, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
  useGallery.setState(initialGallery, true);
  useComic.setState({ selectedPanelId: null, imageSelected: false });
});

describe('the stacking buttons', () => {
  it('appear for a selected panel of a free page and move it in the stack', () => {
    show();
    const id = page().id;
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    expect(screen.queryByTestId('comic-order-front')).toBeNull();
    act(() => useComic.getState().setPageFree(id, true));
    const first = page().panels[0]!.id;
    expect((screen.getByTestId('comic-order-back') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('comic-order-front'));
    expect(page().panels.at(-1)!.id).toBe(first);
    expect((screen.getByTestId('comic-order-front') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the reset menu', () => {
  it('puts back a picture view by part, and everything at once', async () => {
    show();
    const panelId = page().panels[0]!.id;
    act(() => {
      useComic.getState().setPanelImage(panelId, 'a.png');
      useComic.getState().setPanelImageView(panelId, { scale: 2, rotation: 30, cx: 0.9 });
      useComic.getState().selectPanel(panelId);
    });
    fireEvent.pointerDown(screen.getByTestId('comic-reset'), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('comic.reset.imageRotation') }));
    expect(page().panels[0]!.imageView).toMatchObject({ rotation: 0, scale: 2, cx: 0.9 });
    fireEvent.pointerDown(screen.getByTestId('comic-reset'), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('comic.reset.all') }));
    expect(page().panels[0]!.imageView).toMatchObject({ rotation: 0, scale: 1, cx: 0.5 });
  });

  it('offers the panel parts only on a free page', () => {
    show();
    const panelId = page().panels[0]!.id;
    act(() => useComic.getState().selectPanel(panelId));
    expect(screen.queryByTestId('comic-reset')).toBeNull();
  });
});

describe('the finishing effect on the page', () => {
  it('filters the page and, for the e-book, lays its paper over it', () => {
    show();
    const crop = () => document.querySelector<HTMLElement>('.comic-page__crop')!;
    expect(crop().style.filter).toBe('');
    act(() => useComic.getState().setProjectEffect('mono'));
    expect(crop().style.filter).toContain('grayscale');
    expect(document.querySelector('.comic-page__paper')).toBeNull();
    act(() => useComic.getState().setPageEffect(page().id, 'ebook'));
    expect(document.querySelector('.comic-page__paper')).not.toBeNull();
  });
});

describe('a press on the selected picture of a free page', () => {
  function setup() {
    show();
    const id = page().id;
    act(() => useComic.getState().setPageFree(id, true));
    const panelId = page().panels[1]!.id;
    act(() => {
      useComic.getState().setPanelImage(panelId, 'a.png');
      useComic.getState().setPanelImageView(panelId, { scale: 2 });
      useComic.getState().selectImage(panelId);
    });
    screen.getByTestId('comic-page').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0 }) as DOMRect;
    const shape = page().shapes![1]!;
    const c = shapeCentre(shape);
    const width = Math.max(...shape.map((p) => p.x)) - Math.min(...shape.map((p) => p.x));
    return { shape, c, width, outline: screen.getByTestId('comic-picture-handles') };
  }

  it('carries the panel when it lands inside the panel', () => {
    const { shape, c, outline } = setup();
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: c.x * 1000, clientY: c.y * 1000 });
    fireEvent.pointerMove(outline, { pointerId: 1, buttons: 1, clientX: c.x * 1000 - 40, clientY: c.y * 1000 });
    fireEvent.pointerUp(outline, { pointerId: 1 });
    expect(page().shapes![1]![0]!.x).toBeCloseTo(shape[0]!.x - 0.04);
    expect(page().panels[1]!.imageView.cx).toBe(0.5);
  });

  it('moves the picture instead when Alt is held, or when it lands outside the panel', () => {
    const { shape, c, width, outline } = setup();
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: c.x * 1000, clientY: c.y * 1000, altKey: true });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: c.x * 1000 + 100, clientY: c.y * 1000 });
    fireEvent.pointerUp(outline, { pointerId: 1 });
    expect(page().panels[1]!.imageView.cx).not.toBe(0.5);
    expect(page().shapes![1]![0]!.x).toBeCloseTo(shape[0]!.x);
    const before = page().panels[1]!.imageView.cx;
    const x = (c.x + width * 0.75) * 1000;
    fireEvent.pointerDown(outline, { pointerId: 2, clientX: x, clientY: c.y * 1000 });
    fireEvent.pointerMove(outline, { pointerId: 2, clientX: x - 100, clientY: c.y * 1000 });
    fireEvent.pointerUp(outline, { pointerId: 2 });
    expect(page().panels[1]!.imageView.cx).not.toBe(before);
    expect(page().shapes![1]![0]!.x).toBeCloseTo(shape[0]!.x);
  });
});

describe('the blank parts of the page', () => {
  it('let go of the selection when the paper outside the panels is pressed', () => {
    show();
    const id = page().panels[0]!.id;
    act(() => useComic.getState().selectPanel(id));
    fireEvent.pointerDown(document.querySelector('.comic-page__drop')!);
    expect(useComic.getState().selectedPanelId).toBeNull();
    act(() => useComic.getState().selectPanel(id));
  });
});
