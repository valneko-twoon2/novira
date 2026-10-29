// @vitest-environment jsdom
// The node editor's connections: dropping a dragged connection on a node or on the empty pane, the picker that opens from it,
// the validity check, and the node library's way of adding a node. React Flow's own pointer handling is not driven in
// jsdom, so the callbacks the editor hands to React Flow are taken from its props and called the way React Flow calls them.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { createNode, makeEdge } from './graph';
import { addLibraryNode, NODE_MIME } from './nodeAdder';
import { getTemplate } from './templates';
import { WorkflowEditor } from './WorkflowEditor';

vi.setConfig({ testTimeout: 30_000 });

interface FlowProps {
  onConnect: (c: object) => void;
  onConnectEnd: (event: object, state: object) => void;
  isValidConnection: (c: object) => boolean;
}
const flow: { props: FlowProps | null } = { props: null };

// The real React Flow, with a look at the props it is given.
vi.mock('@xyflow/react', async (original) => {
  const real = await original<typeof import('@xyflow/react')>();
  const Real = real.ReactFlow as unknown as React.ComponentType<Record<string, unknown>>;
  return {
    ...real,
    ReactFlow: (p: Record<string, unknown>) => {
      flow.props = p as unknown as FlowProps;
      return <Real {...p} />;
    },
  };
});

const initial = useWorkflows.getState();

class FakeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element) {
    this.cb([{ target, contentRect: { width: 1000, height: 700 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

const node = (type: string, id: string) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeObserver);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  Element.prototype.scrollIntoView = vi.fn();
  useWorkflows.setState({ ...initial }, true);
  const nodes = [node('sdxl_model_loader', 'model'), node('denoise_latents', 'denoise'), node('l2i', 'decode'), node('save_image', 'save')];
  useWorkflows.getState().setGraph({ nodes, edges: [], form: [], meta: useWorkflows.getState().meta });
  useWorkflows.getState().setSettings({ showMinimap: false });
  flow.props = null;
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
const edges = () => useWorkflows.getState().edges;
const fromUnet = { isValid: false, toNode: null, fromHandle: { id: 'unet', type: 'source' }, fromNode: { id: 'model' } };

describe('connection checks', () => {
  it('accepts a fitting connection and refuses a mismatch or a loop', () => {
    mount();
    const c = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({ source, sourceHandle, target, targetHandle });
    expect(flow.props!.isValidConnection(c('model', 'unet', 'denoise', 'unet'))).toBe(true);
    expect(flow.props!.isValidConnection(c('model', 'unet', 'save', 'image'))).toBe(false);
    act(() => useWorkflows.getState().connect(makeEdge('denoise', 'latents', 'decode', 'latents')));
    expect(flow.props!.isValidConnection(c('decode', 'image', 'denoise', 'latents'))).toBe(false);
  });

  it('connects through onConnect, and ignores one with a missing handle', () => {
    mount();
    flow.props!.onConnect({ source: 'model', sourceHandle: null, target: 'denoise', targetHandle: 'unet' });
    flow.props!.onConnect({ source: 'model', sourceHandle: 'unet', target: 'denoise', targetHandle: null });
    expect(edges()).toHaveLength(0);
    act(() => flow.props!.onConnect({ source: 'model', sourceHandle: 'unet', target: 'denoise', targetHandle: 'unet' }));
    expect(edges()).toMatchObject([{ source: 'model', sourceHandle: 'unet', target: 'denoise', targetHandle: 'unet' }]);
  });
});

describe('a connection let go', () => {
  /** An element standing for the node the pointer was released over. */
  const overNode = (id: string) => {
    const el = document.createElement('div');
    el.className = 'react-flow__node';
    el.dataset.id = id;
    const inner = document.createElement('span');
    el.append(inner);
    document.body.append(el);
    return inner;
  };

  it('on a node body connects to the first handle that fits', () => {
    mount();
    const target = overNode('denoise');
    act(() => flow.props!.onConnectEnd({ target, clientX: 5, clientY: 5 }, fromUnet));
    expect(edges()).toMatchObject([{ source: 'model', sourceHandle: 'unet', target: 'denoise', targetHandle: 'unet' }]);
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('on a node with nothing that fits connects nothing and opens no picker', () => {
    mount();
    const target = overNode('save');
    act(() => flow.props!.onConnectEnd({ target }, fromUnet));
    expect(edges()).toHaveLength(0);
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('does nothing when the connection was completed, ended on a handle, or has no origin', () => {
    mount();
    const event = { target: document.body, clientX: 5, clientY: 5 };
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, isValid: true }));
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, toNode: { id: 'denoise' } }));
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, fromHandle: { id: null, type: 'source' } }));
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, fromNode: null }));
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
    expect(edges()).toHaveLength(0);
  });

  it('does not open the picker for a handle the node does not have, or for a node that is gone', () => {
    mount();
    const event = { target: document.body, clientX: 5, clientY: 5 };
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, fromHandle: { id: 'no-such-handle', type: 'source' } }));
    act(() => flow.props!.onConnectEnd(event, { ...fromUnet, fromNode: { id: 'ghost' } }));
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('does not open the picker for a touch that has no point', () => {
    mount();
    act(() => flow.props!.onConnectEnd({ target: document.body, changedTouches: [] }, fromUnet));
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('on the empty pane opens the picker, and the picked node is connected to where the drag began', async () => {
    mount();
    act(() => flow.props!.onConnectEnd({ target: document.body, clientX: 40, clientY: 50 }, fromUnet));
    const box = await screen.findByLabelText(t('workflows.picker.placeholder'));
    // The node library lists only nodes that can take a UNet input.
    fireEvent.change(box, { target: { value: 'denoise' } });
    const before = useWorkflows.getState().nodes.length;
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(useWorkflows.getState().nodes.length).toBe(before + 1);
    const added = useWorkflows.getState().nodes.at(-1)!;
    expect(edges()).toMatchObject([{ source: 'model', sourceHandle: 'unet', target: added.id, targetHandle: 'unet' }]);
    expect(screen.queryByTestId('wf-node-picker')).toBeNull();
  });

  it('from an input handle, opens the picker from a touch and puts the new node on the source side', async () => {
    mount();
    const fromInput = { isValid: false, toNode: null, fromHandle: { id: 'image', type: 'target' }, fromNode: { id: 'save' } };
    act(() => flow.props!.onConnectEnd({ target: document.body, changedTouches: [{ clientX: 300, clientY: 200 }] }, fromInput));
    await screen.findByLabelText(t('workflows.picker.placeholder'));
    const items = screen.getByTestId('wf-node-picker').querySelectorAll('.wf-picker__item');
    expect(items.length).toBeGreaterThan(0);
    fireEvent.click(items[0]!);
    await waitFor(() => expect(screen.queryByTestId('wf-node-picker')).toBeNull());
    const picked = useWorkflows.getState().nodes.at(-1)!;
    expect(picked.id).not.toBe('save');
    expect(edges()).toMatchObject([{ source: picked.id, sourceHandle: 'image', target: 'save', targetHandle: 'image' }]);
    // A node for an output sits to the left of where the drag was let go.
    expect(picked.position.x).toBeLessThan(0);
  });
});

describe('adding from the node library', () => {
  it('adds the node, selected, and each next one a little off the last', () => {
    mount();
    const before = useWorkflows.getState().nodes.length;
    act(() => addLibraryNode(getTemplate('l2i')!));
    act(() => addLibraryNode(getTemplate('l2i')!));
    const [a, b] = useWorkflows.getState().nodes.slice(-2);
    expect(useWorkflows.getState().nodes.length).toBe(before + 2);
    expect(b!.selected).toBe(true);
    expect(b!.position.x - a!.position.x).toBe(30);
    expect(b!.position.y - a!.position.y).toBe(30);
  });

  it('adds a node type dragged onto the canvas, and ignores an unknown one', () => {
    mount();
    const before = useWorkflows.getState().nodes.length;
    const drop = (type: string) => fireEvent.drop(screen.getByTestId('wf-editor'), { clientX: 10, clientY: 20, dataTransfer: { types: [NODE_MIME], getData: () => type } });
    drop('no_such_type');
    expect(useWorkflows.getState().nodes.length).toBe(before);
    drop('l2i');
    expect(useWorkflows.getState().nodes.length).toBe(before + 1);
    expect(useWorkflows.getState().nodes.at(-1)!.data.type).toBe('l2i');
  });

  it('accepts a node type dragged over the canvas', () => {
    mount();
    const accepted = fireEvent.dragOver(screen.getByTestId('wf-editor'), { dataTransfer: { types: [NODE_MIME], dropEffect: 'none' } });
    expect(accepted).toBe(false);
  });

  it('stops adding to the editor once it is gone, and adds at the origin then', () => {
    const { unmount } = mount();
    unmount();
    const before = useWorkflows.getState().nodes.length;
    addLibraryNode(getTemplate('l2i')!);
    expect(useWorkflows.getState().nodes.length).toBe(before + 1);
    expect(useWorkflows.getState().nodes.at(-1)!.position).toEqual({ x: 0, y: 0 });
  });
});
