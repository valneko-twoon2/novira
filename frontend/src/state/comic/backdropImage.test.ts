// The picture over the page put in by hand: a gallery picture by its name, or a file from the computer uploaded first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { newProject } from './document';
import { putBackdropFile, putBackdropGalleryImage } from './backdropImage';
import { useComic } from './store';

const image = (name: string) => ({ name, url: `/novira-image/${name}` }) as ImageDTO;

function seed() {
  const project = newProject('P');
  useComic.setState({ projects: [project], activeProjectId: project.id, activePageId: null, backdropSelected: false });
  return project.pages[0]!.id;
}

const backdrop = () => useComic.getState().projects[0]!.pages[0]!.backdrop;

beforeEach(() => {
  useGallery.setState({ images: [image('a.png')] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('putting a gallery picture over the page', () => {
  it('puts the first name over the page and selects the picture', () => {
    const id = seed();
    expect(putBackdropGalleryImage(id, ['a.png', 'missing.png'])).toBe(true);
    expect(backdrop()).toMatchObject({ imageName: 'a.png' });
    expect(useComic.getState().backdropSelected).toBe(true);
  });

  it('does nothing when no name is in the gallery', () => {
    const id = seed();
    expect(putBackdropGalleryImage(id, ['missing.png'])).toBe(false);
    expect(backdrop()).toBeNull();
    expect(useComic.getState().backdropSelected).toBe(false);
  });

  it('does nothing without any name', () => {
    const id = seed();
    expect(putBackdropGalleryImage(id, [])).toBe(false);
    expect(backdrop()).toBeNull();
  });
});

describe('putting a file from the computer over the page', () => {
  it('uploads it to the gallery first, then puts it over the page', async () => {
    const id = seed();
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(image('new.png'));
    await putBackdropFile(id, new File(['x'], 'new.png', { type: 'image/png' }));
    expect(upload).toHaveBeenCalledOnce();
    expect(useGallery.getState().images.map((i) => i.name)).toContain('new.png');
    expect(backdrop()).toMatchObject({ imageName: 'new.png' });
    expect(useComic.getState().backdropSelected).toBe(true);
  });

  it('puts nothing over the page when the upload fails', async () => {
    const id = seed();
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    await expect(putBackdropFile(id, new File(['x'], 'new.png', { type: 'image/png' }))).rejects.toThrow('disk full');
    expect(backdrop()).toBeNull();
  });
});
