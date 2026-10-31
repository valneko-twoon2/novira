// @vitest-environment jsdom
// The drag assist hooks and the handle that wears their state, with React Flow's connection state faked.
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflows } from '@/state/workflows/workflows';
import { AssistHandle, useDragFrom, useHandleAssist, useNodeBlocked } from './connectAssist';
import { createNode, makeEdge } from './graph';
import { getTemplate } from './templates';

type Conn = { inProgress: boolean; fromHandle?: { id: string | null; type: 'source' | 'target' }; fromNode: { id: string } };
const conn: { value: Conn } = { value: { inProgress: false, fromNode: { id: '' } } };

vi.mock('@xyflow/react', () => ({
  useConnection: (select: (c: Conn) => unknown) => select(conn.value),
  Handle: (p: { id?: string; className?: string }) => <div data-testid="handle" id={p.id} className={p.className} />,
}));

const initial = useWorkflows.getState();
const node = (type: string, id: string) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id });
const dragFromUnet = () => {
  conn.value = { inProgress: true, fromHandle: { id: 'unet', type: 'source' }, fromNode: { id: 'model' } };
};

beforeEach(() => {
  useWorkflows.setState({ ...initial, nodes: [node('sdxl_model_loader', 'model'), node('denoise_latents', 'denoise'), node('save_image', 'save')], edges: [] }, true);
  conn.value = { inProgress: false, fromNode: { id: '' } };
});
afterEach(() => {
  cleanup();
  useWorkflows.setState(initial, true);
});

describe('useDragFrom', () => {
  it('is null while no connection is in progress', () => {
    expect(renderHook(() => useDragFrom()).result.current).toBeNull();
  });

  it('is null for a drag that has no handle id', () => {
    conn.value = { inProgress: true, fromHandle: { id: null, type: 'source' }, fromNode: { id: 'model' } };
    expect(renderHook(() => useDragFrom()).result.current).toBeNull();
  });

  it('names the node, handle and side being dragged from', () => {
    dragFromUnet();
    expect(renderHook(() => useDragFrom()).result.current).toEqual({ nodeId: 'model', handle: 'unet', side: 'source' });
  });
});

describe('useHandleAssist', () => {
  it('is idle with no drag', () => {
    expect(renderHook(() => useHandleAssist('denoise', 'unet', 'target')).result.current).toBe('idle');
  });

  it('marks the origin, a handle that fits, and one that does not', () => {
    dragFromUnet();
    expect(renderHook(() => useHandleAssist('model', 'unet', 'source')).result.current).toBe('origin');
    expect(renderHook(() => useHandleAssist('denoise', 'unet', 'target')).result.current).toBe('ok');
    expect(renderHook(() => useHandleAssist('denoise', 'latents', 'target')).result.current).toBe('blocked');
  });

  it('blocks a handle whose connection would close a cycle', () => {
    useWorkflows.setState({ edges: [makeEdge('denoise', 'latents', 'model', 'unet')] });
    dragFromUnet();
    expect(renderHook(() => useHandleAssist('denoise', 'unet', 'target')).result.current).toBe('blocked');
  });
});

describe('useNodeBlocked', () => {
  it('is false with no drag', () => {
    expect(renderHook(() => useNodeBlocked('save', 'save_image')).result.current).toBe(false);
  });

  it('never dims the node the drag started from', () => {
    dragFromUnet();
    expect(renderHook(() => useNodeBlocked('model', 'sdxl_model_loader')).result.current).toBe(false);
  });

  it('dims a node with nothing that can take the drag, not one that can', () => {
    dragFromUnet();
    expect(renderHook(() => useNodeBlocked('save', 'save_image')).result.current).toBe(true);
    expect(renderHook(() => useNodeBlocked('denoise', 'denoise_latents')).result.current).toBe(false);
  });

  it('does not dim a node of an unknown type', () => {
    dragFromUnet();
    expect(renderHook(() => useNodeBlocked('x', 'no_such_type')).result.current).toBe(false);
  });
});

describe('AssistHandle', () => {
  const classOf = () => screen.getByTestId('handle').className;

  it('has no state class while idle and keeps the class it is given', () => {
    render(<AssistHandle nodeId="denoise" id="unet" type="target" position={'left' as never} className="mine" />);
    expect(classOf()).toBe('mine');
  });

  it.each([
    ['model', 'unet', 'source', 'is-origin'],
    ['denoise', 'unet', 'target', 'is-ok'],
    ['denoise', 'latents', 'target', 'is-blocked'],
  ] as const)('wears the class of its state (%s.%s)', (nodeId, id, type, cls) => {
    dragFromUnet();
    render(<AssistHandle nodeId={nodeId} id={id} type={type} position={'left' as never} />);
    expect(classOf()).toContain(cls);
  });
});
