// @vitest-environment jsdom
// Contract between the IPC calls `TauriBackend` makes and the commands the shell registers
// (`backend/src-tauri/src/command_list.rs` and the `#[tauri::command]` functions in `commands.rs`):
// every command name must exist, and the argument names must be the Rust parameters in camelCase
// (Tauri renames command arguments that way).
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CALLS, camel, fixture, read } from '../calls.testkit';
import { TauriBackend } from './TauriBackend';

/** Registered commands that the frontend does not call, and why. */
const NOT_CALLED: Record<string, string> = {
  pack_status: 'pack states arrive with bootstrap and as `pack` events',
};

/** Parameters that are not IPC arguments: injected state and the raw request (`upload_image` sends bytes). */
const INJECTED = /^(State<|tauri::ipc::Request<|tauri::Webview\b)/;

function registeredCommands(): string[] {
  const list = read('backend/src-tauri/src/command_list.rs');
  const body = list.slice(list.indexOf('COMMANDS'));
  return [...body.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!);
}

/** Each `#[tauri::command]` function with its IPC argument names (camelCase). */
function commandArguments(): Map<string, string[]> {
  const src = read('backend/src-tauri/src/commands.rs');
  const out = new Map<string, string[]>();
  for (const m of src.matchAll(/#\[tauri::command\]\s*pub (?:async )?fn (\w+)\(([^)]*)\)/g)) {
    const params = [...m[2]!.matchAll(/(?<![:\w])(\w+)\s*:(?!:)\s*/g)]
      .filter((p) => !INJECTED.test(m[2]!.slice(p.index! + p[0].length)))
      .map((p) => camel(p[1]!));
    out.set(m[1]!, params);
  }
  return out;
}

let calls: { cmd: string; payload: unknown }[] = [];

beforeEach(() => {
  calls = [];
  mockIPC(
    (cmd, payload) => {
      calls.push({ cmd, payload });
      switch (cmd) {
        case 'bootstrap':
          return fixture('bootstrap');
        case 'queue_snapshot':
          return fixture('queue-snapshot');
        case 'enqueue':
          return [fixture('queue-item')];
        case 'upload_image':
          return fixture('image-dto');
        case 'delete_board':
          return [];
        default:
          return null;
      }
    },
    { shouldMockEvents: true },
  );
});

afterEach(() => clearMocks());

describe('IPC command contract', () => {
  it('registers a #[tauri::command] function for every listed command and nothing else', () => {
    expect([...commandArguments().keys()].sort()).toEqual(registeredCommands().sort());
  });

  it('calls every registered command (except the listed ones) and nothing unregistered', async () => {
    const b = new TauriBackend();
    for (const call of Object.values(CALLS)) await call(b);
    const called = new Set(calls.map((c) => c.cmd));
    const expected = registeredCommands().filter((c) => !(c in NOT_CALLED));
    expect([...called].sort()).toEqual(expected.sort());
    expect(Object.keys(NOT_CALLED).every((c) => registeredCommands().includes(c))).toBe(true);
  });

  it('passes exactly the Rust parameters as camelCase arguments', async () => {
    const b = new TauriBackend();
    for (const call of Object.values(CALLS)) await call(b);
    const args = commandArguments();
    const mismatched = calls
      .filter((c) => !(c.payload instanceof Uint8Array))
      .map((c) => ({
        cmd: c.cmd,
        sent: Object.keys((c.payload ?? {}) as object).sort(),
        expected: [...(args.get(c.cmd) ?? [])].sort(),
      }))
      .filter((c) => c.sent.join() !== c.expected.join());
    expect(mismatched).toEqual([]);
  });
});
