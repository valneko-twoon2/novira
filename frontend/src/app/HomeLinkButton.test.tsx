// @vitest-environment jsdom
// The side bar's QR item and its popover: absent without a home network, then open or closed, trusting a network once,
// the pairing code with its countdown, and approving, refusing and disconnecting phones (against the mock's home network).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanApi } from '@/backend';
import { createMockLan, type MockLan } from '@/backend/mock/mockLan';
import { resetLan, useLan } from '@/state/lan';
import { useToasts } from '@/state/toasts';

const { getLanApi } = vi.hoisted(() => ({ getLanApi: vi.fn<() => Promise<LanApi | null>>() }));
vi.mock('@/backend', async (orig) => ({ ...(await orig<typeof import('@/backend')>()), getLanApi }));

const { HomeLinkButton } = await import('./HomeLinkButton');
const { clock, groupedNumber, qrPath } = await import('./LanPanel');

async function show(lan: LanApi | null) {
  getLanApi.mockResolvedValue(lan);
  await act(async () => {
    render(<HomeLinkButton />);
  });
}

async function press(id: string) {
  const button = await screen.findByTestId(id);
  await act(async () => {
    fireEvent.click(button);
  });
}

async function refresh() {
  await act(async () => {
    await useLan.getState().refresh();
  });
}

describe('the pieces of the panel', () => {
  it('draws each dark module as a square inside the quiet zone', () => {
    const link = { size: 3, modules: '100010001' };
    expect(qrPath(link)).toBe('M4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z');
    expect(qrPath({ ...link, modules: '000000000' })).toBe('');
  });

  it('writes the time left as m:ss and the number in two groups', () => {
    expect([clock(120), clock(59.4), clock(-3), clock(61)]).toEqual(['2:00', '0:59', '0:00', '1:01']);
    expect(groupedNumber('482913')).toBe('482 913');
    expect(groupedNumber('12')).toBe('12');
  });
});

describe('HomeLinkButton', () => {
  beforeEach(() => {
    resetLan();
    useToasts.setState({ toasts: [] });
  });
  afterEach(() => {
    cleanup();
    resetLan();
    getLanApi.mockReset();
  });

  it('is absent where there is no home network (the desktop app, a phone, a page that cannot read the state)', async () => {
    await show(null);
    expect(screen.queryByTestId('home-link-open')).toBeNull();
  });

  it('opens a closed home network at the press, trusting the network it is on, and shows the code', async () => {
    const lan = createMockLan();
    await show(lan);
    await press('home-link-open');
    expect(await screen.findByTestId('home-link-code')).not.toBeNull();
    expect((await lan.state())?.open).toBe(true);
    expect((await lan.state())?.network).toMatchObject({ trusted: true });
    expect(screen.queryByTestId('lan-open')).toBeNull();
  });

  it('shows the code with its countdown, and a new one when it ran out', async () => {
    const lan = createMockLan('open');
    await show(lan);
    await press('home-link-open');
    const code = await screen.findByTestId('home-link-code');
    expect(code.getAttribute('viewBox')).toBe('0 0 29 29');
    expect(code.getAttribute('class')).not.toContain('is-expired');
    expect(screen.getByTestId('lan-expires').textContent).toMatch(/\d:\d\d/);
    expect(screen.queryByTestId('lan-new-code')).toBeNull();
    const real = Date.now;
    Date.now = () => real() + 121_000;
    try {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });
      expect(screen.getByTestId('home-link-code').getAttribute('class')).toContain('is-expired');
      await press('lan-new-code');
      await waitFor(() => expect(screen.getByTestId('home-link-code').getAttribute('class')).not.toContain('is-expired'));
    } finally {
      Date.now = real;
    }
  });

  it('lists a phone that asks with its number, and allows it, refuses it, or disconnects it later', async () => {
    const lan = createMockLan('open');
    await show(lan);
    await press('home-link-open');
    lan.askToPair('iPhone', '192.168.1.20');
    lan.askToPair('Pixel', '192.168.1.21');
    await refresh();
    const [first, second] = (await lan.state())?.pending ?? [];
    const row = await screen.findByTestId(`lan-pending-${first?.id}`);
    expect(row.textContent).toContain('iPhone');
    expect(row.textContent).toContain('192.168.1.20');
    expect(row.textContent).toContain(groupedNumber(first?.confirm ?? ''));
    await press(`lan-allow-${first?.id}`);
    await press(`lan-deny-${second?.id}`);
    expect((await screen.findByTestId(`lan-device-${first?.id}`)).textContent).toContain('iPhone');
    expect(screen.queryByTestId(`lan-pending-${second?.id}`)).toBeNull();
    await press(`lan-revoke-${first?.id}`);
    await waitFor(() => expect(screen.queryByTestId(`lan-device-${first?.id}`)).toBeNull());
    expect((await lan.state())?.devices).toEqual([]);
  });

  it('has no button to close the home network or to stop trusting it', async () => {
    const lan = createMockLan('open');
    await show(lan);
    await press('home-link-open');
    await screen.findByTestId('home-link-code');
    expect(screen.queryByTestId('lan-close')).toBeNull();
  });

  it('warns when Windows calls the network public, but still opens it', async () => {
    const lan = createMockLan('public');
    await show(lan);
    await press('home-link-open');
    expect(await screen.findByTestId('lan-public')).not.toBeNull();
    expect(await screen.findByTestId('home-link-code')).not.toBeNull();
  });

  it('says why it cannot open when there is no home address or no known gateway', async () => {
    const lan = createMockLan();
    const base = await lan.state();
    if (!base) throw new Error('state');
    for (const [change, text] of [
      [{ address: null }, 'アドレスが見つかりません'],
      [{ network: { ...base.network, gatewayMac: null } }, 'ゲートウェイを確認できない'],
    ] as const) {
      cleanup();
      resetLan();
      await show({ ...lan, state: async () => ({ ...base, ...change }) });
      await press('home-link-open');
      expect((await screen.findByTestId('lan-reason')).textContent).toContain(text);
      expect(screen.queryByTestId('lan-open')).toBeNull();
    }
  });

  it('shows on the item how many phones wait', async () => {
    const lan: MockLan = createMockLan('open');
    lan.askToPair('iPhone', '192.168.1.20');
    await show(lan);
    expect(screen.getByTestId('home-link-open').textContent).toContain('1');
  });
});
