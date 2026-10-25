import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useToasts } from '@/state/toasts';
import { EMPTY_META, useWorkflows, type WorkflowEdge, type WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { AUTO_OPTIMIZE_DELAY_MS, optimizeWorkflow, startAutoOptimize } from './optimizeWorkflow';
import { getTemplate } from './templates';

const initial = useWorkflows.getState();
const w = () => useWorkflows.getState();
const node = (type: string, id: string, inputs: Record<string, unknown> = {}): WorkflowNode => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });
const load = (nodes: WorkflowNode[], edges: WorkflowEdge[] = []) => w().setGraph({ nodes, edges, meta: { ...EMPTY_META }, form: [] });
const ids = () => w().nodes.map((n) => n.id);
const toasts = () => useToasts.getState().toasts;

/** A save node fed by an image node twice over (two identical image nodes), plus an unconnected integer node. */
function messyGraph() {
  load(
    [node('image', 'img1', { image: 'a.png' }), node('image', 'img2', { image: 'a.png' }), node('img_blur', 'blur'), node('save_image', 'save'), node('integer', 'lonely')],
    [makeEdge('img1', 'image', 'blur', 'image'), makeEdge('img2', 'image', 'save', 'image')],
  );
}

beforeEach(() => {
  useWorkflows.setState(initial, true);
  useWorkflows.getState().setSettings({ autoTidy: true });
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe('optimizeWorkflow', () => {
  it('applies the optimization as one undo step and reports what changed', () => {
    messyGraph();
    const summary = optimizeWorkflow();
    expect(summary).toMatchObject({ merged: 1, removed: 2, edgesRemoved: 1 });
    expect(ids()).toEqual(['img1', 'save']);
    expect(w().edges.map((e) => `${e.source}>${e.target}`)).toEqual(['img1>save']);
    expect(toasts().at(-1)).toMatchObject({ status: 'success', title: t('workflows.optimize.done'), description: t('workflows.optimize.summary', { merged: 1, removed: 2, edges: 1 }) });
    expect(w().past).toHaveLength(1);
    w().undo();
    expect(ids()).toEqual(['img1', 'img2', 'blur', 'save', 'lonely']);
    w().redo();
    expect(ids()).toEqual(['img1', 'save']);
  });

  it('says so and saves no undo step when there is nothing to optimize', () => {
    messyGraph();
    optimizeWorkflow();
    const past = w().past.length;
    expect(optimizeWorkflow()).toBeNull();
    expect(w().past).toHaveLength(past);
    expect(toasts().at(-1)).toMatchObject({ status: 'info', title: t('workflows.optimize.nothing') });
  });

  it('the automatic run keeps unconnected nodes and stays quiet when it only moves nodes', () => {
    // img2 duplicates img1 but is not wired yet: the user may still be setting it up.
    load([node('image', 'img1', { image: 'a.png' }), node('image', 'img2', { image: 'a.png' }), node('save_image', 'save'), node('integer', 'lonely')], [
      makeEdge('img1', 'image', 'save', 'image'),
    ]);
    const summary = optimizeWorkflow('auto');
    expect(summary).toMatchObject({ merged: 0, removed: 0, edgesRemoved: 0 });
    expect(summary!.moved).toBeGreaterThan(0);
    expect(ids()).toHaveLength(4);
    expect(toasts()).toEqual([]);
  });
});

describe('startAutoOptimize', () => {
  const twoLoaders = () =>
    load([
      node('main_model_loader', 'm1', { model: 'x' }),
      node('main_model_loader', 'm2', { model: 'x' }),
      node('compel', 'pos', { prompt: 'a' }),
      node('compel', 'neg', { prompt: 'b' }),
    ]);

  it('re-optimizes a moment after a connection is made', () => {
    vi.useFakeTimers();
    twoLoaders();
    const stop = startAutoOptimize();
    w().connect(makeEdge('m1', 'clip', 'pos', 'clip'));
    w().connect(makeEdge('m2', 'clip', 'neg', 'clip'));
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS - 1);
    expect(ids()).toContain('m2');
    vi.advanceTimersByTime(1);
    expect(ids()).not.toContain('m2');
    expect(w().edges.map((e) => `${e.source}>${e.target}`).sort()).toEqual(['m1>neg', 'm1>pos']);
    expect(toasts().at(-1)).toMatchObject({ title: t('workflows.optimize.autoDone') });
    // The automatic run is its own undo step and is not run again after undo.
    w().undo();
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 2);
    expect(ids()).toContain('m2');
    stop();
  });

  it('does not run on moves, and waits while the user is dragging', () => {
    vi.useFakeTimers();
    twoLoaders();
    let busy = false;
    const stop = startAutoOptimize(() => busy);
    w().onNodesChange([{ type: 'position', id: 'm1', position: { x: 500, y: 500 }, dragging: true }]);
    w().onNodesChange([{ type: 'position', id: 'm1', dragging: false }]);
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 2);
    expect(w().nodes.find((n) => n.id === 'm1')!.position).toEqual({ x: 500, y: 500 });
    busy = true;
    w().connect(makeEdge('m1', 'clip', 'pos', 'clip'));
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 3);
    expect(w().nodes.find((n) => n.id === 'm1')!.position).toEqual({ x: 500, y: 500 });
    busy = false;
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS);
    expect(w().nodes.find((n) => n.id === 'm1')!.position).not.toEqual({ x: 500, y: 500 });
    stop();
  });

  it('does nothing while the setting is off, and stops when asked', () => {
    vi.useFakeTimers();
    twoLoaders();
    w().setSettings({ autoTidy: false });
    const stop = startAutoOptimize();
    w().connect(makeEdge('m1', 'clip', 'pos', 'clip'));
    w().connect(makeEdge('m2', 'clip', 'neg', 'clip'));
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 2);
    expect(ids()).toContain('m2');
    w().setSettings({ autoTidy: true });
    stop();
    w().addNodes([node('integer', 'i')]);
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 2);
    expect(ids()).toContain('m2');
  });

  it('a waiting run is dropped when another graph is opened', () => {
    vi.useFakeTimers();
    twoLoaders();
    const stop = startAutoOptimize();
    w().connect(makeEdge('m1', 'clip', 'pos', 'clip'));
    load([node('integer', 'a', { value: 1 }), node('integer', 'b', { value: 1 }), node('integer_math', 'x')], [makeEdge('a', 'value', 'x', 'a'), makeEdge('b', 'value', 'x', 'b')]);
    vi.advanceTimersByTime(AUTO_OPTIMIZE_DELAY_MS * 2);
    expect(ids()).toEqual(['a', 'b', 'x']);
    stop();
  });
});
