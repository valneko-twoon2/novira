// The mock's home network: the same steps the real one takes, so the QR item can be tried in a plain browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockLan, patternModules } from './mockLan';

describe('the mock home network', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens only on a network that was trusted, and says which gateway to confirm', async () => {
    const lan = createMockLan();
    const refused = await lan.open();
    expect(refused).toMatchObject({ ok: false, code: 'untrusted_network', gatewayMac: '02:11:22:33:44:55' });
    expect((await lan.state())?.open).toBe(false);
    expect(await lan.trust('02:99:99:99:99:99', 'home')).toMatchObject({ ok: false, code: 'network_changed' });
    expect(await lan.trust('02:11:22:33:44:55', 'home')).toEqual({ ok: true });
    expect(await lan.open()).toEqual({ ok: true });
    const state = await lan.state();
    expect(state).toMatchObject({ open: true, port: 51423, network: { trusted: true, label: 'home' } });
    expect(state?.trustedNetworks).toHaveLength(1);
  });

  it('starts open, or with Windows calling the network public, from the page flag', async () => {
    expect((await createMockLan('open').state())?.open).toBe(true);
    const pub = await createMockLan('public').state();
    expect(pub).toMatchObject({ open: false, windowsPublic: true });
  });

  it('makes a code only while open, and a phone asks to pair two seconds later', async () => {
    const lan = createMockLan('open');
    const code = await lan.pairingCode();
    expect(code?.modules).toHaveLength((code?.size ?? 0) ** 2);
    expect(code?.expiresIn).toBe(120);
    expect((await lan.state())?.pending).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    const asked = (await lan.state())?.pending ?? [];
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ label: 'iPhone' });
    expect(asked[0]?.confirm).toMatch(/^\d{6}$/);
    expect(await createMockLan().pairingCode()).toBeNull();
  });

  it('approves into a device, refuses, revokes, and forgets all of it on close', async () => {
    const lan = createMockLan('open');
    lan.askToPair('a', '192.168.1.30');
    lan.askToPair('b', '192.168.1.31');
    const [a, b] = (await lan.state())?.pending ?? [];
    expect(await lan.approve(a?.id ?? '')).toEqual({ ok: true });
    expect(await lan.approve(a?.id ?? '')).toMatchObject({ ok: false, code: 'unknown' });
    expect(await lan.deny(b?.id ?? '')).toEqual({ ok: true });
    let state = await lan.state();
    expect(state?.devices.map((d) => d.label)).toEqual(['a']);
    expect(state?.pending).toEqual([]);
    expect(await lan.revoke(a?.id ?? '')).toEqual({ ok: true });
    lan.askToPair('c', '192.168.1.32');
    await lan.close();
    state = await lan.state();
    expect(state).toMatchObject({ open: false, devices: [], pending: [] });
  });

  it('stops trusting a network and closes with it', async () => {
    const lan = createMockLan('open');
    expect(await lan.untrust('02:11:22:33:44:55')).toEqual({ ok: true });
    expect(await lan.state()).toMatchObject({ open: false, network: { trusted: false } });
    expect(await lan.untrust('02:11:22:33:44:55')).toMatchObject({ ok: false, code: 'unknown' });
  });

  it('draws a square with the three finder squares, different for each code', () => {
    const { size, modules } = patternModules('a');
    expect(modules).toHaveLength(size * size);
    const at = (x: number, y: number) => modules[y * size + x];
    expect([at(0, 0), at(size - 1, 0), at(0, size - 1), at(size - 1, size - 1)].slice(0, 3)).toEqual(['1', '1', '1']);
    expect(patternModules('b').modules).not.toBe(modules);
  });
});
