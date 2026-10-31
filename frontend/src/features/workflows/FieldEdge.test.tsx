// @vitest-environment jsdom
// The workflow edge: coloured by the type it carries, red when the two ends do not fit, animated while a run is on,
// and labelled with the two handles when the editor setting is on.
import type { EdgeProps } from '@xyflow/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueue } from '@/state/queue';
import { useWorkflows } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { getTemplate } from './templates';
import { FieldEdge } from './FieldEdge';

// React Flow's drawing parts become plain elements: what matters here is the props FieldEdge hands them.
vi.mock('@xyflow/react', () => ({
  BaseEdge: (p: { id: string; path: string; className: string; style: { stroke: string } }) => (
    <i data-testid="edge" id={p.id} data-d={p.path} className={p.className} style={{ stroke: p.style.stroke }} />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div data-testid="labels">{children}</div>,
  getBezierPath: () => ['M0,0', 5, 6],
}));

const initial = useWorkflows.getState();
const initialQueue = useQueue.getState();

const node = (type: string, id: string) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id });

function setGraph(nodes: ReturnType<typeof node>[], settings: Partial<typeof initial.settings> = {}) {
  useWorkflows.setState({ ...initial, nodes, settings: { ...initial.settings, showEdgeLabels: false, animatedEdges: false, ...settings } }, true);
}

function edgeProps(e: ReturnType<typeof makeEdge>, selected = false) {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandleId: e.sourceHandle,
    targetHandleId: e.targetHandle,
    sourceX: 0,
    sourceY: 0,
    targetX: 10,
    targetY: 10,
    sourcePosition: 'right',
    targetPosition: 'left',
    selected,
  } as unknown as EdgeProps;
}

beforeEach(() => {
  setGraph([node('sdxl_model_loader', 'model'), node('denoise_latents', 'denoise'), node('save_image', 'save')]);
});
afterEach(() => {
  cleanup();
  useWorkflows.setState(initial, true);
  useQueue.setState(initialQueue, true);
});

describe('FieldEdge', () => {
  it('is coloured by the type it carries when the ends fit', () => {
    const { getByTestId, queryByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet'))} />);
    const edge = getByTestId('edge');
    expect(edge.style.stroke).toBe('var(--wf-c-UNetField)');
    expect(edge.getAttribute('class')).not.toContain('is-invalid');
    expect(edge.getAttribute('class')).not.toContain('is-animated');
    expect(queryByTestId('labels')).toBeNull();
  });

  it('is red and marked invalid when the ends do not fit', () => {
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'save', 'image'))} />);
    expect(getByTestId('edge').style.stroke).toBe('var(--danger)');
    expect(getByTestId('edge').getAttribute('class')).toContain('is-invalid');
  });

  it('is red when a node of the edge is gone', () => {
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('ghost', 'unet', 'denoise', 'unet'))} />);
    expect(getByTestId('edge').getAttribute('class')).toContain('is-invalid');
  });

  it('marks a selected edge, and animates with the setting', () => {
    setGraph(useWorkflows.getState().nodes, { animatedEdges: true });
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet'), true)} />);
    const cls = getByTestId('edge').getAttribute('class')!;
    expect(cls).toContain('is-selected');
    expect(cls).toContain('is-animated');
  });

  it('animates while a workflow run is in progress', () => {
    useQueue.setState({ items: [{ id: 'q1', status: 'in_progress', origin: 'workflows' }] } as never);
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet'))} />);
    expect(getByTestId('edge').getAttribute('class')).toContain('is-animated');
  });

  it('does not animate for a run of another screen', () => {
    useQueue.setState({ items: [{ id: 'q1', status: 'in_progress', origin: 'generate' }] } as never);
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet'))} />);
    expect(getByTestId('edge').getAttribute('class')).not.toContain('is-animated');
  });

  it('labels the edge with both handles at the middle when the setting is on', () => {
    setGraph(useWorkflows.getState().nodes, { showEdgeLabels: true });
    const { getByTestId } = render(<FieldEdge {...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet'))} />);
    const label = getByTestId('labels').querySelector('.wf-edge__label') as HTMLElement;
    expect(label.textContent).toMatch(/.+ → .+/);
    expect(label.style.transform).toContain('translate(5px, 6px)');
  });

  it('shows no label for an edge without handles', () => {
    setGraph(useWorkflows.getState().nodes, { showEdgeLabels: true });
    const props = { ...edgeProps(makeEdge('model', 'unet', 'denoise', 'unet')), sourceHandleId: null };
    const { queryByTestId } = render(<FieldEdge {...props} />);
    expect(queryByTestId('labels')).toBeNull();
  });
});
