// @vitest-environment jsdom
// When the assistant floats over a screen without it in a right column.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgent } from '@/state/agent';
import { useUi, type TabName } from '@/state/ui';
import { AgentHost } from './AgentHost';

vi.mock('./AgentWindow', () => ({ AgentWindow: () => <div data-testid="agent-window" /> }));

const agentStart = useAgent.getState();
const uiStart = useUi.getState();
const go = (tab: TabName) => act(() => useUi.setState({ activeTab: tab }));
const floating = () => screen.queryByTestId('agent-window') !== null;

beforeEach(() => {
  useAgent.setState({ ...agentStart, open: false, pendingAsk: null, permission: null }, true);
  useUi.setState({ ...uiStart, activeTab: 'generate' }, true);
  render(<AgentHost />);
});
afterEach(() => {
  cleanup();
  useAgent.setState(agentStart, true);
  useUi.setState(uiStart, true);
});

describe('AgentHost', () => {
  it('does not follow the assistant left open in a right column onto the screens without one', { tags: ['boundary', 'state-transition'] }, () => {
    act(() => useAgent.getState().setOpen(true));
    expect(floating()).toBe(false);
    for (const tab of ['models', 'browse', 'queue', 'extensions'] as const) {
      go(tab);
      expect(floating(), tab).toBe(false);
    }
  });

  it('floats on the screen a question was asked from, and only there', { tags: ['scenario'] }, () => {
    go('extensions');
    act(() => useAgent.setState({ open: true, pendingAsk: 'about this pack' }));
    expect(floating()).toBe(true);
    go('models');
    expect(floating()).toBe(false);
    go('extensions');
    expect(floating()).toBe(true);
  });

  it('floats for a question asked while the assistant was already open in a right column', { tags: ['state-transition', 'scenario'] }, () => {
    act(() => useAgent.getState().setOpen(true));
    go('extensions');
    expect(floating()).toBe(false);
    act(() => useAgent.setState({ pendingAsk: 'about these results' }));
    expect(floating()).toBe(true);
  });

  it('floats for a permission question on a screen without the column, and closes with the assistant', { tags: ['error-guessing', 'state-transition'] }, () => {
    go('queue');
    act(() => useAgent.setState({ open: true, permission: { tool: 'web_fetch' } as never }));
    expect(floating()).toBe(true);
    act(() => useAgent.getState().setOpen(false));
    expect(floating()).toBe(false);
  });

  it('opening the assistant on a screen with the column never floats it there', { tags: ['scenario'] }, () => {
    go('canvas');
    act(() => useAgent.setState({ open: true, pendingAsk: 'hi' }));
    expect(floating()).toBe(false);
  });
});
