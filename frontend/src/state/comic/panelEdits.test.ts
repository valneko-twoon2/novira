import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_VIEW, newProject, type ComicPoint } from './document';
import { findPanel, useComic } from './store';

const joints: ComicPoint[] = Array.from({ length: 18 }, () => ({ x: 0.5, y: 0.5 }));

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
}

/** A project with a page of four panels, the first one open and selected, each panel named by its prompt. */
function seed() {
  const project = newProject('P');
  const blank = project.pages[0]!.panels[0]!;
  project.pages[0]!.panels = Array.from({ length: 4 }, (_, i) => ({ ...blank, id: `panel-${i}`, prompt: `prompt ${i}` }));
  useComic.getState().setProjects([project]);
  return project.pages[0]!;
}

beforeEach(reset);

describe('swapping panels on a page', () => {
  it('swaps two panels by their positions and leaves the others in place', () => {
    const page = seed();
    useComic.getState().swapPanels(page.id, 0, 2);
    const panels = useComic.getState().projects[0]!.pages[0]!.panels;
    expect(panels.map((p) => p.prompt)).toEqual(['prompt 2', 'prompt 1', 'prompt 0', 'prompt 3']);
  });

  it('does nothing for the same position or a position off the page', () => {
    const page = seed();
    const before = useComic.getState().projects;
    useComic.getState().swapPanels(page.id, 1, 1);
    useComic.getState().swapPanels(page.id, 0, 9);
    expect(useComic.getState().projects).toBe(before);
  });
});

describe('the negative prompt of a panel', () => {
  it('sets the panel negative prompt and leaves the others alone', () => {
    seed();
    useComic.getState().setPanelNegative('panel-1', 'text, watermark');
    const panels = useComic.getState().projects[0]!.pages[0]!.panels;
    expect(panels[1]!.negativePrompt).toBe('text, watermark');
    expect(panels[0]!.negativePrompt).toBe('');
  });
});

describe('the picture of a panel: moving, resizing and turning it', () => {
  it('changes the fields given and keeps the rest', () => {
    seed();
    useComic.getState().setPanelImageView('panel-0', { scale: 2 });
    useComic.getState().setPanelImageView('panel-0', { cx: 0.2, rotation: 30, flipX: true });
    expect(findPanel(useComic.getState().projects, 'panel-0')!.panel.imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, cx: 0.2, scale: 2, rotation: 30, flipX: true });
  });

  it('keeps the view within its range: the scale, the centre near the panel, the angle within a turn', () => {
    seed();
    useComic.getState().setPanelImageView('panel-0', { cx: 3, cy: -2, scale: 10, rotation: 450 });
    expect(findPanel(useComic.getState().projects, 'panel-0')!.panel.imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, cx: 2, cy: -1, scale: 8, rotation: 90 });
  });

  it('selects the picture with its panel, and lets go of it when the panel or a balloon is selected', () => {
    seed();
    useComic.getState().selectImage('panel-0');
    expect(useComic.getState()).toMatchObject({ selectedPanelId: 'panel-0', imageSelected: true, selectedBubbleId: null });
    useComic.getState().selectPanel('panel-0');
    expect(useComic.getState().imageSelected).toBe(false);
    useComic.getState().selectImage('panel-0');
    useComic.getState().selectBubble('bubble-x');
    expect(useComic.getState().imageSelected).toBe(false);
  });

  it('starts a new picture as it covers the panel, but keeps the view when the same picture is set again', () => {
    seed();
    useComic.getState().setPanelImage('panel-0', 'first.png');
    useComic.getState().setPanelImageView('panel-0', { scale: 3, cx: 0 });
    useComic.getState().setPanelImage('panel-0', 'first.png');
    expect(findPanel(useComic.getState().projects, 'panel-0')!.panel.imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, cx: 0, scale: 3 });
    useComic.getState().setPanelImage('panel-0', 'second.png');
    expect(findPanel(useComic.getState().projects, 'panel-0')!.panel.imageView).toEqual(DEFAULT_IMAGE_VIEW);
  });
});

describe('the frame of a page', () => {
  it('starts with a thin line and no space between it and the picture', () => {
    const page = seed();
    expect(page).toMatchObject({ frameMm: 0.6, insetMm: 0, marginMm: 0 });
  });

  it('is set for the whole page, within its range', () => {
    const page = seed();
    useComic.getState().setPageLayout(page.id, { frameMm: 1.5, insetMm: 3 });
    expect(useComic.getState().projects[0]!.pages[0]).toMatchObject({ frameMm: 1.5, insetMm: 3 });
    useComic.getState().setPageLayout(page.id, { frameMm: 99, insetMm: -4 });
    expect(useComic.getState().projects[0]!.pages[0]).toMatchObject({ frameMm: 3, insetMm: 0 });
  });

  it('is taken back by undo', () => {
    const page = seed();
    useComic.getState().setPageLayout(page.id, { frameMm: 2 });
    useComic.getState().undo();
    expect(useComic.getState().projects[0]!.pages[0]!.frameMm).toBe(0.6);
  });

  it('is kept when the layout is applied', () => {
    const page = seed();
    useComic.getState().setPageLayout(page.id, { frameMm: 2, insetMm: 1 });
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'rtl', size: 'A4' });
    expect(useComic.getState().projects[0]!.pages[0]).toMatchObject({ frameMm: 2, insetMm: 1 });
  });
});

describe('panel templates', () => {
  it('saves a panel as a template and puts it into another panel, with new balloons and the picture kept', () => {
    seed();
    useComic.getState().setPrompt('panel-0', 'a hero');
    useComic.getState().setPanelNegative('panel-0', 'blur');
    useComic.getState().setPanelPose('panel-0', [joints], 'pose.png');
    const bubble = useComic.getState().addBubble('panel-0', 'shout');
    useComic.getState().updateBubble('panel-0', bubble!, { text: 'Go!' });
    const templateId = useComic.getState().savePanelTemplate('panel-0', 'Hero')!;

    useComic.getState().setPanelImage('panel-2', 'keep.png');
    useComic.getState().applyPanelTemplate('panel-2', templateId);

    const target = findPanel(useComic.getState().projects, 'panel-2')!.panel;
    expect(target).toMatchObject({ prompt: 'a hero', negativePrompt: 'blur', poseImageName: 'pose.png', imageName: 'keep.png' });
    expect(target.poses).toEqual([joints]);
    expect(target.bubbles).toHaveLength(1);
    expect(target.bubbles[0]).toMatchObject({ kind: 'shout', text: 'Go!' });
    // A balloon is its own copy: a template applied twice gives two balloons with different ids.
    expect(target.bubbles[0]!.id).not.toBe(findPanel(useComic.getState().projects, 'panel-0')!.panel.bubbles[0]!.id);
    useComic.getState().applyPanelTemplate('panel-3', templateId);
    expect(findPanel(useComic.getState().projects, 'panel-3')!.panel.bubbles[0]!.id).not.toBe(target.bubbles[0]!.id);
  });

  it('deletes a template of the project', () => {
    seed();
    const id = useComic.getState().savePanelTemplate('panel-0', 'Hero')!;
    useComic.getState().deletePanelTemplate(id);
    expect(useComic.getState().projects[0]!.panelTemplates).toEqual([]);
  });

  it('does not save a template for a panel that is not there, nor apply a template that is not there', () => {
    seed();
    expect(useComic.getState().savePanelTemplate('missing', 'x')).toBeNull();
    useComic.getState().applyPanelTemplate('panel-0', 'no-such-template');
    expect(findPanel(useComic.getState().projects, 'panel-0')!.panel.prompt).toBe('prompt 0');
  });
});

describe('page templates', () => {
  it('saves the layout of a page and applies a layout to another page', () => {
    const page = seed();
    useComic.getState().setPageLayout(page.id, { columns: 3, direction: 'ltr' });
    const id = useComic.getState().savePageTemplate(page.id, 'Three')!;
    expect(useComic.getState().projects[0]!.pageTemplates).toEqual([{ id, name: 'Three', panelCount: 4, columns: 3, direction: 'ltr', size: 'A4', shapes: null }]);

    useComic.getState().addPage();
    const second = useComic.getState().projects[0]!.pages[1]!.id;
    useComic.getState().applyPageLayout(second, { panelCount: 2, columns: 1, direction: 'rtl', size: 'A4' });
    expect(useComic.getState().projects[0]!.pages[1]).toMatchObject({ columns: 1, direction: 'rtl' });
    expect(useComic.getState().projects[0]!.pages[1]!.panels).toHaveLength(2);
  });

  it('drops the panels at the end when a layout has fewer, and clears the selection of a dropped one', () => {
    const page = seed();
    useComic.getState().selectPanel('panel-3');
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'rtl', size: 'A4' });
    const panels = useComic.getState().projects[0]!.pages[0]!.panels;
    expect(panels.map((p) => p.id)).toEqual(['panel-0', 'panel-1']);
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('deletes a saved page layout', () => {
    const page = seed();
    const id = useComic.getState().savePageTemplate(page.id, 'Four')!;
    useComic.getState().deletePageTemplate(id);
    expect(useComic.getState().projects[0]!.pageTemplates).toEqual([]);
  });
});
