// @vitest-environment jsdom
// The node editor in jsdom: nodes and their fields render and edit, hotkeys copy, paste and undo, the node picker adds a node,
// dropped gallery pictures become picture nodes, and the toolbar opens the settings and the save dialog.
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORKFLOWS } from '@/backend/defaultWorkflows';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { t } from '@/i18n';
import { IMAGE_MIME } from '@/state/dnd';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { graphForLibraryItem } from './actions';
import { comfyTemplates } from './comfyNodes';
import { useDialogs } from './dialogs';
import { createNode } from './graph';
import { NODE_MIME } from './nodeAdder';
import { NodeLibrary } from './NodeLibrary';
import { getTemplate, setExtensionTemplates } from './templates';
import { WorkflowEditor } from './WorkflowEditor';

// React Flow with every node of a workflow is slow to mount, more so when the machine is busy.
vi.setConfig({ testTimeout: 30_000 });

const initial = { workflows: useWorkflows.getState(), dialogs: useDialogs.getState() };

/** Reports a size for whatever is observed, so React Flow lays the nodes out. */
class FakeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element) {
    this.cb([{ target, contentRect: { width: 1000, height: 700 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeObserver);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  Element.prototype.scrollIntoView = vi.fn();
  const wf = DEFAULT_WORKFLOWS.find((w) => w.id === 'default-t2i-sd15')!;
  useWorkflows.setState({ ...initial.workflows, library: DEFAULT_WORKFLOWS }, true);
  useWorkflows.getState().setGraph(graphForLibraryItem(wf)!);
  useDialogs.setState({ ...initial.dialogs, saveAsOpen: false });
  useWorkflows.getState().setSettings({ showMinimap: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <TooltipProvider>
      <WorkflowEditor />
    </TooltipProvider>,
  );
const nodeCount = () => useWorkflows.getState().nodes.length;
const key = (init: KeyboardEventInit) => fireEvent.keyDown(window, init);
const nodeOf = (type: string) => screen.getAllByTestId(`wf-node-${type}`)[0]!;
const selectAll = () => act(() => useWorkflows.setState((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: true })) })));

describe('rendering', () => {
  it('draws a node for every node of the graph', async () => {
    mount();
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBe(nodeCount()));
    expect(screen.getByTestId('wf-editor')).toBeTruthy();
  });

  it('shows the workflow name, and a dot once it has unsaved changes', () => {
    mount();
    expect(screen.getByTestId('wf-name').textContent).toBeTruthy();
    expect(screen.queryByLabelText(t('workflows.unsaved'))).toBeNull();
    act(() => useWorkflows.getState().setFieldValue(useWorkflows.getState().nodes[0]!.id, 'x', 1));
    expect(screen.getByLabelText(t('workflows.unsaved'))).toBeTruthy();
  });

  it('turns the minimap and other editor settings on from the settings popover', async () => {
    mount();
    expect(document.querySelector('.wf-minimap')).toBeNull();
    fireEvent.pointerDown(screen.getByLabelText(t('workflows.settings.title')), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByLabelText(t('workflows.settings.title')));
    const toggle = await screen.findByLabelText(t('workflows.settings.showMinimap'));
    fireEvent.click(toggle);
    expect(useWorkflows.getState().settings.showMinimap).toBe(true);
    await waitFor(() => expect(document.querySelector('.wf-minimap')).not.toBeNull());
  });

  it('says that the nodes are up to date when asked to update them', async () => {
    mount();
    fireEvent.click(screen.getByLabelText(t('workflows.toolbar.updateNodes')));
    const { useToasts } = await import('@/state/toasts');
    expect(useToasts.getState().toasts.some((x) => x.title === t('workflows.toasts.nodesUpToDate'))).toBe(true);
  });
});

describe('a node of ComfyUI with a dynamic combo', () => {
  afterEach(() => setExtensionTemplates([]));

  it('shows the inputs of the choice that is made, and the others when the choice changes', () => {
    setExtensionTemplates(comfyTemplates(CORE_NODE_DEFS));
    const save = createNode(getTemplate('comfy:SaveAudioAdvanced')!, { x: 0, y: 0 }, { id: 'save' });
    useWorkflows.getState().setGraph({ nodes: [save], edges: [], form: [], meta: useWorkflows.getState().meta });
    mount();
    // FLAC brings no quality.
    expect(screen.queryByLabelText('quality')).toBeNull();
    act(() => useWorkflows.getState().setFieldValue('save', 'format', 'mp3'));
    expect(screen.getByLabelText('quality')).toBeTruthy();
    // Opus lists qualities of its own, in the second input.
    act(() => useWorkflows.getState().setFieldValue('save', 'format', 'opus'));
    expect(screen.getAllByLabelText('quality')).toHaveLength(1);
    act(() => useWorkflows.getState().setFieldValue('save', 'format', 'flac'));
    expect(screen.queryByLabelText('quality')).toBeNull();
  });
});

describe('the node library next to the editor', () => {
  it('adds a double-clicked node to the canvas, one step off the last so they do not pile up', async () => {
    render(
      <TooltipProvider>
        <NodeLibrary />
        <WorkflowEditor />
      </TooltipProvider>,
    );
    const before = nodeCount();
    fireEvent.change(screen.getByLabelText(t('workflows.nodeLibrary.placeholder')), { target: { value: 'integer' } });
    const item = screen.getAllByTestId('wf-lib-item')[0]!;
    await waitFor(() => {
      fireEvent.doubleClick(item);
      expect(nodeCount()).toBeGreaterThan(before);
    });
    const [a, b] = useWorkflows.getState().nodes.slice(-2);
    fireEvent.doubleClick(item);
    const c = useWorkflows.getState().nodes.at(-1)!;
    expect(c.position).not.toEqual(a!.position);
    expect(b).toBeTruthy();
  });

  it('places a node dropped from the library, and ignores a type that does not exist', () => {
    mount();
    const before = nodeCount();
    const pane = screen.getByTestId('wf-editor');
    const drop = (type: string) => {
      const event = createEvent.drop(pane, { clientX: 300, clientY: 200 });
      Object.defineProperty(event, 'dataTransfer', { value: { types: [NODE_MIME], getData: (k: string) => (k === NODE_MIME ? type : '') } });
      fireEvent(pane, event);
    };
    drop('no-such-node');
    expect(nodeCount()).toBe(before);
    drop(getTemplate('image')!.type);
    expect(nodeCount()).toBe(before + 1);
  });
});

describe('the node picker', () => {
  it('adds the node that is picked with Enter after searching, and closes', async () => {
    mount();
    const before = nodeCount();
    key({ key: 'A', shiftKey: true });
    const box = await screen.findByLabelText(t('workflows.picker.placeholder'));
    fireEvent.change(box, { target: { value: 'integer' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(nodeCount()).toBe(before + 1);
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('adds a node by clicking it, and says when nothing matches', async () => {
    mount();
    const before = nodeCount();
    key({ key: 'A', shiftKey: true });
    const box = await screen.findByLabelText(t('workflows.picker.placeholder'));
    fireEvent.change(box, { target: { value: 'zzzzzzzz' } });
    expect(screen.getByText(t('workflows.picker.noResults'))).toBeTruthy();
    fireEvent.change(box, { target: { value: 'blur' } });
    fireEvent.click(within(screen.getByTestId('wf-node-picker')).getAllByRole('button').find((b) => b.classList.contains('wf-picker__item'))!);
    expect(nodeCount()).toBe(before + 1);
  });

  it('closes on Escape and when the pane is clicked', async () => {
    mount();
    key({ key: ' ' });
    fireEvent.keyDown(await screen.findByLabelText(t('workflows.picker.placeholder')), { key: 'Escape' });
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
    key({ key: ' ' });
    await screen.findByTestId('wf-node-picker');
    fireEvent.click(document.querySelector('.react-flow__pane')!);
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });
});

describe('hotkeys', () => {
  it('copies the selected nodes and pastes them offset, with the connections between them', () => {
    mount();
    const before = nodeCount();
    const edgesBefore = useWorkflows.getState().edges.length;
    selectAll();
    key({ key: 'c', ctrlKey: true });
    key({ key: 'v', ctrlKey: true });
    expect(nodeCount()).toBe(before * 2);
    expect(useWorkflows.getState().edges.length).toBe(edgesBefore * 2);
  });

  it('copies nothing when no node is selected', () => {
    mount();
    key({ key: 'c', ctrlKey: true });
    key({ key: 'v', ctrlKey: true });
    expect(nodeCount()).toBeGreaterThan(0);
  });

  it('undoes and redoes a change', () => {
    mount();
    const before = nodeCount();
    selectAll();
    key({ key: 'c', ctrlKey: true });
    key({ key: 'v', ctrlKey: true });
    key({ key: 'z', ctrlKey: true });
    expect(nodeCount()).toBe(before);
    key({ key: 'Z', ctrlKey: true, shiftKey: true });
    expect(nodeCount()).toBe(before * 2);
    key({ key: 'z', ctrlKey: true });
    key({ key: 'y', ctrlKey: true });
    expect(nodeCount()).toBe(before * 2);
  });

  it('asks for a name when saving a workflow that is not saved yet', () => {
    mount();
    useWorkflows.getState().setMeta({ id: '', category: 'user' });
    key({ key: 's', ctrlKey: true });
    expect(useDialogs.getState().saveAsOpen).toBe(true);
  });
});

describe('dropping pictures', () => {
  const drop = (names: string[]) =>
    fireEvent.drop(screen.getByTestId('wf-editor'), { clientX: 10, clientY: 20, dataTransfer: { types: [IMAGE_MIME], getData: () => JSON.stringify(names), dropEffect: 'none' } });

  it('adds a picture node for every dropped picture', async () => {
    mount();
    const before = nodeCount();
    drop(['a.png', 'b.png']);
    await waitFor(() => expect(nodeCount()).toBe(before + 2));
    expect(useWorkflows.getState().nodes.slice(-2).map((n) => n.data.inputs.image)).toEqual(['a.png', 'b.png']);
  });

  it('accepts a picture drag over it and ignores a drag of anything else', () => {
    mount();
    const over = { dataTransfer: { types: [IMAGE_MIME], dropEffect: 'none' } };
    const overEvent = fireEvent.dragOver(screen.getByTestId('wf-editor'), over);
    expect(overEvent).toBe(false);
    const other = fireEvent.dragOver(screen.getByTestId('wf-editor'), { dataTransfer: { types: ['text/plain'], dropEffect: 'none' } });
    expect(other).toBe(true);
    const before = nodeCount();
    fireEvent.drop(screen.getByTestId('wf-editor'), { dataTransfer: { types: ['text/plain'], getData: () => '' } });
    expect(nodeCount()).toBe(before);
  });
});

describe('editing a node', () => {
  it('collapses and expands a node', () => {
    mount();
    const node = nodeOf('denoise_latents');
    fireEvent.click(within(node).getByLabelText(t('workflows.node.collapse')));
    expect(node.className).toContain('is-collapsed');
    fireEvent.click(within(node).getByLabelText(t('workflows.node.expand')));
    expect(node.className).not.toContain('is-collapsed');
  });

  it('renames a node by double-clicking its title, and restores the default name when it is cleared', () => {
    mount();
    const node = nodeOf('denoise_latents');
    const id = useWorkflows.getState().nodes.find((n) => n.data.type === 'denoise_latents')!.id;
    fireEvent.doubleClick(within(node).getByTitle(t('workflows.node.renameHint')));
    const input = within(node).getByLabelText(t('workflows.node.rename'));
    fireEvent.change(input, { target: { value: 'My sampler' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(useWorkflows.getState().nodes.find((n) => n.id === id)!.data.label).toBe('My sampler');
    fireEvent.doubleClick(within(node).getByTitle(t('workflows.node.renameHint')));
    fireEvent.keyDown(within(node).getByLabelText(t('workflows.node.rename')), { key: 'Escape' });
    expect(within(node).queryByLabelText(t('workflows.node.rename'))).toBeNull();
  });

  it('switches the cache of a node and adds a field to the form and takes it out again', () => {
    mount();
    const node = nodeOf('denoise_latents');
    const id = useWorkflows.getState().nodes.find((n) => n.data.type === 'denoise_latents')!.id;
    const cache = useWorkflows.getState().nodes.find((n) => n.id === id)!.data.useCache;
    fireEvent.click(within(node).getByLabelText(t('workflows.node.useCache')));
    expect(useWorkflows.getState().nodes.find((n) => n.id === id)!.data.useCache).toBe(!cache);
    const formBefore = useWorkflows.getState().form.length;
    const add = within(node).getAllByLabelText(t('workflows.node.addToForm'))[0]!;
    fireEvent.click(add);
    expect(useWorkflows.getState().form.length).toBe(formBefore + 1);
    expect(add.getAttribute('aria-label')).toBe(t('workflows.node.removeFromForm'));
    fireEvent.click(add);
    expect(useWorkflows.getState().form.length).toBe(formBefore);
  });

  it('edits number, text and switch fields of a node', () => {
    mount();
    const sampler = nodeOf('denoise_latents');
    const id = useWorkflows.getState().nodes.find((n) => n.data.type === 'denoise_latents')!.id;
    const steps = within(sampler).getAllByRole('spinbutton', { hidden: true })[0]!;
    fireEvent.change(steps, { target: { value: '12' } });
    fireEvent.blur(steps);
    expect(useWorkflows.getState().nodes.find((n) => n.id === id)!.data.inputs.steps).toBe(12);
    const prompt = document.querySelector('.wf-control textarea, .wf-control input[type="text"]') as HTMLElement;
    const owner = prompt.closest('.react-flow__node')!.getAttribute('data-id')!;
    fireEvent.change(prompt, { target: { value: 'a red fox' } });
    expect(Object.values(useWorkflows.getState().nodes.find((n) => n.id === owner)!.data.inputs)).toContain('a red fox');
  });

  it('shows what it holds for a node type it does not know', () => {
    mount();
    act(() => useWorkflows.getState().addNodes([{ ...useWorkflows.getState().nodes[0]!, id: 'odd', data: { ...useWorkflows.getState().nodes[0]!.data, type: 'no_such_node' } }]));
    expect(screen.getByText('no_such_node')).toBeTruthy();
  });
});

describe('the toolbar', () => {
  it('has no library button (the card above the Generate button opens it), and asks to save under a name when the workflow has none yet', () => {
    mount();
    expect(screen.queryByTestId('wf-open-library')).toBeNull();
    useWorkflows.getState().setMeta({ id: '', category: 'user' });
    fireEvent.click(screen.getByLabelText(t('workflows.toolbar.save')));
    expect(useDialogs.getState().saveAsOpen).toBe(true);
  });

  it('asks before starting a new workflow over unsaved changes', () => {
    mount();
    act(() => useWorkflows.setState({ isTouched: true }));
    fireEvent.click(screen.getByLabelText(t('workflows.toolbar.new')));
    expect(useDialogs.getState().pending).not.toBeNull();
    expect(nodeCount()).toBeGreaterThan(0);
  });

  it('starts a new workflow at once when nothing is unsaved', () => {
    mount();
    act(() => useWorkflows.setState({ isTouched: false }));
    fireEvent.click(screen.getByLabelText(t('workflows.toolbar.new')));
    expect(useDialogs.getState().pending).toBeNull();
    expect(nodeCount()).toBe(0);
  });

  it('removes what the optimizer finds useless', () => {
    mount();
    const before = nodeCount();
    act(() => useWorkflows.getState().addNodes([{ ...useWorkflows.getState().nodes[0]!, id: 'lonely', data: { ...useWorkflows.getState().nodes[0]!.data, type: 'integer', inputs: { value: 1 } } }]));
    fireEvent.click(screen.getByTestId('wf-optimize'));
    expect(nodeCount()).toBeLessThanOrEqual(before + 1);
  });

  it('offers save as, download and loading a file from the more menu', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    mount();
    const more = screen.getByLabelText(t('workflows.toolbar.more'));
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(t('common.saveAs')) }));
    expect(useDialogs.getState().saveAsOpen).toBe(true);
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(t('workflows.toolbar.download')) }));
    expect(createObjectURL).toHaveBeenCalled();
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(t('workflows.toolbar.loadFromFile')) }));
    expect(click).toHaveBeenCalled();
  });

  it('ignores a file input that was cancelled', () => {
    mount();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(nodeCount()).toBeGreaterThan(0);
  });
});
