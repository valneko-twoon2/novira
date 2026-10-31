// @vitest-environment jsdom
// The picture over the whole page: it shows under the panels, its tool popover edits it, its handles drag it, and Escape or
// Delete end or undo the editing.
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { setLocale } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
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

/** Drops names or files on the backdrop popover's drop zone. */
function dropOnPopover(data: { names?: string[]; files?: File[] }) {
  const zone = screen.getByTestId('comic-backdrop-pop').closest('.comic-backdrop')!;
  const event = createEvent.drop(zone);
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: data.names ? [IMAGE_MIME] : ['Files'],
      files: data.files ?? [],
      getData: (mime: string) => (mime === IMAGE_MIME && data.names ? JSON.stringify(data.names) : ''),
    },
  });
  fireEvent(zone, event);
}

describe('putting a picture in from the popover', () => {
  beforeEach(() => useToasts.setState({ toasts: [] }));

  it('shows no edit or reset button while the page has no backdrop', async () => {
    show(false);
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    await screen.findByTestId('comic-backdrop-pop');
    expect(screen.queryByTestId('comic-backdrop-edit')).toBeNull();
    expect(screen.queryByTestId('comic-backdrop-reset')).toBeNull();
    expect(screen.queryByTestId('comic-backdrop-clear')).toBeNull();
  });

  it('puts a gallery picture dropped on the popover over the page, and selects it', async () => {
    show(false);
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    await screen.findByTestId('comic-backdrop-pop');
    dropOnPopover({ names: ['sky.png'] });
    await waitFor(() => expect(page().backdrop).toMatchObject({ imageName: 'sky.png' }));
    expect(useComic.getState().backdropSelected).toBe(true);
  });

  it('tells the user when the dropped picture is not in the gallery', async () => {
    show(false);
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    await screen.findByTestId('comic-backdrop-pop');
    dropOnPopover({ names: ['gone.png'] });
    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1));
    expect(useToasts.getState().toasts[0]!.status).toBe('error');
    expect(page().backdrop).toBeNull();
  });

  it('uploads a dropped file, and reports a failed upload', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValueOnce({ name: 'up.png', url: 'novira://up.png' } as ImageDTO);
    show(false);
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    await screen.findByTestId('comic-backdrop-pop');
    dropOnPopover({ files: [new File(['x'], 'up.png', { type: 'image/png' })] });
    await waitFor(() => expect(page().backdrop).toMatchObject({ imageName: 'up.png' }));
    upload.mockRejectedValueOnce(new Error('disk full'));
    dropOnPopover({ files: [new File(['x'], 'b.png', { type: 'image/png' })] });
    await waitFor(() => expect(useToasts.getState().toasts.some((x) => x.description === 'disk full')).toBe(true));
    expect(page().backdrop).toMatchObject({ imageName: 'up.png' });
    upload.mockRestore();
  });

  it('uploads a file picked with the upload button of the tools', async () => {
    vi.spyOn(backend, 'uploadImage').mockResolvedValueOnce({ name: 'picked.png', url: 'novira://picked.png' } as ImageDTO);
    show(false);
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    await screen.findByTestId('comic-backdrop-pop');
    const input = screen.getByTestId('comic-backdrop-tools').querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'picked.png', { type: 'image/png' })] } });
    await waitFor(() => expect(page().backdrop).toMatchObject({ imageName: 'picked.png' }));
    vi.restoreAllMocks();
  });
});

describe('editing and clearing from the popover', () => {
  beforeEach(() => useToasts.setState({ toasts: [] }));

  it('toggles the editing with the edit button', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    const edit = await screen.findByTestId('comic-backdrop-edit');
    expect(edit.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(edit);
    expect(useComic.getState().backdropSelected).toBe(true);
    expect(edit.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(edit);
    expect(useComic.getState().backdropSelected).toBe(false);
  });

  it('takes the picture off the page with the clear button, and the notice puts it back', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-backdrop'));
    fireEvent.click(await screen.findByTestId('comic-backdrop-clear'));
    expect(page().backdrop).toBeNull();
    const notice = useToasts.getState().toasts[0]!;
    act(() => notice.actions![0]!.run());
    expect(page().backdrop).toMatchObject({ imageName: 'sky.png' });
  });
});
