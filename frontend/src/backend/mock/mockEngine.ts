// The pretend ComfyUI engine of the browser mock: extension packs, the ComfyUI version, low-memory mode and the engine
// settings. It holds its own state; MockBackend forwards the matching client calls here.
import { MOCK_REGISTRY } from './registryData';
import type {
  BackendEvent,
  EngineSettings,
  EngineSettingsPatch,
  LowMemoryMode,
  NodePackInfo,
  NodePacks,
  PackStatus,
  RegistryNode,
} from '../types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const LATENCY = 60;

/** The engine settings the mock can change, and what it "started" with (the backend's defaults). */
type EngineSettingsValues = Pick<EngineSettings, 'comfyuiPackage' | 'comfyuiStartTimeoutSecs' | 'modelRoots' | 'civitaiLookup' | 'comfyuiInstallDir'>;
const MOCK_ENGINE_START = { comfyuiPackage: 'nvidia', comfyuiStartTimeoutSecs: 180, civitaiLookup: false } as const;
const MOCK_MAX_MODEL_ROOTS = 16;

/** What the engine needs from the mock around it. */
export interface MockEngineHost {
  emit(event: BackendEvent): void;
  /** The pace of the pretend work (`setStepDelay`). */
  stepDelay(): number;
  /** Whether a generation is running now (the engine cannot restart then). */
  jobRunning(): boolean;
}

export class MockEngine {
  constructor(private readonly host: MockEngineHost) {}

  /** Low-memory mode as saved, and what the pretend ComfyUI was last started with. */
  private lowMemory = false;
  private runningLowMemory = false;

  private nodePackList: NodePacks = {
    available: true,
    installed: [
      { folder: 'ComfyUI-Mock-Tools', url: 'https://github.com/novira-mock/ComfyUI-Mock-Tools', version: 'v1.0.0' },
      { folder: 'comfyui-mock-preview', url: null, version: null },
      { folder: 'ComfyUI-NKD-Basic-Tools', url: 'https://github.com/Nekodificador/ComfyUI-NKD-Basic-Tools', version: null },
      { folder: 'ComfyUI_IPAdapter_plus', url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus', version: 'v2.0.0' },
      { folder: 'ComfyUI_UltimateSDUpscale', url: 'https://github.com/ssitu/ComfyUI_UltimateSDUpscale', version: null },
    ],
    comfyVersion: '0.3.50',
    restartNeeded: false,
  };
  private nodePackRuns = new Map<string, { cancelled: boolean }>();

  async nodePacks(): Promise<NodePacks> {
    await wait(LATENCY);
    return structuredClone(this.nodePackList);
  }

  async nodePackInfo(url: string): Promise<NodePackInfo> {
    const m = /^https:\/\/github\.com\/([\w.-]+)\/[\w.-]+?(?:\.git)?\/?$/.exec(url.trim());
    if (!m) throw new Error(`Not a GitHub repository address: ${url}`);
    await wait(LATENCY);
    return { author: m[1] ?? '', license: /nolicense/.test(url) ? null : 'MIT', description: null, stars: 0 };
  }

  async registryNodes(_refresh: boolean): Promise<RegistryNode[]> {
    await wait(LATENCY);
    return structuredClone(MOCK_REGISTRY);
  }

  /** The same few tags for every repository, except one whose address says it has none. */
  async nodePackVersions(url: string): Promise<string[]> {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(?:\.git)?\/?$/.test(url.trim())) throw new Error(`Not a GitHub repository address: ${url}`);
    await wait(LATENCY);
    return /untagged/.test(url) ? [] : ['v2.1.0', 'v2.0.0', 'v1.9.0', 'v1.0.0'];
  }

  async comfyVersions(): Promise<string[]> {
    await wait(LATENCY);
    return ['v0.3.60', 'v0.3.50', 'v0.3.40', 'v0.3.30'];
  }

  async switchComfyVersion(version: string): Promise<string[]> {
    if (!/^[\w][\w.+-]{0,99}$/.test(version)) throw new Error(`Not a ComfyUI version: ${version}`);
    for (const status of [{ state: 'extracting' }, { state: 'starting' }] as const) {
      this.host.emit({ type: 'engine_status', status });
      await wait(Math.max(60, this.host.stepDelay()));
    }
    this.host.emit({ type: 'engine_status', status: { state: 'ready' } });
    this.nodePackList = { ...this.nodePackList, comfyVersion: version.replace(/^v/, ''), restartNeeded: false };
    return [];
  }

  async installNodePack(url: string, version?: string) {
    if (version !== undefined && !/^[\w][\w.+-]{0,99}$/.test(version)) throw new Error(`Not a version tag: ${version}`);
    const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
    if (!m) throw new Error(`Not a GitHub repository address: ${url}`);
    const key = `https://github.com/${m[1]}/${m[2]}`;
    if (this.nodePackRuns.has(key)) return;
    const run = { cancelled: false };
    this.nodePackRuns.set(key, run);
    const emit = (status: PackStatus) => this.host.emit({ type: 'node_pack', url: key, status });
    void (async () => {
      const total = 2_400_000;
      for (let p = 1; p <= 4 && !run.cancelled; p++) {
        await wait(Math.max(60, this.host.stepDelay()));
        emit({ state: 'downloading', file: m[2]!, index: 1, count: 1, bytes: (total * p) / 4, totalBytes: total });
      }
      if (!run.cancelled) {
        emit({ state: 'installing', step: 'requirements' });
        await wait(Math.max(200, this.host.stepDelay() * 4));
      }
      this.nodePackRuns.delete(key);
      if (run.cancelled) return emit({ state: 'missing', totalBytes: 0 });
      if (m[2]!.includes('fail')) return emit({ state: 'error', message: 'Installing the pack\'s libraries failed: mock' });
      const folder = m[2]!;
      this.nodePackList = {
        ...this.nodePackList,
        installed: [...this.nodePackList.installed.filter((p) => p.folder !== folder), { folder, url: key, version: version ?? null }].sort((a, b) => a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())),
        restartNeeded: true,
      };
      emit({ state: 'ready' });
    })();
  }

  async cancelNodePack(url: string) {
    const run = this.nodePackRuns.get(url);
    if (run) run.cancelled = true;
  }

  async removeNodePack(folder: string): Promise<NodePacks> {
    await wait(LATENCY);
    if (!this.nodePackList.installed.some((p) => p.folder === folder)) throw new Error(`${folder} is not installed`);
    this.nodePackList = { ...this.nodePackList, installed: this.nodePackList.installed.filter((p) => p.folder !== folder), restartNeeded: true };
    return structuredClone(this.nodePackList);
  }

  async restartEngine(): Promise<NodePacks> {
    if (this.host.jobRunning()) throw new Error('ComfyUI cannot restart while a job is running');
    await this.pretendRestart();
    this.nodePackList = { ...this.nodePackList, restartNeeded: false };
    return structuredClone(this.nodePackList);
  }

  private async pretendRestart() {
    this.host.emit({ type: 'engine_status', status: { state: 'starting' } });
    await wait(Math.max(300, this.host.stepDelay() * 6));
    this.runningLowMemory = this.lowMemory;
    this.host.emit({ type: 'engine_status', status: { state: 'ready' } });
  }

  private lowMemoryState(): LowMemoryMode {
    return { enabled: this.lowMemory, ownedEngine: true, pendingRestart: this.lowMemory !== this.runningLowMemory };
  }

  async lowMemoryMode(): Promise<LowMemoryMode> {
    await wait(LATENCY);
    return this.lowMemoryState();
  }

  async setLowMemoryMode(enabled: boolean): Promise<LowMemoryMode> {
    await wait(LATENCY);
    this.lowMemory = enabled;
    // Like the backend: restart now unless a job is running; otherwise it applies at the next start.
    if (enabled !== this.runningLowMemory && !this.host.jobRunning()) await this.pretendRestart();
    return this.lowMemoryState();
  }

  // Engine settings (settings.json in the desktop app). Like the backend: values are checked, saved, and apply at the
  // next start of the app, so `restartNeeded` compares them with what this session "started" with.

  private engineSaved: EngineSettingsValues = { ...MOCK_ENGINE_START, modelRoots: [], comfyuiInstallDir: null };
  /** A data folder change waiting for the next start. */
  private dataNext: { dir: string; moves: boolean } | null = null;

  private engineState(): EngineSettings {
    const saved = this.engineSaved;
    const restartNeeded =
      saved.comfyuiPackage !== MOCK_ENGINE_START.comfyuiPackage ||
      saved.comfyuiStartTimeoutSecs !== MOCK_ENGINE_START.comfyuiStartTimeoutSecs ||
      saved.civitaiLookup !== MOCK_ENGINE_START.civitaiLookup ||
      saved.modelRoots.length > 0 ||
      saved.comfyuiInstallDir !== null ||
      this.dataNext !== null;
    return {
      dataDir: 'C:\\Users\\you\\novira-data',
      dataDirChangeable: true,
      dataDirNext: this.dataNext?.dir ?? null,
      dataDirMoves: this.dataNext?.moves ?? false,
      dataDirNote: null,
      comfyuiRoot: 'C:\\Users\\you\\novira-data\\comfyui',
      comfyuiMode: 'owned',
      comfyuiUrl: null,
      comfyuiDir: null,
      // The pretend install is the starting package. Saving another one does not reinstall it here; the backend does
      // that at the next start, so the install keeps the package it came from.
      comfyuiInstalled: true,
      installedComfyuiPackage: MOCK_ENGINE_START.comfyuiPackage,
      ...structuredClone(saved),
      restartNeeded,
    };
  }

  async engineSettings(): Promise<EngineSettings> {
    await wait(LATENCY);
    return this.engineState();
  }

  async setEngineSettings(patch: EngineSettingsPatch): Promise<EngineSettings> {
    await wait(LATENCY);
    const { comfyuiPackage, comfyuiStartTimeoutSecs, civitaiLookup, ...rest } = patch;
    if (Object.keys(rest).length > 0) throw new Error(`unknown field: ${Object.keys(rest).join(', ')}`);
    if (comfyuiPackage !== undefined && comfyuiPackage !== 'nvidia' && comfyuiPackage !== 'amd') {
      throw new Error('The ComfyUI package must be "nvidia" or "amd"');
    }
    if (
      comfyuiStartTimeoutSecs !== undefined &&
      !(Number.isInteger(comfyuiStartTimeoutSecs) && comfyuiStartTimeoutSecs >= 30 && comfyuiStartTimeoutSecs <= 1800)
    ) {
      throw new Error('The ComfyUI start timeout must be 30 to 1800 seconds');
    }
    if (comfyuiPackage !== undefined) this.engineSaved.comfyuiPackage = comfyuiPackage;
    if (comfyuiStartTimeoutSecs !== undefined) this.engineSaved.comfyuiStartTimeoutSecs = comfyuiStartTimeoutSecs;
    if (civitaiLookup !== undefined) this.engineSaved.civitaiLookup = civitaiLookup;
    return this.engineState();
  }

  /** The pretend folder dialog picks `D:\Models`, then `E:\Models` and so on (the first one not listed yet). */
  async addModelRoot(): Promise<EngineSettings | null> {
    await wait(LATENCY);
    const roots = this.engineSaved.modelRoots;
    if (roots.length >= MOCK_MAX_MODEL_ROOTS) throw new Error(`At most ${MOCK_MAX_MODEL_ROOTS} model folders can be added`);
    const letter = [...'DEFGHIJKLMNOPQRSTUVWXYZ'].find((l) => !roots.includes(`${l}:\\Models`))!;
    roots.push(`${letter}:\\Models`);
    return this.engineState();
  }

  async chooseDataDir(moveData: boolean): Promise<EngineSettings | null> {
    await wait(LATENCY);
    this.dataNext = { dir: 'D:\\novira-data', moves: moveData };
    return this.engineState();
  }

  async cancelDataDirChange(): Promise<EngineSettings> {
    await wait(LATENCY);
    this.dataNext = null;
    return this.engineState();
  }

  async chooseComfyuiInstallDir(): Promise<EngineSettings | null> {
    await wait(LATENCY);
    this.engineSaved.comfyuiInstallDir = 'D:\\ComfyUI-novira';
    return this.engineState();
  }

  async resetComfyuiInstallDir(): Promise<EngineSettings> {
    await wait(LATENCY);
    this.engineSaved.comfyuiInstallDir = null;
    return this.engineState();
  }

  async removeModelRoot(index: number): Promise<EngineSettings> {
    await wait(LATENCY);
    const roots = this.engineSaved.modelRoots;
    if (!Number.isInteger(index) || index < 0 || index >= roots.length) throw new Error('There is no model folder at that place');
    roots.splice(index, 1);
    return this.engineState();
  }
}
