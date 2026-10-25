// @vitest-environment jsdom
// The prompt for a phone that asks to pair while the popover is closed: one toast per request, with the number, answered
// from the toast; the popover takes over while it is open; and nothing for a page that has no home network.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanApi } from '@/backend';
import { createMockLan } from '@/backend/mock/mockLan';
import { resetLan, useLan } from '@/state/lan';
import { useToasts } from '@/state/toasts';

const { getLanApi } = vi.hoisted(() => ({ getLanApi: vi.fn<() => Promise<LanApi | null>>() }));
vi.mock('@/backend', async (orig) => ({ ...(await orig<typeof import('@/backend')>()), getLanApi }));

const { LanApprovals } = await import('./LanApprovals');

async function mount() {
  await act(async () => {
    render(<LanApprovals />);
  });
}

const toasts = () => useToasts.getState().toasts;

describe('LanApprovals', () => {
  beforeEach(() => {
    resetLan();
    useToasts.setState({ toasts: [] });
  });
  afterEach(() => {
    cleanup();
    resetLan();
    getLanApi.mockReset();
  });

  it('asks nothing of a page with no home network', async () => {
    getLanApi.mockResolvedValue(null);
    await mount();
    expect(toasts()).toEqual([]);
  });

  it('asks nothing while nobody is asking', async () => {
    getLanApi.mockResolvedValue(createMockLan('open'));
    await mount();
    expect(toasts()).toEqual([]);
  });

  it('shows a toast with the name, the address and the number, once per request, and allows from it', async () => {
    const lan = createMockLan('open');
    lan.askToPair('iPhone', '192.168.1.20');
    getLanApi.mockResolvedValue(lan);
    await mount();
    expect(toasts()).toHaveLength(1);
    const [shown] = toasts();
    expect(shown?.title).toBe('iPhone がつなごうとしています');
    expect(shown?.description).toMatch(/^192\.168\.1\.20 · 確認番号 \d{3} \d{3}$/);
    expect(shown?.actions?.map((a) => a.label)).toEqual(['許可', '断る']);
    // Reading the state again does not stack a second toast for the same request.
    await act(async () => {
      await useLan.getState().refresh();
    });
    expect(toasts()).toHaveLength(1);
    await act(async () => {
      shown?.actions?.[0]?.run();
      await Promise.resolve();
    });
    await act(async () => {
      await useLan.getState().refresh();
    });
    expect((await lan.state())?.devices.map((d) => d.label)).toEqual(['iPhone']);
    expect(toasts()).toEqual([]);
  });

  it('refuses from the toast, and drops the toast of a request that went away', async () => {
    const lan = createMockLan('open');
    lan.askToPair('iPhone', '192.168.1.20');
    lan.askToPair('Pixel', '192.168.1.21');
    getLanApi.mockResolvedValue(lan);
    await mount();
    expect(toasts()).toHaveLength(2);
    const [pending] = (await lan.state())?.pending ?? [];
    await act(async () => {
      toasts()[0]?.actions?.[1]?.run();
      await Promise.resolve();
    });
    await act(async () => {
      await useLan.getState().refresh();
    });
    expect((await lan.state())?.pending.map((p) => p.id)).not.toContain(pending?.id);
    expect(toasts()).toHaveLength(1);
    // The other one is answered elsewhere (the popover, or the phone gave up): its toast goes.
    const [left] = (await lan.state())?.pending ?? [];
    await lan.deny(left?.id ?? '');
    await act(async () => {
      await useLan.getState().refresh();
    });
    expect(toasts()).toEqual([]);
  });

  it('leaves the requests to the popover while it is open', async () => {
    const lan = createMockLan('open');
    lan.askToPair('iPhone', '192.168.1.20');
    getLanApi.mockResolvedValue(lan);
    await mount();
    expect(toasts()).toHaveLength(1);
    await act(async () => {
      useLan.getState().setPopoverOpen(true);
    });
    expect(toasts()).toEqual([]);
    await act(async () => {
      useLan.getState().setPopoverOpen(false);
    });
    expect(toasts()).toHaveLength(1);
  });
});
