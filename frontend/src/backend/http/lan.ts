// The home network of `novira-server`, as the page on the server's own computer drives it: whether it is open,
// trusting a network, pairing codes, approving or refusing the phones that ask, and ending a phone's session. Only that
// page may (the routes answer a loopback peer with the token and 403 any device); anywhere else (the desktop app, a phone,
// the browser mock) there is no state and no item. `getLanApi` in `../index.ts` picks this or the mock's.
import { isServedByServer } from './HttpBackend';

/** A phone that asked to pair and waits for this computer. */
export type LanPending = { id: string; label: string; peer: string; confirm: string; waitingSecs: number };

/** A paired phone. */
export type LanDevice = { id: string; label: string; peer: string; pairedSecs: number; idleSecs: number };

/** What `GET /lan/state` answers. */
export type LanState = {
  open: boolean;
  /** The open listener's address, else the one it would open on; null when this computer has no home address. */
  address: string | null;
  port: number | null;
  network: { gatewayMac: string | null; trusted: boolean; label: string | null };
  /** Windows calls the network public: a warning, not a gate. */
  windowsPublic: boolean | null;
  idleSecs: number | null;
  idleLimitSecs: number;
  codes: number;
  devices: LanDevice[];
  pending: LanPending[];
  trustedNetworks: { gatewayMac: string; label: string; addedAt: string }[];
};

/** A pairing code as an address and its QR code. */
export type PairingCode = {
  /** The address a phone opens, `https://<home address>:<port>/pair#<code>`. */
  url: string;
  /** Modules on a side. */
  size: number;
  /** `size * size` modules row by row, `1` dark and `0` light, without the quiet zone. */
  modules: string;
  /** Seconds the code is good for. */
  expiresIn: number;
};

/** Why a call did not do what it was asked: the server's `code` (`untrusted_network`, `unknown_network`, ...). */
export type LanFailure = { ok: false; code: string; message: string; gatewayMac?: string };
export type LanResult = { ok: true } | LanFailure;

export interface LanApi {
  /** The state, or null when this page has no home network to drive. */
  state(): Promise<LanState | null>;
  /** Opens the listener; fails with `untrusted_network` (and the gateway to confirm) on a network not trusted yet. */
  open(): Promise<LanResult>;
  close(): Promise<LanResult>;
  /** Trusts the network this computer is on, which the owner saw as `gatewayMac`. */
  trust(gatewayMac: string, label: string): Promise<LanResult>;
  untrust(gatewayMac: string): Promise<LanResult>;
  /** A new pairing code, while the listener is open. */
  pairingCode(): Promise<PairingCode | null>;
  approve(id: string): Promise<LanResult>;
  deny(id: string): Promise<LanResult>;
  /** Ends a paired phone's session. */
  revoke(id: string): Promise<LanResult>;
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    return null;
  }
}

async function result(response: Response | null): Promise<LanResult> {
  if (!response) return { ok: false, code: 'offline', message: 'the server did not answer' };
  if (response.ok) return { ok: true };
  try {
    const body = (await response.json()) as { code?: string; error?: string; gatewayMac?: string };
    return { ok: false, code: body.code ?? 'failed', message: body.error ?? response.statusText, ...(body.gatewayMac ? { gatewayMac: body.gatewayMac } : {}) };
  } catch {
    return { ok: false, code: 'failed', message: response.statusText };
  }
}

export const httpLanApi: LanApi = {
  async state() {
    const response = await call('GET', '/lan/state');
    if (!response?.ok) return null;
    try {
      return (await response.json()) as LanState;
    } catch {
      return null;
    }
  },
  open: async () => result(await call('POST', '/lan/open')),
  close: async () => result(await call('POST', '/lan/close')),
  trust: async (gatewayMac, label) => result(await call('POST', '/lan/trust', { gatewayMac, label })),
  untrust: async (gatewayMac) => result(await call('POST', '/lan/untrust', { gatewayMac })),
  async pairingCode() {
    const response = await call('POST', '/pair/code');
    if (!response?.ok) return null;
    try {
      const code = (await response.json()) as PairingCode;
      return code.modules.length === code.size * code.size ? code : null;
    } catch {
      return null;
    }
  },
  approve: async (id) => result(await call('POST', '/pair/approve', { id })),
  deny: async (id) => result(await call('POST', '/pair/deny', { id })),
  revoke: async (id) => result(await call('POST', '/pair/revoke', { id })),
};

/** The API of a page that `novira-server` served, else none. */
export function serverLanApi(): LanApi | null {
  return isServedByServer() ? httpLanApi : null;
}
