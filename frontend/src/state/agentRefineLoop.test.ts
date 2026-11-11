// @vitest-environment jsdom
// The refinement loop in the store: after each answer the app sends the assistant back for the next picture until the
// assistant finishes, the pictures are used up, or the user writes, stops or a request fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AgentRequest } from '@/backend';
import { currentMessages, useAgent } from './agent';
import { scriptAgent, type ScriptCall } from './agentTools.testkit';
import { useSettings } from './settings';

let requests: AgentRequest[] = [];

/** The assistant runs `script(call, turn)` in each request (turn counts from 1) and answers "drawn". */
function assistant(script: (call: ScriptCall, turn: number) => Promise<void>) {
  return scriptAgent(async (call, request) => {
    requests.push(request);
    await script(call, requests.length);
    return 'drawn';
  });
}

const settled = () => vi.waitFor(() => expect(useAgent.getState().busy).toBe(false));

beforeEach(() => {
  localStorage.clear();
  requests = [];
  useAgent.setState({ sessions: [], currentId: null, busy: false, busySessionId: null, permission: null, working: [], queued: [], refining: null, draftText: '', draftAttached: [] });
  useSettings.getState().set({ assistantTrialPictures: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the refinement loop', { tags: [] }, () => {
  it(
    'sends the assistant back for each next picture until it finishes, and notes each in the chat',
    { tags: ['scenario', 'state-transition'] },
    async () => {
      const chat = assistant(async (call, turn) => {
        if (turn === 1) await call('refine', { action: 'start', goal: 'like the picture', targets: ['t.png'], maxRounds: 5 });
        if (turn === 4) await call('refine', { action: 'finish', summary: 'close' });
      });
      await useAgent.getState().send('make it like this', ['t.png']);
      await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(4));
      await settled();
      expect(chat).toHaveBeenCalledTimes(4);
      expect(useAgent.getState().refining).toBeNull();
      expect(currentMessages(useAgent.getState()).flatMap((m) => (m.step ? [m.step] : []))).toEqual([
        { n: 2, of: 5 },
        { n: 3, of: 5 },
        { n: 4, of: 5 },
      ]);
      expect(requests[1]!.message).toContain('refinement picture 2 of 5');
      expect(requests[1]!.message).toContain('Target pictures: t.png');
      expect(requests[1]!.history?.[0]?.text).toContain('make it like this');
    },
  );

  it('stops at the last picture even when the assistant never finishes', { tags: ['boundary', 'state-transition'] }, async () => {
    const chat = assistant(async (call, turn) => {
      if (turn === 1) await call('refine', { action: 'start', goal: 'g', maxRounds: 3 });
    });
    await useAgent.getState().send('go');
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(3));
    await settled();
    expect(chat).toHaveBeenCalledTimes(3);
    expect(useAgent.getState().refining).toBeNull();
  });

  it('goes on to 30 pictures when the assistant names no number', { tags: ['boundary'], timeout: 30_000 }, async () => {
    const chat = assistant(async (call, turn) => {
      if (turn === 1) await call('refine', { action: 'start', goal: 'g' });
    });
    await useAgent.getState().send('go');
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(30), { timeout: 20_000 });
    await settled();
    expect(chat).toHaveBeenCalledTimes(30);
  });

  it('does not start without trial pictures allowed', { tags: ['condition'] }, async () => {
    useSettings.getState().set({ assistantTrialPictures: false });
    let answer: unknown;
    assistant(async (call) => {
      answer = await call('refine', { action: 'start', goal: 'g' });
    });
    await useAgent.getState().send('go');
    await settled();
    expect(answer).toMatchObject({ ok: false });
    expect(requests).toHaveLength(1);
    expect(useAgent.getState().refining).toBeNull();
  });

  it(
    'ends when the user writes a message meanwhile, which is sent in place of the next picture',
    { tags: ['state-transition'] },
    async () => {
      const chat = assistant(async (call, turn) => {
        if (turn === 1) {
          await call('refine', { action: 'start', goal: 'g', maxRounds: 30 });
          useAgent.getState().queue('do this instead');
        }
      });
      await useAgent.getState().send('go');
      await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
      await settled();
      expect(chat).toHaveBeenCalledTimes(2);
      expect(requests[1]!.message).toBe('do this instead');
      expect(useAgent.getState().refining).toBeNull();
    },
  );

  it('ends when a request fails', { tags: ['error-guessing', 'state-transition'] }, async () => {
    const chat = scriptAgent(async (call, request) => {
      requests.push(request);
      if (requests.length === 1) await call('refine', { action: 'start', goal: 'g', maxRounds: 30 });
      if (requests.length === 2) throw new Error('boom');
      return 'drawn';
    });
    await useAgent.getState().send('go');
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    await settled();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(useAgent.getState().refining).toBeNull();
  });

  it('does not follow the user into another chat', { tags: ['state-transition'] }, async () => {
    const chat = assistant(async (call, turn) => {
      if (turn === 1) await call('refine', { action: 'start', goal: 'g', maxRounds: 30 });
      if (turn === 2) useAgent.getState().newSession();
    });
    await useAgent.getState().send('go');
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    await settled();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(useAgent.getState().refining).toBeNull();
  });

  it('ends when the user presses stop', { tags: ['state-transition'] }, async () => {
    const chat = assistant(async (call, turn) => {
      if (turn === 1) await call('refine', { action: 'start', goal: 'g', maxRounds: 30 });
      if (turn === 2) useAgent.getState().cancel();
    });
    await useAgent.getState().send('go');
    await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    await settled();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(useAgent.getState().refining).toBeNull();
  });
});
