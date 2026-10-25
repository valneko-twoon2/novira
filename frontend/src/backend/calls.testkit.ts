// One call of every method of the backend client that reaches the backend, shared by the contract tests of the two
// real clients (Tauri IPC: `tauri/commands.contract.test.ts`; HTTP: `http/commands.contract.test.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BackendClient } from './client';

// `import.meta.dirname`: under jsdom `URL` is jsdom's, which `node:fs` does not take.
export const ROOT = join(import.meta.dirname, '../../..');
export const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
export const fixture = (name: string): unknown => JSON.parse(read(`contract/${name}.json`));

export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Client methods that never reach IPC (local state, window, mock controls) or reach it through another method. */
export type LocalMethod =
  | 'kind'
  | 'subscribe'
  | 'queueStatus'
  | 'listQueue'
  | 'setWindowTheme'
  | 'setStepDelay'
  | 'saveImageFromUrl';

/** One call of every IPC-backed method; adding a method to `BackendClient` is a type error until it is listed. */
export const CALLS: {
  [K in Exclude<keyof BackendClient, LocalMethod>]: (b: BackendClient) => Promise<unknown>;
} = {
  bootstrap: (b) => b.bootstrap(),
  createBoard: (b) => b.createBoard('Board'),
  updateBoard: (b) => b.updateBoard('board-1', { name: 'Renamed' }),
  deleteBoard: (b) => b.deleteBoard('board-1', true),
  uploadImage: (b) => b.uploadImage(new Blob([new Uint8Array([1, 2, 3])]), { boardId: null }),
  updateImages: (b) => b.updateImages(['a.png'], { starred: true }),
  deleteImages: (b) => b.deleteImages(['a.png']),
  enqueue: (b) =>
    b.enqueue({
      ...(fixture('enqueue-request') as Parameters<BackendClient['enqueue']>[0]),
      prepend: true,
      initImageUrl: null,
    }),
  cancelQueueItem: (b) => b.cancelQueueItem(1),
  cancelBatch: (b) => b.cancelBatch('batch-1'),
  clearQueue: (b) => b.clearQueue(),
  pruneQueue: (b) => b.pruneQueue(),
  pauseProcessor: (b) => b.pauseProcessor(),
  resumeProcessor: (b) => b.resumeProcessor(),
  retryQueueItem: (b) => b.retryQueueItem(1, { width: 448, height: 640 }),
  listStarterModels: (b) => b.listStarterModels(),
  modelParts: (b) => b.modelParts('diffusion-1'),
  installModel: (b) => b.installModel('https://civitai.com/models/1', 'Model'),
  cancelInstall: (b) => b.cancelInstall('job-1'),
  updateModel: (b) => b.updateModel('main-1', { name: 'Renamed' }),
  deleteModel: (b) => b.deleteModel('main-1'),
  scanFolder: (b) => b.scanFolder(),
  listHuggingFaceFiles: (b) => b.listHuggingFaceFiles('owner/turbo'),
  searchCivitai: (b) =>
    b.searchCivitai({
      query: '',
      kind: 'all',
      baseModel: 'all',
      sort: 'downloads',
      period: 'all',
      includeNsfw: false,
    }),
  hardwareInfo: (b) => b.hardwareInfo(),
  listFonts: (b) => b.listFonts(),
  installPack: (b) => b.installPack('music'),
  cancelPack: (b) => b.cancelPack('music'),
  hasHuggingFaceToken: (b) => b.hasHuggingFaceToken(),
  setHuggingFaceToken: (b) => b.setHuggingFaceToken('token'),
  openHuggingFacePage: (b) => b.openHuggingFacePage('owner/repo'),
  openSourcePage: (b) => b.openSourcePage('https://civitai.com/models/1'),
  hasCivitaiKey: (b) => b.hasCivitaiKey(),
  setCivitaiKey: (b) => b.setCivitaiKey(null),
  openCivitaiPage: (b) => b.openCivitaiPage('1'),
  setUiZoom: (b) => b.setUiZoom(1.25),
  agentStatus: (b) => b.agentStatus(),
  agentLogin: (b) => b.agentLogin('claude'),
  agentEndpointSave: (b) =>
    b.agentEndpointSave({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2', apiKey: 'k' }),
  agentEndpointModels: (b) =>
    b.agentEndpointModels({ baseUrl: 'http://127.0.0.1:11434/v1', model: '' }),
  agentEndpointTest: (b) =>
    b.agentEndpointTest({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' }),
  agentChat: (b) => b.agentChat({ message: 'hi', locale: 'en' }),
  agentToolResult: (b) =>
    b.agentToolResult({ callId: 'c-0123456789abcdef0123456789abcdef', ok: true, content: 'done' }),
  agentCancel: (b) => b.agentCancel(),
  lookupReference: (b) => b.lookupReference('ja', '\u93a7'),
  saveWorkflow: (b) =>
    b.saveWorkflow({ name: 'W', description: '', author: '', tags: [], graph: {} }),
  deleteWorkflow: (b) => b.deleteWorkflow('wf-1'),
  listComics: (b) => b.listComics(),
  saveComic: (b) => b.saveComic('comic-1', { title: 'Mine' }),
  deleteComic: (b) => b.deleteComic('comic-1'),
  loadCanvas: (b) => b.loadCanvas(),
  saveCanvas: (b) => b.saveCanvas('{"version":1}'),
  adoptUiState: (b) => b.adoptUiState(null),
  saveUiState: (b) => b.saveUiState('{"novira.settings":"{}"}', 'page-1'),
  nodeDefs: (b) => b.nodeDefs(),
  comfyUiLocale: (b) => b.comfyUiLocale('ja'),
  nodePacks: (b) => b.nodePacks(),
  installNodePack: (b) => b.installNodePack('https://github.com/a/b', 'v1'),
  nodePackVersions: (b) => b.nodePackVersions('https://github.com/a/b'),
  nodePackInfo: (b) => b.nodePackInfo('https://github.com/a/b'),
  registryNodes: (b) => b.registryNodes(true),
  comfyVersions: (b) => b.comfyVersions(),
  switchComfyVersion: (b) => b.switchComfyVersion('v0.3.50'),
  cancelNodePack: (b) => b.cancelNodePack('https://github.com/a/b'),
  removeNodePack: (b) => b.removeNodePack('b'),
  restartEngine: (b) => b.restartEngine(),
  lowMemoryMode: (b) => b.lowMemoryMode(),
  setLowMemoryMode: (b) => b.setLowMemoryMode(true),
  engineSettings: (b) => b.engineSettings(),
  setEngineSettings: (b) =>
    b.setEngineSettings({ comfyuiPackage: 'amd', comfyuiStartTimeoutSecs: 600 }),
  addModelRoot: (b) => b.addModelRoot(),
  chooseDataDir: (b) => b.chooseDataDir(true),
  cancelDataDirChange: (b) => b.cancelDataDirChange(),
  chooseComfyuiInstallDir: (b) => b.chooseComfyuiInstallDir(),
  resetComfyuiInstallDir: (b) => b.resetComfyuiInstallDir(),
  removeModelRoot: (b) => b.removeModelRoot(0),
  faceRigLibrary: (b) => b.faceRigLibrary(),
  faceRigPreview: (b) => b.faceRigPreview({ nodeKey: 'n', rig: '{}', quality: 'drag' }),
  exportImages: (b) =>
    b.exportImages(['a.png'], {
      format: 'png',
      quality: 90,
      maxSide: null,
      removeInfo: true,
      watermark: false,
    }),
  revealExportFolder: (b) => b.revealExportFolder(),
  watermarkStatus: (b) => b.watermarkStatus(),
  prepareWatermark: (b) => b.prepareWatermark(),
  checkWatermarkFile: (b) => b.checkWatermarkFile(),
  checkWatermarkImage: (b) => b.checkWatermarkImage('a.png'),
  createBackup: (b) => b.createBackup('{}'),
  openBackup: (b) => b.openBackup(),
  confirmRestore: (b) => b.confirmRestore(),
  discardRestore: (b) => b.discardRestore(),
  takeRestoredUiState: (b) => b.takeRestoredUiState(),
  listUnfinishedDownloads: (b) => b.listUnfinishedDownloads(),
  deleteUnfinishedDownloads: (b) =>
    b.deleteUnfinishedDownloads(['comfyui/.downloads/comfyui.part']),
};
