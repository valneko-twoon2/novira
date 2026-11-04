// The home network of the desktop app: the server of `novira-server` runs inside the app, and its management routes are
// the commands of `backend/src-tauri/src/home_network.rs`, one each, answering `{status, body}` as the route would. The
// same `LanApi` as the browser page's then reads them (`../http/lan.ts`).
import { invoke } from '@tauri-apps/api/core';
import { lanApiOver, type LanAnswer, type LanApi } from '../http/lan';

/** The command that runs each route. */
export const LAN_COMMANDS: Record<string, string> = {
  '/lan/state': 'lan_state',
  '/lan/open': 'lan_open',
  '/lan/close': 'lan_close',
  '/lan/trust': 'lan_trust',
  '/lan/untrust': 'lan_untrust',
  '/pair/code': 'lan_pair_code',
  '/pair/approve': 'lan_approve',
  '/pair/deny': 'lan_deny',
  '/pair/revoke': 'lan_revoke',
  '/remote/state': 'remote_state',
  '/remote/enable': 'remote_enable',
  '/remote/disable': 'remote_disable',
  '/remote/code': 'remote_code',
  '/remote/approve': 'remote_approve',
  '/remote/deny': 'remote_deny',
  '/remote/revoke': 'remote_revoke',
  '/remote/forget': 'remote_forget',
};

export const tauriLanApi: LanApi = lanApiOver(async (_method, path, body): Promise<LanAnswer> => {
  const command = LAN_COMMANDS[path];
  if (!command) return null;
  try {
    // The body's fields are the command's arguments (Tauri reads `gatewayMac` as `gateway_mac`).
    return await invoke<LanAnswer>(command, body ?? {});
  } catch {
    return null;
  }
});
