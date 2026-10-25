// @vitest-environment jsdom
// The Face Rig node's button: it needs a gallery picture wired straight from a picture node, and shows how many parts are adjusted.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useWorkflows, type WorkflowNode } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { makeEdge } from '../graph';
import { FaceRigNodeWidget } from './FaceRigNodeWidget';

vi.mock('./FaceRigEditor', () => ({
  FaceRigEditor: (p: { open: boolean; imageName: string | null; onApply: (rig: string) => void }) =>
    p.open ? (
      <div data-testid="rig-editor" data-image={p.imageName}>
        <button onClick={() => p.onApply('{"v":1,"w":{"au12":0.5}}')}>apply</button>
      </div>
    ) : null,
}));

const initial = useWorkflows.getState();
const node = (id: string, type: string, inputs: Record<string, unknown>): WorkflowNode =>
  ({ id, type: 'invocation', position: { x: 0, y: 0 }, data: { type, label: '', notes: '', isOpen: true, useCache: true, inputs } }) as WorkflowNode;

beforeEach(() => useWorkflows.setState({ ...initial, nodes: [node('rig', 'comfy:MockFaceRig', {})], edges: [] }, true));
afterEach(cleanup);

const mount = () =>
  render(
    <TooltipProvider>
      <FaceRigNodeWidget nodeId="rig" />
    </TooltipProvider>,
  );

describe('the Face Rig node widget', () => {
  it('is disabled and asks for a picture while none is wired in', () => {
    mount();
    expect((screen.getByTestId('rig-open') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(t('workflows.faceRig.needsImage'))).toBeTruthy();
  });

  it('is disabled when the wired picture node has no picture yet', () => {
    useWorkflows.setState({ nodes: [node('rig', 'comfy:MockFaceRig', {}), node('src', 'image', { image: '' })], edges: [makeEdge('src', 'image', 'rig', 'image')] });
    mount();
    expect((screen.getByTestId('rig-open') as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the editor on the wired picture and stores what the editor applies', () => {
    useWorkflows.setState({ nodes: [node('rig', 'comfy:MockFaceRig', {}), node('src', 'image', { image: 'a.png' })], edges: [makeEdge('src', 'image', 'rig', 'image')] });
    mount();
    expect(screen.getByText(t('workflows.faceRig.adjusted', { count: 0 }))).toBeTruthy();
    fireEvent.click(screen.getByTestId('rig-open'));
    expect(screen.getByTestId('rig-editor').getAttribute('data-image')).toBe('a.png');
    fireEvent.click(screen.getByText('apply'));
    expect(useWorkflows.getState().nodes.find((n) => n.id === 'rig')!.data.inputs.rig).toBe('{"v":1,"w":{"au12":0.5}}');
    expect(screen.getByText(t('workflows.faceRig.adjusted', { count: 1 }))).toBeTruthy();
  });
});
