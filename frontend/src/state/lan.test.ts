// The home network store: read once, then every few seconds only while something could change without us (it is open, or
// the dialog is), and nothing for a page that has no home network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanApi, LanState, RemoteState } from '@/backend';

const getLanApi = vi.fn<() => Promise<LanApi | null>>();
vi.mock('@/backend', async (orig) => ({ ...(await orig<typeof import('@/backend')>()), getLanApi }));

const { FAST_MS, SLOW_MS, resetLan, useLan } = await import('./lan');

const state = (open: boolean): LanState => ({
  open,
  address: '192.168.1.5',
  port: open ? 8443 : null,
  network: { gatewayMac: '02:11:22:33:44:55', trusted: true, label: 'home' },
  windowsPublic: false,
  idleSecs: null,
  idleLimitSecs: 1800,
  codes: 0,
  devices: [],
  pending: [],
  trustedNetworks: [],
});

function api(read: () => LanState | null, remote: () => RemoteState | null = () => null): LanApi & { state: ReturnType<typeof vi.fn>; remoteState: ReturnType<typeof vi.fn> } {
  return { state: vi.fn(async () => read()), remoteState: vi.fn(async () => remote()) } as unknown as LanApi & {
    state: ReturnType<typeof vi.fn>;
    remoteState: ReturnType<typeof vi.fn>;
  };
}

const away = (enabled: boolean): RemoteState => ({
  enabled,
  open: enabled,
  problem: null,
  detail: null,
  name: enabled ? 'pc.tail1234.ts.net' : null,
  address: null,
  port: null,
  url: null,
  codes: 0,
  pending: [],
  devices: [],
  passkeys: [],
  log: [],
  unusedDays: 14,
});

describe('the home network store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getLanApi.mockReset();
    resetLan();
  });
  afterEach(() => {
    resetLan();
    vi.useRealTimers();
  });

  it('has nothing for a page with no home network, and asks once', async () => {
    getLanApi.mockResolvedValue(null);
    await useLan.getState().init();
    await useLan.getState().init();
    expect(getLanApi).toHaveBeenCalledTimes(1);
    expect(useLan.getState()).toMatchObject({ api: null, state: null });
    await vi.advanceTimersByTimeAsync(60_000);
  });

  it('reads once while closed and then waits for something to change it', async () => {
    const a = api(() => state(false));
    getLanApi.mockResolvedValue(a);
    await useLan.getState().init();
    expect(a.state).toHaveBeenCalledTimes(1);
    expect(useLan.getState().state?.open).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.state).toHaveBeenCalledTimes(1);
  });

  it('keeps reading while open, faster while the dialog is open, and stops when it is closed again', async () => {
    let open = true;
    const a = api(() => state(open));
    getLanApi.mockResolvedValue(a);
    await useLan.getState().init();
    await vi.advanceTimersByTimeAsync(SLOW_MS * 2);
    expect(a.state).toHaveBeenCalledTimes(3);
    useLan.getState().setDialogOpen(true);
    await vi.advanceTimersByTimeAsync(FAST_MS * 3);
    expect(a.state.mock.calls.length).toBeGreaterThanOrEqual(6);
    useLan.getState().setDialogOpen(false);
    open = false;
    await vi.advanceTimersByTimeAsync(SLOW_MS);
    const settled = a.state.mock.calls.length;
    expect(useLan.getState().state?.open).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.state).toHaveBeenCalledTimes(settled);
  });

  it('reads the remote listener with the home network, and none where the server has none', async () => {
    let on = false;
    const a = api(
      () => state(true),
      () => away(on),
    );
    getLanApi.mockResolvedValue(a);
    await useLan.getState().init();
    expect(useLan.getState().remote?.enabled).toBe(false);
    on = true;
    await vi.advanceTimersByTimeAsync(SLOW_MS);
    expect(useLan.getState().remote?.name).toBe('pc.tail1234.ts.net');
    expect(a.remoteState).toHaveBeenCalledTimes(a.state.mock.calls.length);
    resetLan();
    getLanApi.mockResolvedValue(api(() => state(false)));
    await useLan.getState().init();
    expect(useLan.getState().remote).toBeNull();
  });

  it('forgets the state of a server that stops answering', async () => {
    let answer: LanState | null = state(true);
    const a = api(() => answer);
    getLanApi.mockResolvedValue(a);
    await useLan.getState().init();
    expect(useLan.getState().state).not.toBeNull();
    answer = null;
    await vi.advanceTimersByTimeAsync(SLOW_MS);
    expect(useLan.getState().state).toBeNull();
  });
});
