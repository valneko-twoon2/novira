// @vitest-environment jsdom
// The left column of the Workflows tab: its tabs (form, templates, details, data), the video guide, and the dialogs it hosts.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { DEFAULT_WORKFLOWS } from '@/backend/defaultWorkflows';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePacks } from '@/state/media/packs';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { loadWorkflowGraph, openLibraryWorkflow, saveWorkflowAs } from './actions';
import { useDialogs } from './dialogs';
import { graphForLibraryItem } from './actions';
import { GRAPH_TEMPLATES } from './graphTemplates';
import { WorkflowsLeftPanel } from './LeftPanel';
import { VideoGuide, VideoPanelNotice } from './VideoGuide';
import { WorkflowDialogs } from './WorkflowDialogs';

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  saveWorkflowAs: vi.fn(),
  openLibraryWorkflow: vi.fn(),
  loadWorkflowGraph: vi.fn(),
}));

const initial = { workflows: useWorkflows.getState(), ui: useUi.getState(), dialogs: useDialogs.getState(), packs: usePacks.getState(), nodePacks: useNodePacks.getState() };

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  useWorkflows.setState({ ...initial.workflows, library: DEFAULT_WORKFLOWS }, true);
  useUi.setState({ ...initial.ui, modal: null }, true);
  useDialogs.setState({ ...initial.dialogs, pending: null, saveAsOpen: false });
  usePacks.setState(initial.packs, true);
  useNodePacks.setState({ ...initial.nodePacks, load: vi.fn(async () => {}) }, true);
  useWorkflowImport.setState({ pending: null });
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);
const loadDefault = () => useWorkflows.getState().setGraph(graphForLibraryItem(DEFAULT_WORKFLOWS.find((w) => w.id === 'default-t2i-sd15')!)!);
const showTab = (label: string) => fireEvent.mouseDown(screen.getByRole('tab', { name: label }), { button: 0 });
const idOf = (type: string) => useWorkflows.getState().nodes.find((n) => n.data.type === type)!.id;

describe('the panel', () => {
  it('has no header of its own: the open workflow and the library are the card above the Generate button', () => {
    loadDefault();
    wrap(<WorkflowsLeftPanel />);
    expect(screen.queryByTestId('wf-open-library')).toBeNull();
    expect(screen.queryByRole('button', { name: t('workflows.library.button') })).toBeNull();
    expect(screen.getByRole('tab', { name: t('workflows.panel.workflow') })).toBeTruthy();
  });

  it('switches between its tabs', () => {
    loadDefault();
    wrap(<WorkflowsLeftPanel />);
    expect(screen.getByTestId('wf-form')).toBeTruthy();
    showTab(t('workflows.panel.details'));
    expect(screen.getByTestId('wf-details')).toBeTruthy();
    showTab(t('workflows.panel.data'));
    expect(screen.getByTestId('wf-data-json')).toBeTruthy();
    showTab(t('workflows.panel.templates'));
    expect(screen.getByTestId('wf-templates')).toBeTruthy();
    showTab(t('workflows.panel.packs'));
    expect(screen.queryByTestId('wf-templates')).toBeNull();
  });
});

describe('the form', () => {
  it('explains that nothing is on the form yet', () => {
    wrap(<WorkflowsLeftPanel />);
    expect(screen.getByText(t('workflows.form.emptyTitle'))).toBeTruthy();
  });

  it('lists the fields on the form, reorders and removes them, and shows the description', () => {
    loadDefault();
    const id = idOf('denoise_latents');
    act(() => {
      useWorkflows.setState({ form: [] });
      useWorkflows.getState().setMeta({ description: 'Makes a picture' });
      useWorkflows.getState().addFormField({ nodeId: id, fieldName: 'steps' });
      useWorkflows.getState().addFormField({ nodeId: id, fieldName: 'cfg_scale' });
    });
    wrap(<WorkflowsLeftPanel />);
    expect(screen.getByText('Makes a picture')).toBeTruthy();
    expect(screen.getAllByTestId('wf-form')[0]!.querySelectorAll('.wf-form__row')).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText(t('workflows.form.moveDown'))[0]!);
    expect(useWorkflows.getState().form.map((f) => f.fieldName)).toEqual(['cfg_scale', 'steps']);
    fireEvent.click(screen.getAllByLabelText(t('workflows.form.moveUp'))[1]!);
    expect(useWorkflows.getState().form.map((f) => f.fieldName)).toEqual(['steps', 'cfg_scale']);
    fireEvent.click(screen.getAllByLabelText(t('workflows.form.remove'))[0]!);
    expect(useWorkflows.getState().form).toHaveLength(1);
  });

  it('toggles the edit mode, and tells that a connected field gets its value from a connection', () => {
    loadDefault();
    act(() => useWorkflows.getState().addFormField({ nodeId: idOf('denoise_latents'), fieldName: 'positive_conditioning' }));
    wrap(<WorkflowsLeftPanel />);
    expect(screen.getByText(t('workflows.form.connected'))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t('workflows.form.editForm')));
    expect(useWorkflows.getState().mode).toBe('edit');
    fireEvent.click(screen.getByLabelText(t('workflows.form.doneEditing')));
    expect(useWorkflows.getState().mode).toBe('view');
  });

  it('skips a form field whose node is gone', () => {
    act(() => useWorkflows.getState().addFormField({ nodeId: 'ghost', fieldName: 'steps' }));
    wrap(<WorkflowsLeftPanel />);
    expect(document.querySelectorAll('.wf-form__row')).toHaveLength(0);
  });
});

describe('details and data', () => {
  it('edits the details of the workflow', () => {
    wrap(<WorkflowsLeftPanel />);
    showTab(t('workflows.panel.details'));
    fireEvent.change(screen.getByLabelText(t('workflows.details.name')), { target: { value: 'My flow' } });
    fireEvent.change(screen.getByLabelText(t('workflows.details.tags')), { target: { value: 'a, b' } });
    fireEvent.change(screen.getByLabelText(t('workflows.details.notes')), { target: { value: 'remember' } });
    const meta = useWorkflows.getState().meta;
    expect([meta.name, meta.tags, meta.notes]).toEqual(['My flow', 'a, b', 'remember']);
  });

  it('shows the workflow as JSON and copies it, saying so only once it is copied', async () => {
    loadDefault();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    wrap(<WorkflowsLeftPanel />);
    showTab(t('workflows.panel.data'));
    const json = screen.getByTestId('wf-data-json').textContent!;
    expect(JSON.parse(json).nodes.length).toBe(useWorkflows.getState().nodes.length);
    fireEvent.click(screen.getByRole('button', { name: t('common.copy') }));
    expect(writeText).toHaveBeenCalledWith(json);
    await waitFor(() => expect(useToasts.getState().toasts.some((x) => x.title === t('workflows.toasts.copiedJson'))).toBe(true));
    // A copy the browser refuses says it failed instead.
    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: t('common.copy') }));
    await waitFor(() => expect(useToasts.getState().toasts.some((x) => x.title === t('gallery.toast.copyFailed'))).toBe(true));
  });
});

describe('templates', () => {
  it('opens a ready template as a workflow, and adds it next to what is on the canvas', () => {
    loadDefault();
    wrap(<WorkflowsLeftPanel />);
    showTab(t('workflows.panel.templates'));
    const cards = screen.getAllByTestId('wf-template');
    expect(cards).toHaveLength(GRAPH_TEMPLATES.length);
    const ready = cards.find((c) => !(within(c).getByTestId('wf-template-open') as HTMLButtonElement).disabled)!;
    fireEvent.click(within(ready).getByTestId('wf-template-open'));
    expect(loadWorkflowGraph).toHaveBeenCalledTimes(1);
    const before = useWorkflows.getState().nodes.length;
    fireEvent.click(within(ready).getByTestId('wf-template-add'));
    expect(useWorkflows.getState().nodes.length).toBeGreaterThan(before);
  });

  it('offers to install the packs a template needs, and disables opening it', () => {
    const install = vi.fn(async () => {});
    useNodePacks.setState({ install, packs: { installed: [], restartNeeded: false } as never });
    wrap(<WorkflowsLeftPanel />);
    showTab(t('workflows.panel.templates'));
    const blocked = screen.getAllByTestId('wf-template').find((c) => within(c).queryByTestId('wf-template-install'))!;
    expect((within(blocked).getByTestId('wf-template-open') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(blocked).getByTestId('wf-template-install'));
    expect(install).toHaveBeenCalled();
  });
});

describe('the video guide', () => {
  it('offers to download the video models, and opens the sample workflows', () => {
    const installPack = vi.spyOn(backend, 'installPack').mockResolvedValue(undefined as never);
    usePacks.getState().setPack('video', { state: 'missing' } as never);
    wrap(<VideoGuide />);
    fireEvent.click(screen.getByTestId('guide-video-pack'));
    expect(installPack).toHaveBeenCalledWith('video');
    useWorkflows.setState({ library: [{ ...DEFAULT_WORKFLOWS[0]!, id: 'default-video-t2v' }] });
    fireEvent.click(screen.getByTestId('guide-open-t2v'));
    expect(openLibraryWorkflow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('guide-open-i2v'));
    expect(openLibraryWorkflow).toHaveBeenCalledTimes(1);
  });

  it('says that the models are ready, or how far their download is', () => {
    const { rerender } = wrap(<VideoGuide />);
    expect(screen.getByText(t('video.guide.pack.ready'))).toBeTruthy();
    act(() => usePacks.getState().setPack('video', { state: 'downloading', index: 1, count: 3, bytes: 2e9, totalBytes: 5e9 } as never));
    rerender(
      <TooltipProvider>
        <VideoGuide />
      </TooltipProvider>,
    );
    expect(screen.getByText(/2\.0 GB/)).toBeTruthy();
  });

  it('shows a notice above the form only while a video workflow lacks its models', () => {
    usePacks.getState().setPack('video', { state: 'missing' } as never);
    const { container } = wrap(<VideoPanelNotice />);
    expect(container.querySelector('[data-testid="video-panel-notice"]')).toBeNull();
    act(() => useWorkflows.setState({ nodes: [{ ...useWorkflows.getState().nodes[0]!, id: 'v', data: { type: 'video_generate' } } as never] }));
    expect(screen.getByTestId('video-panel-notice')).toBeTruthy();
  });
});

describe('the dialogs', () => {
  it('asks before discarding, and runs the action only when confirmed', () => {
    const action = vi.fn();
    wrap(<WorkflowDialogs />);
    act(() => useDialogs.getState().ask(action));
    fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(action).not.toHaveBeenCalled();
    act(() => useDialogs.getState().ask(action));
    fireEvent.click(screen.getByTestId('wf-confirm-discard'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('saves under the name that is typed, with Enter or the button, and not without a name', () => {
    useWorkflows.getState().setMeta({ name: 'Mine', category: 'user' });
    wrap(<WorkflowDialogs />);
    act(() => useDialogs.getState().setSaveAsOpen(true));
    const box = screen.getByLabelText(t('workflows.details.name'));
    expect((box as HTMLInputElement).value).toBe('Mine');
    fireEvent.change(box, { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: t('common.save') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(saveWorkflowAs).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'Renamed' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(saveWorkflowAs).toHaveBeenCalledWith('Renamed');
    expect(useDialogs.getState().saveAsOpen).toBe(false);
  });

  it('proposes a copy name for a default workflow and can be cancelled', () => {
    useWorkflows.getState().setMeta({ name: 'Stock', category: 'default' });
    wrap(<WorkflowDialogs />);
    act(() => useDialogs.getState().setSaveAsOpen(true));
    expect((screen.getByLabelText(t('workflows.details.name')) as HTMLInputElement).value).toBe(t('workflows.library.copyName', { name: 'Stock' }));
    fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(useDialogs.getState().saveAsOpen).toBe(false);
  });

  it('lists the packs a file needs: install what is missing, restart for what is installed, and say when the source is unknown', () => {
    const install = vi.fn(async () => {});
    const restart = vi.fn(async () => {});
    useNodePacks.setState({ install, restart, packs: { installed: [{ folder: 'have', url: 'x' }] } as never });
    useWorkflowImport.getState().set({
      raw: {},
      name: 'file',
      packs: [
        { folder: 'have', url: 'https://github.com/a/have' },
        { folder: 'miss', url: 'https://github.com/a/miss' },
        { folder: 'nowhere', url: null },
      ],
      types: ['comfy:Thing'],
    });
    wrap(<WorkflowDialogs />);
    expect(screen.getAllByTestId('wf-import-pack')).toHaveLength(3);
    fireEvent.click(screen.getByTestId('wf-import-install'));
    expect(install).toHaveBeenCalledWith('https://github.com/a/miss');
    fireEvent.click(screen.getByTestId('wf-import-restart'));
    expect(restart).toHaveBeenCalled();
    expect(screen.getByText(t('workflows.import.unknownSource'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(useWorkflowImport.getState().pending).toBeNull();
  });

  it('says that it does not know the packs when the file names none', () => {
    useWorkflowImport.getState().set({ raw: {}, name: 'file', packs: [], types: ['comfy:Thing'] });
    wrap(<WorkflowDialogs />);
    expect(screen.getByText(t('workflows.import.unknownPacks'))).toBeTruthy();
  });
});
