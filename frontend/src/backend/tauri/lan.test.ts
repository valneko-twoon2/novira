// @vitest-environment jsdom
// The desktop app's home network calls: each route goes to its own command of `backend/src-tauri/src/home_network.rs`
// with the Rust parameters in camelCase, and the `{status, body}` that comes back reads as the browser page's answer.
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import { camel, read } from '../calls.testkit';
import { LAN_COMMANDS, tauriLanApi } from './lan';

/** Each `#[tauri::command]` of `home_network.rs` with its IPC argument names. */
function shellCommands(): Map<string, string[]> {
  const src = read('backend/src-tauri/src/home_network.rs');
  const out = new Map<string, string[]>();
  for (const m of src.matchAll(/#\[tauri::command\]\s*pub async fn (\w+)\(([^)]*)\)/g)) {
    const params = [...m[2]!.matchAll(/(\w+)\s*:\s*([\w:]+)/g)].filter((p) => p[2] !== 'tauri::AppHandle').map((p) => camel(p[1]!));
    out.set(m[1]!, params);
  }
  return out;
}

let calls: { cmd: string; payload: unknown }[] = [];

function answer(status: number, body: unknown) {
  calls = [];
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    return { status, body };
  });
}

describe('the desktop app home network calls', () => {
  afterEach(() => clearMocks());

  it('name commands the shell registers, with its argument names', async () => {
    const shell = shellCommands();
    const registered = read('backend/src-tauri/src/command_list.rs');
    expect([...shell.keys()].sort()).toEqual(Object.values(LAN_COMMANDS).sort());
    for (const command of shell.keys()) expect(registered).toContain(`"${command}"`);
    answer(200, { ok: true });
    await tauriLanApi.trust('02:11:22:33:44:55', 'home');
    await tauriLanApi.untrust('02:11:22:33:44:55');
    await tauriLanApi.approve('a1');
    await tauriLanApi.deny('a2');
    await tauriLanApi.revoke('a3');
    await tauriLanApi.open();
    await tauriLanApi.close();
    await tauriLanApi.state();
    await tauriLanApi.pairingCode();
    for (const { cmd, payload } of calls) {
      const sent = Object.keys((payload ?? {}) as object).sort();
      expect(sent, cmd).toEqual([...(shell.get(cmd) ?? ['missing'])].sort());
    }
    expect(calls.map((c) => c.cmd)).toEqual(['lan_trust', 'lan_untrust', 'lan_approve', 'lan_deny', 'lan_revoke', 'lan_open', 'lan_close', 'lan_state', 'lan_pair_code']);
    expect(calls[0]!.payload).toEqual({ gatewayMac: '02:11:22:33:44:55', label: 'home' });
  });

  it('read the state and a pairing code from the answer, and nothing from a refusal', async () => {
    const state = { open: true, address: '192.168.1.5', port: 8124, devices: [], pending: [] };
    answer(200, state);
    expect(await tauriLanApi.state()).toEqual(state);
    const code = { url: 'https://192.168.1.5:8124/pair#c0de', size: 2, modules: '1001', expiresIn: 120 };
    answer(200, code);
    expect(await tauriLanApi.pairingCode()).toEqual(code);
    answer(200, { ...code, modules: '100' });
    expect(await tauriLanApi.pairingCode()).toBeNull();
    // Before the backend is open the shell answers 404, so the item stays hidden.
    answer(404, { code: 'no_lan_control', error: 'not started' });
    expect(await tauriLanApi.state()).toBeNull();
    expect(await tauriLanApi.pairingCode()).toBeNull();
  });

  it('bring a refusal back with its reason, and a failed call as offline', async () => {
    answer(409, { code: 'untrusted_network', error: 'not trusted yet', gatewayMac: '02:11:22:33:44:55' });
    expect(await tauriLanApi.open()).toEqual({ ok: false, code: 'untrusted_network', message: 'not trusted yet', gatewayMac: '02:11:22:33:44:55' });
    answer(500, null);
    expect(await tauriLanApi.close()).toEqual({ ok: false, code: 'failed', message: 'status 500' });
    mockIPC(() => {
      throw new Error('gatewayMac is too long');
    });
    expect(await tauriLanApi.trust('x'.repeat(200), 'home')).toMatchObject({ ok: false, code: 'offline' });
  });
});
