// @vitest-environment jsdom
// The Nodes tab of the left panel: sections of folders that open and close, a search that lists what matches with
// where it sits, a double-click or Enter that adds a node, and the drag data a drop on the canvas reads.
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useWorkflows } from '@/state/workflows/workflows';
import { NODE_MIME } from './nodeAdder';
import { NodeLibrary } from './NodeLibrary';
import { allTemplates } from './templates';

const initial = useWorkflows.getState();
beforeEach(() => useWorkflows.setState(initial, true));
afterEach(cleanup);

const search = () => screen.getByLabelText(t('workflows.nodeLibrary.placeholder'));
// The folder of the image nodes holds nodes of its own; the first one (model) holds only folders.
const imageFolder = () => screen.getAllByTestId('wf-lib-group').find((g) => g.querySelector('.wf-nodes__label')?.textContent === 'image')!;

describe('the node library', () => {
  it('shows the nodes section with its folders closed, opens one on a click and closes it on the next', () => {
    render(<NodeLibrary />);
    expect(screen.getAllByTestId('wf-lib-group')[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByTestId('wf-lib-section')[0]!.textContent).toContain(t('workflows.nodeLibrary.section.core'));
    expect(screen.queryAllByTestId('wf-lib-item')).toHaveLength(0);
    fireEvent.click(imageFolder());
    expect(screen.getAllByTestId('wf-lib-item').length).toBeGreaterThan(0);
    expect(imageFolder().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(imageFolder());
    expect(screen.queryAllByTestId('wf-lib-item')).toHaveLength(0);
  });

  it('lists what a search matches with where it sits, and says when nothing matches', () => {
    render(<NodeLibrary />);
    fireEvent.change(search(), { target: { value: 'integer' } });
    const items = screen.getAllByTestId('wf-lib-item');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(allTemplates().length);
    expect(items[0]!.textContent).toContain(t('workflows.nodeLibrary.section.core'));
    expect(screen.queryAllByTestId('wf-lib-section')).toHaveLength(0);
    fireEvent.change(search(), { target: { value: 'zzzzzzzz' } });
    expect(screen.queryAllByTestId('wf-lib-item')).toHaveLength(0);
    expect(screen.getByText(t('workflows.picker.noResults'))).toBeTruthy();
  });

  it('adds the node that is double-clicked, selected, and nothing on a single click', () => {
    render(<NodeLibrary />);
    fireEvent.change(search(), { target: { value: 'integer' } });
    const before = useWorkflows.getState().nodes.length;
    const item = screen.getAllByTestId('wf-lib-item')[0]!;
    fireEvent.click(item);
    expect(useWorkflows.getState().nodes).toHaveLength(before);
    fireEvent.doubleClick(item);
    const { nodes } = useWorkflows.getState();
    expect(nodes).toHaveLength(before + 1);
    expect(nodes[nodes.length - 1]!.selected).toBe(true);
  });

  it('adds the node with Enter, and not with another key', () => {
    render(<NodeLibrary />);
    fireEvent.change(search(), { target: { value: 'integer' } });
    const before = useWorkflows.getState().nodes.length;
    const item = screen.getAllByTestId('wf-lib-item')[0]!;
    fireEvent.keyDown(item, { key: 'a' });
    expect(useWorkflows.getState().nodes).toHaveLength(before);
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(useWorkflows.getState().nodes).toHaveLength(before + 1);
  });

  it('carries the node type when dragged', () => {
    render(<NodeLibrary />);
    fireEvent.change(search(), { target: { value: 'integer' } });
    const item = screen.getAllByTestId('wf-lib-item')[0]!;
    const data: Record<string, string> = {};
    const event = createEvent.dragStart(item);
    Object.defineProperty(event, 'dataTransfer', { value: { setData: (k: string, v: string) => (data[k] = v), effectAllowed: '' } });
    fireEvent(item, event);
    expect(allTemplates().some((tpl) => tpl.type === data[NODE_MIME])).toBe(true);
  });
});
