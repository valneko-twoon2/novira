// @vitest-environment jsdom
// A picture dropped on the paper (not on a panel) becomes the page's backdrop: the overlay shows while one is dragged over,
// and the drop takes a gallery picture or a file.
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { setLocale } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { PageDropLayer } from './PageDropLayer';

const backdrop = () => useComic.getState().projects[0]!.pages[0]!.backdrop;

function seed() {
  const project = newProject('Drop');
  useComic.getState().setProjects([project]);
  return render(
    <PageDropLayer pageId={project.pages[0]!.id}>
      <div data-testid="paper">paper</div>
      <div className="comic-panel-drop">
        <span data-testid="in-panel">panel</span>
      </div>
    </PageDropLayer>,
  );
}

/** Fires a drag event carrying the given data on an element. */
function drag(type: 'dragOver' | 'dragEnter' | 'dragLeave' | 'drop', el: Element, data: { types?: string[]; names?: string[]; files?: File[]; relatedTarget?: Element }) {
  const event = createEvent[type](el);
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: data.types ?? [],
      files: data.files ?? [],
      dropEffect: 'none',
      getData: (mime: string) => (mime === IMAGE_MIME && data.names ? JSON.stringify(data.names) : ''),
    },
  });
  if (data.relatedTarget) Object.defineProperty(event, 'relatedTarget', { value: data.relatedTarget });
  fireEvent(el, event);
  return event;
}

beforeEach(() => {
  setLocale('en');
  useToasts.setState({ toasts: [] });
  useGallery.setState({ images: [{ name: 'sky.png', url: 'novira://sky.png' } as ImageDTO] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLocale('ja');
});

describe('dragging over the paper', () => {
  it('shows the overlay for a picture drag, and takes the drag as a copy', () => {
    seed();
    const event = drag('dragOver', screen.getByTestId('paper'), { types: [IMAGE_MIME] });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('comic-backdrop-drop')).toBeTruthy();
  });

  it('shows nothing for a drag that is not a picture', () => {
    seed();
    const event = drag('dragEnter', screen.getByTestId('paper'), { types: ['text/plain'] });
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByTestId('comic-backdrop-drop')).toBeNull();
  });

  it('leaves a panel its own drop: the overlay goes when the drag moves onto one', () => {
    seed();
    drag('dragOver', screen.getByTestId('paper'), { types: [IMAGE_MIME] });
    expect(screen.getByTestId('comic-backdrop-drop')).toBeTruthy();
    const event = drag('dragOver', screen.getByTestId('in-panel'), { types: [IMAGE_MIME] });
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByTestId('comic-backdrop-drop')).toBeNull();
  });

  it('hides the overlay when the drag leaves the layer, but not when it moves inside', () => {
    seed();
    const paper = screen.getByTestId('paper');
    drag('dragOver', paper, { types: [IMAGE_MIME] });
    drag('dragLeave', paper, { relatedTarget: screen.getByTestId('in-panel') });
    expect(screen.getByTestId('comic-backdrop-drop')).toBeTruthy();
    drag('dragLeave', paper, { relatedTarget: document.body });
    expect(screen.queryByTestId('comic-backdrop-drop')).toBeNull();
  });
});

describe('dropping on the paper', () => {
  it('puts a dropped gallery picture over the page', async () => {
    seed();
    const paper = screen.getByTestId('paper');
    drag('dragOver', paper, { types: [IMAGE_MIME] });
    const event = drag('drop', paper, { types: [IMAGE_MIME], names: ['sky.png'] });
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(backdrop()).toMatchObject({ imageName: 'sky.png' }));
    expect(screen.queryByTestId('comic-backdrop-drop')).toBeNull();
  });

  it('tells the user when the dropped picture is not in the gallery', async () => {
    seed();
    drag('drop', screen.getByTestId('paper'), { types: [IMAGE_MIME], names: ['gone.png'] });
    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1));
    expect(useToasts.getState().toasts[0]!.status).toBe('error');
    expect(backdrop()).toBeNull();
  });

  it('uploads a dropped image file, and ignores files that are not images', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'up.png', url: 'novira://up.png' } as ImageDTO);
    seed();
    const paper = screen.getByTestId('paper');
    drag('drop', paper, { types: ['Files'], files: [new File(['x'], 'a.txt', { type: 'text/plain' })] });
    await Promise.resolve();
    expect(upload).not.toHaveBeenCalled();
    drag('drop', paper, { types: ['Files'], files: [new File(['x'], 'up.png', { type: 'image/png' })] });
    await waitFor(() => expect(backdrop()).toMatchObject({ imageName: 'up.png' }));
    expect(upload).toHaveBeenCalledOnce();
  });

  it('reports a failed upload as a toast and leaves the page alone', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    seed();
    drag('drop', screen.getByTestId('paper'), { types: ['Files'], files: [new File(['x'], 'up.png', { type: 'image/png' })] });
    await waitFor(() => expect(useToasts.getState().toasts[0]?.description).toBe('disk full'));
    expect(backdrop()).toBeNull();
  });

  it('does not take a drop that lands on a panel', async () => {
    seed();
    const event = drag('drop', screen.getByTestId('in-panel'), { types: [IMAGE_MIME], names: ['sky.png'] });
    expect(event.defaultPrevented).toBe(false);
    await Promise.resolve();
    expect(backdrop()).toBeNull();
  });
});
