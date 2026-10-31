import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { setLocale } from '@/i18n';
import { useToasts } from '@/state/toasts';
import { useGallery } from '@/state/gallery';
import { emptyPage, newProject } from './document';
import { putFileImage, putGalleryImage, reportImageFailure } from './panelImage';
import { findPanel, useComic } from './store';

let panelId = '';

beforeEach(() => {
  useGallery.setState({ images: [{ name: 'pic.png', url: 'novira://pic.png' } as ImageDTO] });
  const project = newProject('A');
  project.pages = [emptyPage(1)];
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.setState({
    projects: [project],
    activeProjectId: project.id,
    activePageId: project.pages[0]!.id,
    selectedPanelId: null,
    selectedBubbleId: null,
    pending: {},
  });
});

const imageOf = () => findPanel(useComic.getState().projects, panelId)!.panel.imageName;

describe('putting a gallery picture into a panel', () => {
  it('makes the named gallery picture the picture of the panel', () => {
    expect(putGalleryImage(panelId, ['pic.png'])).toBe(true);
    expect(imageOf()).toBe('pic.png');
  });

  it('takes the first picture of a drop that holds several', () => {
    expect(putGalleryImage(panelId, ['pic.png', 'other.png'])).toBe(true);
    expect(imageOf()).toBe('pic.png');
  });

  it('leaves the panel alone when the picture is not in the gallery', () => {
    expect(putGalleryImage(panelId, ['gone.png'])).toBe(false);
    expect(imageOf()).toBeNull();
  });
});

describe('putting a file from the computer into a panel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uploads it to the gallery first, then makes it the picture of the panel', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'up.png', url: 'novira://up.png' } as ImageDTO);
    await putFileImage(panelId, new File(['x'], 'up.png', { type: 'image/png' }));
    expect(upload).toHaveBeenCalledOnce();
    expect(useGallery.getState().images.map((i) => i.name)).toContain('up.png');
    expect(imageOf()).toBe('up.png');
  });

  it('leaves the panel alone when the upload fails', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    await expect(putFileImage(panelId, new File(['x'], 'up.png'))).rejects.toThrow('disk full');
    expect(imageOf()).toBeNull();
  });
});

describe('reporting a failed picture', () => {
  beforeEach(() => {
    setLocale('en');
    useToasts.setState({ toasts: [] });
  });
  afterEach(() => setLocale('ja'));

  it('toasts an error with the message of an Error, and the text of anything else', () => {
    reportImageFailure(new Error('too big'));
    reportImageFailure('plain text');
    const toasts = useToasts.getState().toasts;
    expect(toasts.map((x) => x.description)).toEqual(['too big', 'plain text']);
    expect(toasts.every((x) => x.status === 'error')).toBe(true);
  });
});
