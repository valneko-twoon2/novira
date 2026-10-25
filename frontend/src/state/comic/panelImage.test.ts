import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { emptyPage, newProject } from './document';
import { putGalleryImage } from './panelImage';
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
