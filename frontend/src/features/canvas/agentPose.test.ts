// @vitest-environment jsdom
// The assistant places a pose on the canvas through the registered editor, and its answer can be undone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgent } from '@/state/agent';
import { scriptAgent } from '@/state/agentTools.testkit';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { useUi } from '@/state/ui';
import { registerCanvasFeature } from './register';

const initial = { canvas: useCanvas.getState(), agent: useAgent.getState() };
const poses = () => useCanvas.getState().entities.flatMap((e) => e.objects.filter((o): o is PoseObject => o.kind === 'pose'));

beforeEach(() => {
  registerCanvasFeature();
  useCanvas.setState(initial.canvas, true);
  useAgent.setState({ ...initial.agent, sessions: [], currentId: null });
  useUi.setState({ activeTab: 'canvas' });
});
afterEach(() => vi.restoreAllMocks());

describe('the assistant and the pose tool', () => {
  it('places the described person, reads the poses on the layer back, and undoes the change', async () => {
    const read: unknown[] = [];
    scriptAgent(async (call) => {
      read.push((await call('get_pose')).content);
      if (read.length === 1) await call('set_pose', { people: [{ lean: 7, rArm: { upper: -170, fore: -175 } }] });
    });
    await useAgent.getState().send('a pose with the right hand up');
    expect(read[0]).toMatchObject({ poses: [] });
    expect(poses()).toHaveLength(1);

    await useAgent.getState().send('lean more');
    expect(read[1]).toMatchObject({ poses: [{ lean: 7, rArm: { upper: -170 } }] });

    const message = useAgent.getState().sessions[0]!.messages.filter((m) => m.role === 'assistant')[0]!;
    expect(message.tools).toEqual([{ kind: 'pose', count: 1 }]);
    expect(message.editSnapshots).toHaveProperty('canvas');
    useAgent.getState().undo(message.id);
    expect(useCanvas.getState().entities).toHaveLength(0);
  });

  it('applies nothing when no usable person was described, and tells the assistant', async () => {
    let answer: unknown;
    scriptAgent(async (call) => {
      answer = await call('set_pose', { people: [3] });
    });
    await useAgent.getState().send('a pose');
    expect(poses()).toHaveLength(0);
    expect(answer).toMatchObject({ ok: false });
  });
});
