// @vitest-environment jsdom
// The picture history of the selected panel: the picture it has now and its earlier ones, which put themselves back when
// pressed and leave the list (not the gallery) when removed. A picture the gallery no longer has is not offered.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { setLocale } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { findPanel, useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { PanelTakes } from './PanelTakes';

const image = (name: string): ImageDTO => ({ name, url: `/img/${name}`, thumbnailUrl: `/thumb/${name}`, width: 64, height: 64, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null });

const panel = () => findPanel(useComic.getState().projects, 'panel-0')!.panel;

function show() {
  return render(
    <TooltipProvider>
      <PanelTakes panel={panel()} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  setLocale('en');
  const project = newProject('P');
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, id: 'panel-0' }];
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
  useComic.getState().setProjects([project]);
  useGallery.setState({ images: ['a.png', 'b.png', 'c.png'].map(image) });
  for (const name of ['a.png', 'b.png', 'c.png']) useComic.getState().setPanelImage('panel-0', name);
});
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('PanelTakes', () => {
  it('shows the picture of the panel and the earlier ones, newest first', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-takes'));
    expect((await screen.findByTestId('comic-take-now')).querySelector('img')!.getAttribute('src')).toBe('/thumb/c.png');
    expect(screen.getAllByTestId('comic-take').map((b) => b.querySelector('img')!.getAttribute('src'))).toEqual(['/thumb/b.png', '/thumb/a.png']);
  });

  it('puts an earlier picture back when it is pressed', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-takes'));
    fireEvent.click((await screen.findAllByTestId('comic-take'))[1]!);
    expect(panel().imageName).toBe('a.png');
    expect(panel().takes.map((t) => t.imageName)).toEqual(['c.png', 'b.png']);
  });

  it('removes a picture from the list and leaves it in the gallery', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-takes'));
    fireEvent.click((await screen.findAllByTestId('comic-take-remove'))[0]!);
    expect(panel().takes.map((t) => t.imageName)).toEqual(['a.png']);
    expect(useGallery.getState().images.map((i) => i.name)).toContain('b.png');
  });

  it('leaves out a picture the gallery no longer has, and says what the list is for when it is empty', async () => {
    useGallery.setState({ images: [image('c.png')] });
    show();
    fireEvent.click(screen.getByTestId('comic-takes'));
    expect(await screen.findByTestId('comic-take-now')).toBeTruthy();
    expect(screen.queryAllByTestId('comic-take')).toHaveLength(0);
    expect(screen.getByText(/the earlier one stays here/)).toBeTruthy();
  });
});
