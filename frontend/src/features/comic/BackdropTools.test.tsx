// @vitest-environment jsdom
// The picture over the whole page: it shows under the panels, its tool popover edits it, its handles drag it, and Escape or
// Delete end or undo the editing.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { setLocale } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { ComicEditor } from './ComicEditor';

const initialGallery = useGallery.getState();
const page = () => useComic.getState().projects[0]!.pages[0]!;

function show(withBackdrop = true) {
  const project = newProject('Backdrop');
  useComic.getState().setProjects([project]);
  if (withBackdrop) useComic.getState().setBackdrop(project.pages[0]!.id, 'sky.png');
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
  useGallery.setState({ ...initialGallery, images: [{ name: 'sky.png', url: 'novira://sky.png' } as ImageDTO] }, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
  useGallery.setState(initialGallery, true);
  useComic.setState({ backdropSelected: false });
});

describe('the backdrop on the page', () => {
  it('shows under the panels when the page has one, and not otherwise, and lets empty panels show it through', () => {
    show();
    expect(screen.getByTestId('comic-backdrop-picture').getAttribute('src')).toBe('novira://sky.png');
    expect(screen.getByTestId('comic-page').className).toContain('has-backdrop');
    cleanup();
    show(false);
    expect(screen.queryByTestId('comic-backdrop-picture')).toBeNull();
    expect(screen.getByTestId('comic-page').className).not.toContain('has-backdrop');
  });

  it('is edited from the tool popover: its buttons change the view and start the editing, and the handles drag it', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    fireEvent.click(await screen.findByTestId('comic-backdrop-scale-up'));
    expect(page().backdrop!.view.scale).toBeCloseTo(1.1);
    expect(useComic.getState().backdropSelected).toBe(true);
    fireEvent.click(screen.getByTestId('comic-backdrop-rotate-right'));
    expect(page().backdrop!.view.rotation).toBe(90);
    fireEvent.click(screen.getByTestId('comic-backdrop-flip-x'));
    expect(page().backdrop!.view.flipX).toBe(true);
    // The handles are over the page now, and the picture itself is dragged by its outline.
    const outline = await screen.findByTestId('comic-picture-handles');
    screen.getByTestId('comic-page').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1414, right: 1000, bottom: 1414, x: 0, y: 0 }) as DOMRect;
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 700 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 700 });
    fireEvent.pointerUp(outline, { pointerId: 1 });
    expect(page().backdrop!.view.cx).toBeCloseTo(0.6);
  });

  it('ends the editing on Escape, and takes the picture off the page on Delete', () => {
    show();
    act(() => useComic.getState().selectBackdrop(true));
    expect(screen.getByTestId('comic-picture-handles')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useComic.getState().backdropSelected).toBe(false);
    expect(screen.queryByTestId('comic-picture-handles')).toBeNull();
    act(() => useComic.getState().selectBackdrop(true));
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(page().backdrop).toBeNull();
  });
});
