// @vitest-environment jsdom
// Less used paths of the mock backend: the pretend engine install, cancelling downloads, the assistant and login, models.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendEvent, UnfinishedDownload } from '../types';
import { MockBackend } from './MockBackend';

vi.mock('./imageSynth', async (original) => ({
  ...(await original<typeof import('./imageSynth')>()),
  synthesize: vi.fn(async () => ({ canvas: document.createElement('canvas'), url: 'synth:x' })),
  progressPreview: vi.fn(() => 'preview'),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function start(engineInstall = false) {
  const backend = new MockBackend('empty', engineInstall);
  backend.setStepDelay(0);
  const events: BackendEvent[] = [];
  backend.subscribe((e) => events.push(e));
  const pending = backend.bootstrap();
  await vi.advanceTimersByTimeAsync(1000);
  const boot = await pending;
  return { backend, events, boot };
}

describe('the pretend engine install (?engine=install)', () => {
  it('starts as downloading and walks through the steps to ready', async () => {
    const { events, boot } = await start(true);
    expect(boot.engine).toMatchObject({ state: 'downloading', bytes: 0 });
    await vi.advanceTimersByTimeAsync(350 * 60);
    const states = events.flatMap((e) => (e.type === 'engine_status' ? [e.status.state] : []));
    expect(states[0]).toBe('downloading');
    expect(states).toContain('extracting');
    expect(states).toContain('starting');
    expect(states.at(-1)).toBe('ready');
    const downloads = events.flatMap((e) => (e.type === 'engine_status' && e.status.state === 'downloading' ? [e.status.bytes] : []));
    expect(downloads.at(-1)).toBe(2_400_000_000);
  });

  it('is ready at once without the option', async () => {
    const { boot } = await start(false);
    expect(boot.engine).toEqual({ state: 'ready' });
  });
});

describe('model installs', () => {
  it('cancels a download in progress and ignores an unknown one', async () => {
    const { backend, events } = await start();
    const pending = backend.installModel('https://example.com/model.safetensors');
    await vi.advanceTimersByTimeAsync(1000);
    const job = await pending;
    await vi.advanceTimersByTimeAsync(300);
    await backend.cancelInstall(job.id);
    await backend.cancelInstall('missing');
    await vi.advanceTimersByTimeAsync(500);
    const statuses = events.flatMap((e) => (e.type === 'model_install' && e.job.id === job.id ? [e.job.status] : []));
    expect(statuses.at(-1)).toBe('cancelled');
  });

  it('refuses to update a model that does not exist, and scans a folder', async () => {
    const { backend } = await start();
    const pending = backend.updateModel('nope', { name: 'x' });
    const failed = expect(pending).rejects.toThrow('model not found: nope');
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
    const scan = backend.scanFolder();
    await vi.advanceTimersByTimeAsync(1000);
    const found = await scan;
    expect(found).toHaveLength(4);
    expect(found![0]!.path.startsWith('D:\\models\\')).toBe(true);
  });
});

describe('packs and node packs', () => {
  it('cancels a pack download and a node pack install without error when nothing runs', async () => {
    const { backend } = await start();
    await backend.cancelPack('video');
    await backend.cancelNodePack('https://github.com/a/b');
  });

  it('stops a pack download part way and goes back to missing', async () => {
    const { backend, events } = await start();
    void backend.installPack('voice');
    await vi.advanceTimersByTimeAsync(300);
    await backend.cancelPack('voice');
    await vi.advanceTimersByTimeAsync(2000);
    const states = events.flatMap((e) => (e.type === 'pack' && e.kind === 'voice' ? [e.status.state] : []));
    expect(states).toContain('installing');
    expect(states.at(-1)).toBe('missing');
  });
});

describe('the assistant and the restore state', () => {
  it('signs in after a pause, answers a chat message, and has nothing to restore', async () => {
    const { backend } = await start();
    const login = backend.agentLogin('codex');
    await vi.advanceTimersByTimeAsync(1300);
    expect(await login).toMatchObject({ provider: 'codex', installed: true, loggedIn: true });
    expect((await backend.agentStatus()).models.map((m) => m.id)).toEqual(['gpt-mock-pro', 'gpt-mock-mini']);
    // The window's side: every tool call of the request is answered, as the dispatcher would.
    const tools: string[] = [];
    backend.subscribe((e) => {
      if (e.type !== 'agent_tool_call') return;
      tools.push(e.call.tool);
      void backend.agentToolResult({ callId: e.call.callId, ok: true, content: e.call.tool === 'list_models' ? { models: [] } : {} });
    });
    const chat = backend.agentChat({ message: 'hello', locale: 'en', screen: 'generate', history: [] });
    await vi.advanceTimersByTimeAsync(1500);
    expect((await chat).text.length).toBeGreaterThan(0);
    expect(tools).toContain('set_generation_settings');
    // An answer to no waiting call is refused.
    await expect(backend.agentToolResult({ callId: 'c-nope', ok: true, content: 1 })).rejects.toThrow('no tool call');
    expect(await backend.takeRestoredUiState()).toEqual({ state: 'none' });
    await backend.discardRestore();
  });
});

describe('the assistant fact look-up', () => {
  it('gives the same canned article for the same words, nothing for [none], and refuses empty words', async () => {
    const { backend } = await start();
    const ask = async (language: 'ja' | 'en', query: string) => {
      const p = backend.lookupReference(language, query);
      await vi.advanceTimersByTimeAsync(100);
      return p;
    };
    const a = await ask('en', 'Edo period');
    expect(a).toEqual(await ask('en', 'Edo period'));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ title: 'Edo period', url: 'https://en.wikipedia.org/wiki/Edo_period' });
    expect((await ask('ja', '鎧'))[0]!.url.startsWith('https://ja.wikipedia.org/wiki/')).toBe(true);
    expect(await ask('en', 'zzz [none]')).toEqual([]);
    const empty = backend.lookupReference('en', '  ');
    const failed = expect(empty).rejects.toThrow('empty');
    await vi.advanceTimersByTimeAsync(100);
    await failed;
  });
});

describe('engine settings', () => {
  /** Resolves a call that waits for the mock's latency. */
  async function settle<T>(call: Promise<T>): Promise<T> {
    await vi.advanceTimersByTimeAsync(100);
    return call;
  }

  /** Expects a call to be refused with `message`. */
  async function refused(call: Promise<unknown>, message: RegExp) {
    const check = expect(call).rejects.toThrow(message);
    await vi.advanceTimersByTimeAsync(100);
    await check;
  }

  it('starts with the defaults and needs no restart', async () => {
    const { backend } = await start();
    expect(await settle(backend.engineSettings())).toEqual({
      dataDir: 'C:\\Users\\you\\novira-data',
      dataDirChangeable: true,
      dataDirNext: null,
      dataDirMoves: false,
      dataDirNote: null,
      comfyuiRoot: 'C:\\Users\\you\\novira-data\\comfyui',
      comfyuiMode: 'owned',
      comfyuiUrl: null,
      comfyuiDir: null,
      comfyuiInstallDir: null,
      comfyuiPackage: 'nvidia',
      comfyuiInstalled: true,
      installedComfyuiPackage: 'nvidia',
      comfyuiStartTimeoutSecs: 180,
      civitaiLookup: false,
      modelRoots: [],
      restartNeeded: false,
    });
  });

  it('keeps a data folder change and a ComfyUI folder until cancelled or reset, each needing a restart', async () => {
    const { backend } = await start();
    const moved = await settle(backend.chooseDataDir(true));
    expect(moved).toMatchObject({ dataDirNext: 'D:\\novira-data', dataDirMoves: true, restartNeeded: true });
    expect(await settle(backend.chooseDataDir(false))).toMatchObject({ dataDirMoves: false });
    expect(await settle(backend.cancelDataDirChange())).toMatchObject({ dataDirNext: null, restartNeeded: false });
    expect(await settle(backend.chooseComfyuiInstallDir())).toMatchObject({ comfyuiInstallDir: 'D:\\ComfyUI-novira', restartNeeded: true });
    expect(await settle(backend.resetComfyuiInstallDir())).toMatchObject({ comfyuiInstallDir: null, restartNeeded: false });
  });

  it('saves a valid patch and then needs a restart; back at the start values it does not', async () => {
    const { backend } = await start();
    const changed = await settle(backend.setEngineSettings({ comfyuiPackage: 'amd', comfyuiStartTimeoutSecs: 1800 }));
    expect(changed).toMatchObject({ comfyuiPackage: 'amd', comfyuiStartTimeoutSecs: 1800, restartNeeded: true });
    // The mock does not reinstall: the install keeps the package it came from until the next start.
    expect(changed).toMatchObject({ comfyuiInstalled: true, installedComfyuiPackage: 'nvidia' });
    expect(await settle(backend.setEngineSettings({ comfyuiStartTimeoutSecs: 30 }))).toMatchObject({
      comfyuiPackage: 'amd',
      comfyuiStartTimeoutSecs: 30,
    });
    const back = await settle(backend.setEngineSettings({ comfyuiPackage: 'nvidia', comfyuiStartTimeoutSecs: 180 }));
    expect(back.restartNeeded).toBe(false);
  });

  it('refuses the values the backend refuses, and saves nothing of that patch', async () => {
    const { backend } = await start();
    for (const secs of [29, 1801, 30.5, -60, Number.NaN]) {
      await refused(backend.setEngineSettings({ comfyuiPackage: 'amd', comfyuiStartTimeoutSecs: secs }), /30 to 1800/);
    }
    for (const pkg of ['cpu', 'NVIDIA', '', '../amd']) {
      await refused(backend.setEngineSettings({ comfyuiPackage: pkg as 'amd' }), /"nvidia" or "amd"/);
    }
    await refused(backend.setEngineSettings({ comfyuiUrl: 'http://evil.example' } as never), /unknown field/);
    expect(await settle(backend.engineSettings())).toMatchObject({
      comfyuiPackage: 'nvidia',
      comfyuiStartTimeoutSecs: 180,
      restartNeeded: false,
    });
  });

  it('adds D:\\Models, E:\\Models and so on up to 16, and removes by index', async () => {
    const { backend } = await start();
    expect((await settle(backend.addModelRoot()))?.modelRoots).toEqual(['D:\\Models']);
    expect(await settle(backend.addModelRoot())).toMatchObject({ modelRoots: ['D:\\Models', 'E:\\Models'], restartNeeded: true });
    expect((await settle(backend.removeModelRoot(0))).modelRoots).toEqual(['E:\\Models']);
    expect((await settle(backend.addModelRoot()))?.modelRoots).toEqual(['E:\\Models', 'D:\\Models']);
    for (const index of [2, -1, 0.5]) await refused(backend.removeModelRoot(index), /no model folder/);
    for (let i = 2; i < 16; i++) await settle(backend.addModelRoot());
    expect((await settle(backend.engineSettings())).modelRoots).toHaveLength(16);
    await refused(backend.addModelRoot(), /At most 16/);
    for (let i = 16; i > 0; i--) await settle(backend.removeModelRoot(0));
    expect(await settle(backend.engineSettings())).toMatchObject({ modelRoots: [], restartNeeded: false });
  });
});

describe('unfinished downloads', () => {
  it('starts with none, and deleting paths that are not there changes nothing', async () => {
    const backend = new MockBackend('empty', false);
    expect(await backend.listUnfinishedDownloads()).toEqual([]);
    expect(await backend.deleteUnfinishedDownloads(['comfyui/.downloads/comfyui.part'])).toEqual([]);
  });

  it('deletes the listed paths, returns what remains, and lists copies', async () => {
    const backend = new MockBackend('empty', false);
    const part: UnfinishedDownload = { path: 'comfyui/.downloads/comfyui.part', name: 'comfyui.part', bytes: 1_048_576 };
    const other: UnfinishedDownload = { path: 'models/.downloads/a.safetensors.part', name: 'a.safetensors.part', bytes: 2_000 };
    (backend as unknown as { unfinishedDownloads: UnfinishedDownload[] }).unfinishedDownloads = [part, other];
    (await backend.listUnfinishedDownloads())[0]!.bytes = 0;
    expect(await backend.listUnfinishedDownloads()).toEqual([part, other]);
    expect(await backend.deleteUnfinishedDownloads([part.path])).toEqual([other]);
    expect(await backend.listUnfinishedDownloads()).toEqual([other]);
  });
});
