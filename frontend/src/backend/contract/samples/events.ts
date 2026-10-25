// Engine and pack states, the start-up data and the backend events.
import type { Bootstrap, WireEvent } from '../../tauri/TauriBackend';
import type { EngineSettings, EngineSettingsPatch, EngineStatus, HardwareInfo, PackStatus } from '../../types';
import { boardDto, imageDto } from './gallery';
import type { ByState, ByType } from './helpers';
import { modelConfig, modelInstallJob } from './models';
import { progressEvent, queueItem, queueSnapshot } from './queue';
import { savedWorkflow } from './workflows';
import { agentToolCall } from './agent';

export const engineStatus = {
  idle: { state: 'idle' },
  downloading: { state: 'downloading', bytes: 10, totalBytes: 100 },
  extracting: { state: 'extracting' },
  starting: { state: 'starting' },
  ready: { state: 'ready' },
  error: { state: 'error', message: 'port in use' },
} satisfies ByState<EngineStatus>;

export const packStatus = {
  missing: { state: 'missing', totalBytes: 100 },
  downloading: { state: 'downloading', file: 'model.safetensors', index: 1, count: 3, bytes: 10, totalBytes: 100 },
  installing: { state: 'installing', step: 'pip install' },
  ready: { state: 'ready' },
  error: { state: 'error', message: 'network' },
} satisfies ByState<PackStatus>;

export const hardwareInfo = {
  known: { gpuName: 'NVIDIA GeForce RTX 4070 Ti', vramBytes: 12878610432 },
  unknown: { gpuName: '', vramBytes: null },
} satisfies Record<string, HardwareInfo>;

export const engineSettings = {
  dataDir: 'C:\\Users\\you\\novira-data',
  dataDirChangeable: true,
  dataDirNext: 'D:\\novira-data',
  dataDirMoves: true,
  dataDirNote: null,
  comfyuiMode: 'folder',
  comfyuiUrl: null,
  comfyuiDir: 'D:\\ComfyUI',
  comfyuiInstallDir: 'D:\\engine',
  comfyuiRoot: 'C:\\Users\\you\\novira-data\\comfyui',
  comfyuiPackage: 'amd',
  comfyuiInstalled: false,
  installedComfyuiPackage: null,
  comfyuiStartTimeoutSecs: 600,
  modelRoots: ['D:\\Models', 'E:\\StabilityMatrix\\Data\\Models'],
  civitaiLookup: false,
  restartNeeded: true,
} satisfies Required<EngineSettings>;

export const engineSettingsPatch = {
  comfyuiPackage: 'nvidia',
  comfyuiStartTimeoutSecs: 300,
  civitaiLookup: true,
} satisfies Required<EngineSettingsPatch>;

export const bootstrap = {
  models: [modelConfig],
  boards: [boardDto],
  images: [imageDto],
  workflows: [savedWorkflow],
  queue: queueSnapshot,
  engine: engineStatus.ready,
  packs: {
    video: packStatus.ready,
    turbo: packStatus.missing,
    music: packStatus.downloading,
    voice: packStatus.installing,
    inpaint: packStatus.error,
    logo: packStatus.missing,
  },
} satisfies Required<Bootstrap>;

/** What the shell emits on `novira://event` (`queue_cleared` carries the remaining items there). */
export const backendEvents = {
  queue_item_status_changed: { type: 'queue_item_status_changed', item: queueItem },
  queue_cleared: { type: 'queue_cleared', items: [queueItem] },
  processor_state: { type: 'processor_state', isPaused: true },
  invocation_progress: { type: 'invocation_progress', progress: progressEvent },
  image_added: { type: 'image_added', image: imageDto, item: queueItem },
  model_install: { type: 'model_install', job: modelInstallJob },
  model_added: { type: 'model_added', model: modelConfig },
  engine_status: { type: 'engine_status', status: engineStatus.downloading },
  pack: { type: 'pack', kind: 'music', status: packStatus.downloading },
  node_pack: { type: 'node_pack', url: 'https://github.com/a/b', status: packStatus.ready },
  log: { type: 'log', entry: { at: 1_760_000_000_000, level: 'error', source: 'panic', message: 'worker panicked' } },
  backup: { type: 'backup', progress: { phase: 'create', done: 12, total: 40 } },
  agent_tool_call: { type: 'agent_tool_call', call: agentToolCall },
  ui_state_changed: { type: 'ui_state_changed', origin: 'page-0123456789abcdef', revision: 1_760_000_000_000 },
} satisfies ByType<WireEvent>;
