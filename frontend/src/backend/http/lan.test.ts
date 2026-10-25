// @vitest-environment jsdom
// The home network calls of the server's own page: what each one sends, and that a refusal comes back as its reason.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpLanApi, serverLanApi } from './lan';

const reply = (status: number, body: unknown) => vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('the home network calls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.__NOVIRA_SERVER__;
  });

  it('exist only on a page the server served', () => {
    expect(serverLanApi()).toBeNull();
    window.__NOVIRA_SERVER__ = true;
    expect(serverLanApi()).toBe(httpLanApi);
  });

  it('read the state, and nothing when there is none for this page (a phone, a page that cannot read the state)', async () => {
    const state = { open: false, address: '192.168.1.5', port: null, devices: [], pending: [] };
    const fetch = reply(200, state);
    vi.stubGlobal('fetch', fetch);
    expect(await httpLanApi.state()).toEqual(state);
    expect(fetch).toHaveBeenCalledWith('/lan/state', { method: 'GET', credentials: 'same-origin' });
    for (const status of [403, 404]) {
      vi.stubGlobal('fetch', reply(status, { code: 'x' }));
      expect(await httpLanApi.state()).toBeNull();
    }
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    expect(await httpLanApi.state()).toBeNull();
  });

  it('send what the server reads, as JSON', async () => {
    const fetch = reply(200, { ok: true });
    vi.stubGlobal('fetch', fetch);
    await httpLanApi.trust('02:11:22:33:44:55', 'home');
    await httpLanApi.untrust('02:11:22:33:44:55');
    await httpLanApi.approve('a1');
    await httpLanApi.deny('a2');
    await httpLanApi.revoke('a3');
    await httpLanApi.open();
    await httpLanApi.close();
    const sent = fetch.mock.calls.map(([path, init]) => [path, init?.method, init?.body]);
    expect(sent).toEqual([
      ['/lan/trust', 'POST', JSON.stringify({ gatewayMac: '02:11:22:33:44:55', label: 'home' })],
      ['/lan/untrust', 'POST', JSON.stringify({ gatewayMac: '02:11:22:33:44:55' })],
      ['/pair/approve', 'POST', JSON.stringify({ id: 'a1' })],
      ['/pair/deny', 'POST', JSON.stringify({ id: 'a2' })],
      ['/pair/revoke', 'POST', JSON.stringify({ id: 'a3' })],
      ['/lan/open', 'POST', undefined],
      ['/lan/close', 'POST', undefined],
    ]);
  });

  it('bring a refusal back with its reason and, for an untrusted network, the gateway to confirm', async () => {
    vi.stubGlobal('fetch', reply(409, { code: 'untrusted_network', error: 'this network is not trusted yet', gatewayMac: '02:11:22:33:44:55' }));
    expect(await httpLanApi.open()).toEqual({ ok: false, code: 'untrusted_network', message: 'this network is not trusted yet', gatewayMac: '02:11:22:33:44:55' });
    vi.stubGlobal('fetch', reply(500, 'not json'));
    expect(await httpLanApi.close()).toMatchObject({ ok: false, code: 'failed' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    expect(await httpLanApi.open()).toMatchObject({ ok: false, code: 'offline' });
  });

  it('take a pairing code only when its modules fill the square', async () => {
    const good = { url: 'https://192.168.1.5:8124/pair#c0de', size: 2, modules: '1001', expiresIn: 120 };
    const fetch = reply(200, good);
    vi.stubGlobal('fetch', fetch);
    expect(await httpLanApi.pairingCode()).toEqual(good);
    expect(fetch).toHaveBeenCalledWith('/pair/code', { method: 'POST', credentials: 'same-origin' });
    vi.stubGlobal('fetch', reply(200, { ...good, size: 3 }));
    expect(await httpLanApi.pairingCode()).toBeNull();
    vi.stubGlobal('fetch', reply(404, { code: 'no_home_network' }));
    expect(await httpLanApi.pairingCode()).toBeNull();
  });
});
