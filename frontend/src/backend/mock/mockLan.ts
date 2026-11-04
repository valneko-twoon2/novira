// The browser mock's stand-in for the home network of `novira-server`, so the QR item can be tried (and tested) in
// a plain browser: open the page with `?lan` (a closed home network on a network not trusted yet), `?lan=open` (trusted
// and open) or `?lan=public` (as the first, with Windows calling the network public). A phone "asks to pair" two seconds
// after a pairing code is made. Nothing leaves the page; the code is a pattern, not a real QR code.
// With `&remote` it also has a pretend remote listener (off, with Tailscale running), `&remote=on` (on, one passkey) or
// `&remote=missing` (Tailscale not installed): a phone asks to enrol two seconds after an enrolment code, and once
// allowed it "makes" its passkey.
import type { LanApi, LanDevice, LanPending, LanResult, LanState, PairingCode, RemoteLogLine, RemotePasskey, RemoteState } from '../http/lan';

const GATEWAY = '02:11:22:33:44:55';
const ADDRESS = '192.168.1.5';
const PORT = 51423;
const ASKS_AFTER_MS = 2000;
const CODE_SECS = 120;
const IDLE_LIMIT_SECS = 1800;

/** A 21-module square with the three finder squares of a QR code and a fill that depends on `seed`. */
export function patternModules(seed: string): { size: number; modules: string } {
  const size = 21;
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let out = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const corner = (cx: number, cy: number) => {
        const dx = x - cx;
        const dy = y - cy;
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        return ring !== 2;
      };
      const finder = corner(0, 0) ?? corner(14, 0) ?? corner(0, 14);
      if (finder !== null) {
        out += finder ? '1' : '0';
        continue;
      }
      h = Math.imul(h ^ (x * 31 + y), 16777619) >>> 0;
      out += (h >>> 7) & 1 ? '1' : '0';
    }
  }
  return { size, modules: out };
}

export interface MockLan extends LanApi {
  /** A phone that asks to pair right now (the mock does it by itself after a pairing code). */
  askToPair(label: string, peer: string): void;
}

const REMOTE_NAME = 'pc.tail1234.ts.net';
const REMOTE_PORT = 51500;
const UNUSED_DAYS = 14;

export function createMockLan(
  start: 'closed' | 'open' | 'public' = 'closed',
  now: () => number = Date.now,
  remote: 'none' | 'off' | 'on' | 'missing' = 'none',
): MockLan {
  let remoteOn = remote === 'on';
  let remotePending: LanPending[] = [];
  let remoteDevices: LanDevice[] = [];
  let passkeys: RemotePasskey[] = remote === 'on' ? [{ id: 'k0', label: 'iPhone', addedAt: '2026-11-01T09:00:00+00:00', lastUsedAt: '2026-11-03T18:20:00+00:00' }] : [];
  let log: RemoteLogLine[] = remote === 'on' ? [{ at: '2026-11-03T18:20:00+00:00', what: 'signedIn', label: 'iPhone', peer: '100.88.1.2' }] : [];
  const remoteOpen = () => remoteOn && remote !== 'missing';
  const remoteView = (): RemoteState => ({
    enabled: remoteOn,
    open: remoteOpen(),
    problem: remoteOn && remote === 'missing' ? 'tailscale_missing' : null,
    detail: null,
    name: remoteOpen() ? REMOTE_NAME : null,
    address: remoteOpen() ? '100.101.102.103' : null,
    port: remoteOpen() ? REMOTE_PORT : null,
    url: remoteOpen() ? `https://${REMOTE_NAME}:${REMOTE_PORT}/` : null,
    codes: 0,
    pending: remotePending.map((p) => ({ ...p })),
    devices: remoteDevices.map((d) => ({ ...d })),
    passkeys: passkeys.map((p) => ({ ...p })),
    log: log.map((l) => ({ ...l })),
    unusedDays: UNUSED_DAYS,
  });
  let open = start === 'open';
  let trusted = start === 'open';
  let trustedLabel: string | null = start === 'open' ? 'Home' : null;
  const windowsPublic = start === 'public';
  let pending: LanPending[] = [];
  let devices: (LanDevice & { since: number })[] = [];
  let nextId = 1;
  let codes = 0;
  let counter = 0;
  const asked = new Set<ReturnType<typeof setTimeout>>();

  const ok: LanResult = { ok: true };
  const view = (): LanState => ({
    open,
    address: ADDRESS,
    port: open ? PORT : null,
    network: { gatewayMac: GATEWAY, trusted, label: trusted ? trustedLabel : null },
    windowsPublic,
    idleSecs: open ? 0 : null,
    idleLimitSecs: IDLE_LIMIT_SECS,
    codes,
    devices: devices.map(({ since, ...d }) => ({ ...d, pairedSecs: Math.floor((now() - since) / 1000) })),
    pending: pending.map((p) => ({ ...p })),
    trustedNetworks: trusted ? [{ gatewayMac: GATEWAY, label: trustedLabel ?? '', addedAt: '2026-10-24T00:00:00+00:00' }] : [],
  });
  const askToPair = (label: string, peer: string) => {
    pending = [...pending, { id: `mock-${nextId++}`, label, peer, confirm: String(100000 + ((counter++ * 7919 + 482913) % 900000)), waitingSecs: 0 }];
  };

  return {
    state: async () => view(),
    open: async () =>
      trusted
        ? ((open = true), ok)
        : { ok: false, code: 'untrusted_network', message: 'this network is not trusted yet', gatewayMac: GATEWAY },
    close: async () => {
      open = false;
      pending = [];
      devices = [];
      codes = 0;
      return ok;
    },
    trust: async (gatewayMac, label) => {
      if (gatewayMac !== GATEWAY) return { ok: false, code: 'network_changed', message: 'the network is not the one that was shown', gatewayMac: GATEWAY };
      trusted = true;
      trustedLabel = label;
      return ok;
    },
    untrust: async (gatewayMac) => {
      if (!trusted || gatewayMac !== GATEWAY) return { ok: false, code: 'unknown', message: 'that network is not trusted' };
      trusted = false;
      trustedLabel = null;
      open = false;
      pending = [];
      devices = [];
      return ok;
    },
    pairingCode: async () => {
      if (!open) return null;
      codes += 1;
      const seed = `code-${nextId++}`;
      const timer = setTimeout(() => {
        asked.delete(timer);
        if (open && pending.length === 0 && devices.length < 3) askToPair(devices.length === 0 ? 'iPhone' : 'Android', `192.168.1.${20 + devices.length}`);
      }, ASKS_AFTER_MS);
      asked.add(timer);
      const { size, modules } = patternModules(seed);
      return { url: `https://${ADDRESS}:${PORT}/pair#${seed}`, size, modules, expiresIn: CODE_SECS } satisfies PairingCode;
    },
    approve: async (id) => {
      const request = pending.find((p) => p.id === id);
      if (!request) return { ok: false, code: 'unknown', message: 'no such request or device' };
      pending = pending.filter((p) => p.id !== id);
      devices = [...devices, { id: request.id, label: request.label, peer: request.peer, pairedSecs: 0, idleSecs: 0, since: now() }];
      return ok;
    },
    deny: async (id) => {
      if (!pending.some((p) => p.id === id)) return { ok: false, code: 'unknown', message: 'no such request or device' };
      pending = pending.filter((p) => p.id !== id);
      return ok;
    },
    revoke: async (id) => {
      if (!devices.some((d) => d.id === id)) return { ok: false, code: 'unknown', message: 'no such request or device' };
      devices = devices.filter((d) => d.id !== id);
      return ok;
    },
    askToPair,
    remoteState: async () => (remote === 'none' ? null : remoteView()),
    remoteEnable: async () => {
      if (remote === 'none') return { ok: false, code: 'no_remote_control', message: 'not available' };
      remoteOn = true;
      return ok;
    },
    remoteDisable: async () => {
      remoteOn = false;
      remotePending = [];
      remoteDevices = [];
      return ok;
    },
    remoteCode: async () => {
      if (!remoteOpen()) return null;
      const seed = `enrol-${nextId++}`;
      const timer = setTimeout(() => {
        asked.delete(timer);
        if (remoteOpen() && remotePending.length === 0) {
          remotePending = [{ id: `mock-${nextId++}`, label: 'iPhone', peer: '100.88.1.2', confirm: String(100000 + ((counter++ * 7919 + 482913) % 900000)), waitingSecs: 0 }];
        }
      }, ASKS_AFTER_MS);
      asked.add(timer);
      const { size, modules } = patternModules(seed);
      return { url: `https://${REMOTE_NAME}:${REMOTE_PORT}/remote#${seed}`, size, modules, expiresIn: CODE_SECS } satisfies PairingCode;
    },
    remoteApprove: async (id) => {
      const request = remotePending.find((p) => p.id === id);
      if (!request) return { ok: false, code: 'unknown', message: 'no such request, device or passkey' };
      remotePending = remotePending.filter((p) => p.id !== id);
      // The phone makes its passkey at once.
      const at = new Date(now()).toISOString();
      passkeys = [...passkeys, { id: `k${nextId++}`, label: request.label, addedAt: at, lastUsedAt: null }];
      remoteDevices = [...remoteDevices, { id: request.id, label: request.label, peer: request.peer, pairedSecs: 0, idleSecs: 0 }];
      log = [{ at, what: 'enrolled', label: request.label, peer: request.peer }, ...log];
      return ok;
    },
    remoteDeny: async (id) => {
      if (!remotePending.some((p) => p.id === id)) return { ok: false, code: 'unknown', message: 'no such request, device or passkey' };
      remotePending = remotePending.filter((p) => p.id !== id);
      return ok;
    },
    remoteRevoke: async (id) => {
      if (!remoteDevices.some((d) => d.id === id)) return { ok: false, code: 'unknown', message: 'no such request, device or passkey' };
      remoteDevices = remoteDevices.filter((d) => d.id !== id);
      return ok;
    },
    remoteForget: async (id) => {
      const gone = passkeys.find((p) => p.id === id);
      if (!gone) return { ok: false, code: 'unknown', message: 'no such request, device or passkey' };
      passkeys = passkeys.filter((p) => p.id !== id);
      remoteDevices = remoteDevices.filter((d) => d.label !== gone.label);
      return ok;
    },
  };
}

let shared: MockLan | undefined;

/** The mock's home network, made on first use from the page's `?lan` value (and its remote listener from `&remote`). */
export function mockLan(flag: string, remote: string | null = null): MockLan {
  const away = remote === null ? 'none' : remote === 'on' ? 'on' : remote === 'missing' ? 'missing' : 'off';
  shared ??= createMockLan(flag === 'open' ? 'open' : flag === 'public' ? 'public' : 'closed', Date.now, away);
  return shared;
}
