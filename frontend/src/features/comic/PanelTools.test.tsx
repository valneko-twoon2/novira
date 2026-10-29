// @vitest-environment jsdom
// The selected panel's tool popovers: balloons, pose (editor, ready-made, 3D rough), note and panel templates.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { setLocale, t } from '@/i18n';
import { newProject, PANEL_NOTE_MAX } from '@/state/comic/document';
import { putPosePreset } from '@/state/comic/posePreset';
import { findPanel, useComic } from '@/state/comic/store';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useGallery } from '@/state/gallery';
import { POSE_CATEGORIES } from '@/state/pose/posePresets';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { BALLOON_PRESETS } from './BalloonPreview';
import { PanelTools } from './PanelTools';

vi.mock('@/state/comic/posePreset', async (orig) => ({ ...(await orig<typeof import('@/state/comic/posePreset')>()), putPosePreset: vi.fn(async () => true) }));
vi.mock('./rough/RoughDialog', () => ({ RoughDialog: ({ onClose }: { onClose: () => void }) => <button data-testid="rough-dialog" onClick={onClose} /> }));

let panelId = '';
const panel = () => findPanel(useComic.getState().projects, panelId)!.panel;

function Host() {
  const project = useComic((s) => s.projects[0]!);
  const page = project.pages[0]!;
  const p = page.panels.find((x) => x.id === panelId)!;
  return <PanelTools page={page} panel={p} panelIndex={page.panels.indexOf(p)} templates={project.panelTemplates} cast={project.cast} places={project.places} />;
}

/** Opens the popover of a tool by its button and waits for its content. */
async function openTool(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
  await screen.findByRole('dialog');
}

beforeEach(() => {
  setLocale('en');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const project = newProject('Tools');
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.getState().setProjects([project]);
  useToasts.setState({ toasts: [] });
  usePoseDialog.setState({ isOpen: false, target: null });
  render(
    <TooltipProvider>
      <Host />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(putPosePreset).mockClear();
  setLocale('ja');
});

describe('the balloons tool', () => {
  it('adds a balloon of the tile pressed and opens its editor; the row selects, edits and removes it', async () => {
    await openTool('comic-bubbles');
    const preset = BALLOON_PRESETS[0]!;
    fireEvent.click(screen.getByTestId(`comic-add-${preset.id}`));
    expect(panel().bubbles).toHaveLength(1);
    expect(useComic.getState().bubbleEditor).toBe(true);
    const id = panel().bubbles[0]!.id;
    expect(useComic.getState().selectedBubbleId).toBe(id);

    act(() => useComic.getState().closeBubbleEditor());
    act(() => useComic.getState().selectBubble(null));
    const row = screen.getByTestId('comic-bubble-row');
    expect(row.className).not.toContain('is-selected');
    expect(screen.getByText(t('comic.bubble.noText'))).toBeTruthy();
    fireEvent.click(row.querySelector('.comic-bubble-row__pick')!);
    expect(useComic.getState().selectedBubbleId).toBe(id);
    expect(screen.getByTestId('comic-bubble-row').className).toContain('is-selected');

    act(() => useComic.getState().closeBubbleEditor());
    fireEvent.doubleClick(row.querySelector('.comic-bubble-row__pick')!);
    expect(useComic.getState().bubbleEditor).toBe(true);
    act(() => useComic.getState().closeBubbleEditor());
    fireEvent.click(screen.getByTestId('comic-bubble-edit'));
    expect(useComic.getState().bubbleEditor).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: t('comic.bubble.remove') }));
    expect(panel().bubbles).toHaveLength(0);
    expect(screen.queryByTestId('comic-bubble-row')).toBeNull();
  });

  it('shows the words of a balloon in its row', async () => {
    const id = useComic.getState().addBubble(panelId, 'speech')!;
    act(() => useComic.getState().updateBubble(panelId, id, { text: '  Hello  ' }));
    await openTool('comic-bubbles');
    expect(screen.getByTestId('comic-bubble-row').textContent).toContain('Hello');
    expect(screen.queryByText(t('comic.bubble.noText'))).toBeNull();
  });
});

describe('the pose tool', () => {
  it('offers the pose editor without a remove button while the panel has no pose', async () => {
    await openTool('comic-pose-tools');
    expect(screen.getByTestId('comic-pose').textContent).toBe(t('comic.panel.pose'));
    expect(screen.queryByTestId('comic-pose-remove')).toBeNull();
  });

  it('opens the pose editor at the panel shape, and keeps the pose and its picture it hands back', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'pose.png', url: 'novira://pose.png' } as ImageDTO);
    await openTool('comic-pose-tools');
    fireEvent.click(screen.getByTestId('comic-pose'));
    const target = usePoseDialog.getState().target!;
    expect(usePoseDialog.getState().isOpen).toBe(true);
    expect(target.initial).toBeNull();
    expect(target.width).toBeGreaterThan(0);
    expect(target.height).toBeGreaterThan(0);
    const joints = Array.from({ length: 18 }, (_, i) => ({ x: i / 18, y: 0.5 }));
    await target.onUse(joints, new Blob(['x']));
    expect(upload).toHaveBeenCalledOnce();
    expect(useGallery.getState().images.map((i) => i.name)).toContain('pose.png');
    expect(panel().poses).toEqual([joints]);
    expect(panel().poseImageName).toBe('pose.png');
  });

  it('shows the count and a remove button for a panel with a pose, and the remove button clears it', async () => {
    act(() => useComic.getState().setPanelPose(panelId, [Array.from({ length: 18 }, () => ({ x: 0.5, y: 0.5 }))], 'p.png'));
    await openTool('comic-pose-tools');
    expect(screen.getByTestId('comic-pose').textContent).toBe(t('comic.panel.poseEdit'));
    fireEvent.click(screen.getByTestId('comic-pose-remove'));
    expect(panel().poses).toHaveLength(0);
    expect(screen.queryByTestId('comic-pose-remove')).toBeNull();
  });

  it('applies the ready-made pose chosen from the list at the panel size', async () => {
    await openTool('comic-pose-tools');
    fireEvent.click(screen.getByTestId('comic-pose-preset-apply'));
    const first = POSE_CATEGORIES[0]!;
    expect(putPosePreset).toHaveBeenCalledWith(panelId, first.presets[0]!.id, expect.any(Number), expect.any(Number));
  });

  it('picks another category, which starts at its first pose', async () => {
    await openTool('comic-pose-tools');
    const second = POSE_CATEGORIES[1]!;
    fireEvent.keyDown(screen.getByLabelText(t('comic.panel.poseCategory')), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: t(second.label) }));
    fireEvent.click(screen.getByTestId('comic-pose-preset-apply'));
    expect(putPosePreset).toHaveBeenLastCalledWith(panelId, second.presets[0]!.id, expect.any(Number), expect.any(Number));
    // Then another pose of the same category.
    const other = second.presets[1];
    if (other) {
      fireEvent.keyDown(screen.getByLabelText(t('comic.panel.posePreset')), { key: 'Enter' });
      fireEvent.click(screen.getByRole('option', { name: t(other.label) }));
      fireEvent.click(screen.getByTestId('comic-pose-preset-apply'));
      expect(putPosePreset).toHaveBeenLastCalledWith(panelId, other.id, expect.any(Number), expect.any(Number));
    }
  });

  it('tells the user when the ready-made pose cannot be put in', async () => {
    vi.mocked(putPosePreset).mockRejectedValueOnce(new Error('no canvas'));
    await openTool('comic-pose-tools');
    fireEvent.click(screen.getByTestId('comic-pose-preset-apply'));
    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1));
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', description: 'no canvas' });
  });

  it('says what the 3D rough of the panel is doing, and opens its dialog', async () => {
    await openTool('comic-pose-tools');
    expect(screen.getByTestId('comic-rough-state').textContent).toBe(t('comic.rough.help'));
    fireEvent.click(screen.getByTestId('comic-rough-open'));
    expect(screen.getByTestId('rough-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('rough-dialog'));
    expect(screen.queryByTestId('rough-dialog')).toBeNull();
  });
});

describe('the note and place tools', () => {
  it('writes the note of the panel, within its length', async () => {
    await openTool('comic-note-tools');
    const note = screen.getByTestId('comic-note') as HTMLTextAreaElement;
    expect(note.getAttribute('maxlength')).toBe(String(PANEL_NOTE_MAX));
    fireEvent.change(note, { target: { value: 'close up, rain' } });
    expect(panel().note).toBe('close up, rain');
  });

  it('holds the place of the panel', async () => {
    await openTool('comic-place-tools');
    expect(screen.getByTestId('comic-panel-place')).toBeTruthy();
  });

  it('holds the cast of the panel', async () => {
    await openTool('comic-cast-tools');
    expect(screen.getByText(t('comic.cast.title'), { selector: 'h3' })).toBeTruthy();
  });
});

describe('the panel templates tool', () => {
  const templates = () => useComic.getState().projects[0]!.panelTemplates;

  it('says there are none, saves one under a typed or a numbered name, and clears the name', async () => {
    await openTool('comic-panel-templates');
    expect(screen.getByText(t('comic.template.empty'))).toBeTruthy();
    const name = screen.getByLabelText(t('comic.template.name')) as HTMLInputElement;
    fireEvent.change(name, { target: { value: '  Close  ' } });
    fireEvent.click(screen.getByTestId('comic-panel-template-save'));
    expect(templates().map((x) => x.name)).toEqual(['Close']);
    expect(name.value).toBe('');
    fireEvent.click(screen.getByTestId('comic-panel-template-save'));
    expect(templates()[1]!.name).toBe(t('comic.template.defaultName', { number: 2 }));
    expect(screen.getAllByTestId('comic-panel-template')).toHaveLength(2);
    expect(screen.queryByText(t('comic.template.empty'))).toBeNull();
  });

  it('applies a saved template to the panel and deletes it', async () => {
    act(() => useComic.getState().setPrompt(panelId, 'rain'));
    act(() => void useComic.getState().savePanelTemplate(panelId, 'Rainy'));
    act(() => useComic.getState().setPrompt(panelId, 'sun'));
    await openTool('comic-panel-templates');
    fireEvent.click(screen.getByTestId('comic-panel-template-apply'));
    expect(panel().prompt).toBe('rain');
    fireEvent.click(screen.getByRole('button', { name: t('comic.template.delete') }));
    expect(templates()).toHaveLength(0);
  });
});
