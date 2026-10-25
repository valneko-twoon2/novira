// What the harness knows about processes and its tools (tools/harness-process.mjs): the process list read from JSON,
// the verification ComfyUI found by its command line, cargo's place, and the path helpers the guards use.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cargoCommand,
  isInside,
  listProcesses,
  parseProcessJson,
  processAlive,
  pythonsWith,
  sameFile,
  verifyTarget,
  // @ts-expect-error -- plain ESM script without types
} from '../../tools/harness-process.mjs';

const json = (o: unknown) => JSON.stringify(o);

describe('the process list', () => {
  it('reads one object, a list, or nothing, and puts a command line on one line', () => {
    const one = { ProcessId: 5, ParentProcessId: 1, Name: 'novira.exe', ExecutablePath: 'C:\\a\\novira.exe', CommandLine: 'novira\r\n--x' };
    expect(parseProcessJson(json(one))).toEqual([{ pid: 5, ppid: 1, name: 'novira.exe', path: 'C:\\a\\novira.exe', cmd: 'novira --x' }]);
    expect(parseProcessJson(json([one, { ProcessId: 0, ParentProcessId: 0, Name: 'System Idle Process', ExecutablePath: null, CommandLine: null }]))[1]).toEqual({
      pid: 0,
      ppid: 0,
      name: 'System Idle Process',
      path: '',
      cmd: '',
    });
    expect(parseProcessJson('')).toEqual([]);
  });

  it('finds the pythons whose command line holds every needle, letter case ignored, and nothing else', () => {
    const list = [
      { pid: 1, name: 'python.exe', cmd: 'E:\\r\\novira-data\\work\\Comfy-Copy\\python.exe main.py --port 8190' },
      { pid: 2, name: 'pythonw.exe', cmd: 'x\\comfy-copy\\pythonw.exe main.py' },
      { pid: 3, name: 'python.exe', cmd: 'E:\\r\\novira-data\\comfyui\\python.exe main.py' },
      { pid: 4, name: 'node.exe', cmd: 'node comfy-copy main.py' },
    ];
    expect(pythonsWith(list, 'comfy-copy', 'main.py').map((p: { pid: number }) => p.pid)).toEqual([1, 2]);
    expect(pythonsWith(list, 'comfy-copy', '--port').map((p: { pid: number }) => p.pid)).toEqual([1]);
    // A list that could not be read finds nothing (so nothing is stopped).
    expect(pythonsWith(null, 'comfy-copy')).toEqual([]);
  });

  it.runIf(process.platform === 'win32')('lists this machine, this process included', () => {
    const list = listProcesses();
    expect(list?.some((p: { pid: number }) => p.pid === process.pid)).toBe(true);
    expect(processAlive(process.pid)).toBe(true);
    expect(processAlive(2 ** 31 - 2)).toBe(false);
  });
});

describe('paths and tools', () => {
  it('takes cargo from the rustup install of the profile, else from PATH', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'cargo-home-'));
    try {
      expect(cargoCommand(home)).toBe('cargo');
      mkdirSync(path.join(home, '.cargo', 'bin'), { recursive: true });
      writeFileSync(path.join(home, '.cargo', 'bin', 'cargo.exe'), '');
      expect(cargoCommand(home)).toBe(path.join(home, '.cargo', 'bin', 'cargo.exe'));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('says what is inside a folder (not the folder itself, not a neighbour of the same start) and compares paths without case', () => {
    expect(isInside('E:/r/novira-data/work/x', 'E:/r/novira-data/work')).toBe(true);
    expect(isInside('E:/r/novira-data/work', 'E:/r/novira-data/work')).toBe(false);
    expect(isInside('E:/r/novira-data/workshop', 'E:/r/novira-data/work')).toBe(false);
    expect(isInside('E:/r/novira-data/models', 'E:/r/novira-data/work')).toBe(false);
    expect(sameFile('E:/R/novira.exe', 'e:\\r\\novira.exe')).toBe(true);
  });

  it('builds the verification exe outside the repository unless NOVIRA_VERIFY_TARGET says where', () => {
    expect(verifyTarget({})).toBe(path.resolve(tmpdir(), 'novira-verify'));
    expect(verifyTarget({ NOVIRA_VERIFY_TARGET: 'E:/t/v' })).toBe(path.resolve('E:/t/v'));
  });
});
