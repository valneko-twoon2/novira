// The single boundary between the UI and the backend: the mock in a browser, Rust over Tauri IPC in the app, Rust over HTTP behind novira-server.
import type {
  AgentEndpointInput,
  AgentEndpointTest,
  AgentProvider,
  AgentReply,
  AgentRequest,
  AgentToolAnswer,
  AgentStatus,
  BackendEvent,
  BackupInfo,
  BackupSummary,
  BoardDTO,
  CivitaiSearchParams,
  CivitaiSearchResult,
  ComfyNodeDefs,
  ComfyUiLocale,
  ComicRecord,
  EngineStatus,
  EnqueueRequest,
  ExportOptions,
  ExportResult,
  WatermarkCheck,
  WatermarkStatus,
  FaceRigLibrary,
  FaceRigPreviewRequest,
  FaceRigPreviewResult,
  ImageDTO,
  ModelConfig,
  ModelInstallJob,
  NodePackInfo,
  NodePacks,
  ReferenceHit,
  ReferenceLanguage,
  RegistryNode,
  HardwareInfo,
  PackKind,
  Packs,
  LowMemoryMode,
  EngineSettings,
  EngineSettingsPatch,
  QueueItem,
  QueueStatus,
  RetrySize,
  RestoreOutcome,
  UnfinishedDownload,
  SavedWorkflow,
  ModelPartsReport,
  StarterModel,
} from './types';

export interface BackendClient {
  readonly kind: 'mock' | 'tauri' | 'http';
  subscribe(listener: (event: BackendEvent) => void): () => void;

  // Startup
  bootstrap(): Promise<{
    models: ModelConfig[];
    boards: BoardDTO[];
    images: ImageDTO[];
    workflows: SavedWorkflow[];
    engine: EngineStatus;
    packs: Packs;
  }>;

  // Boards
  createBoard(name: string): Promise<BoardDTO>;
  updateBoard(id: string, patch: Partial<Pick<BoardDTO, 'name' | 'archived'>>): Promise<BoardDTO>;
  deleteBoard(id: string, deleteImages: boolean): Promise<{ deletedImages: string[] }>;

  // Images
  uploadImage(file: Blob, opts: { boardId: string | null; isIntermediate?: boolean; category?: ImageDTO['category'] }): Promise<ImageDTO>;
  /** Store a rendered image (e.g. canvas flatten, filter result). */
  saveImageFromUrl(url: string, opts: { boardId: string | null; isIntermediate?: boolean; category?: ImageDTO['category'] }): Promise<ImageDTO>;
  updateImages(names: string[], patch: Partial<Pick<ImageDTO, 'boardId' | 'starred' | 'isIntermediate'>>): Promise<ImageDTO[]>;
  deleteImages(names: string[]): Promise<void>;

  // Queue
  enqueue(request: EnqueueRequest): Promise<QueueItem[]>;
  cancelQueueItem(id: number): Promise<void>;
  cancelBatch(batchId: string): Promise<void>;
  clearQueue(): Promise<void>;
  pruneQueue(): Promise<void>;
  pauseProcessor(): Promise<void>;
  resumeProcessor(): Promise<void>;
  /** Queues a failed or cancelled item again with the same seed; `size` makes a picture smaller (after running out of memory). */
  retryQueueItem(id: number, size?: RetrySize): Promise<QueueItem | null>;
  queueStatus(): QueueStatus;
  listQueue(): QueueItem[];

  // Models
  listStarterModels(): Promise<StarterModel[]>;
  /** The starter files an installed model needs but the library does not hold (text encoders, VAE, vision model). */
  modelParts(modelKey: string): Promise<ModelPartsReport>;
  installModel(source: string, name?: string): Promise<ModelInstallJob>;
  cancelInstall(jobId: string): Promise<void>;
  updateModel(key: string, patch: Partial<ModelConfig>): Promise<ModelConfig>;
  deleteModel(key: string): Promise<void>;
  /** Asks for a folder in the shell's own dialog (the page never sends a path) and lists the model files in it; null when the dialog is cancelled. */
  scanFolder(): Promise<{ path: string; installed: boolean }[] | null>;
  /** The model files of a Hugging Face repository ("owner/name"), as paths in it. Nothing is downloaded. */
  listHuggingFaceFiles(repo: string): Promise<string[]>;

  // Online model search
  searchCivitai(params: CivitaiSearchParams): Promise<CivitaiSearchResult>;
  /** Starts downloading the models of a pack (video, music, voice); progress arrives as `pack` events. */
  /** The graphics card and its memory (read when asked; `vramBytes` is `null` when unknown). */
  hardwareInfo(): Promise<HardwareInfo>;
  /** The font families installed on this computer, sorted (empty when they cannot be read). */
  listFonts(): Promise<string[]>;
  installPack(kind: PackKind): Promise<void>;
  cancelPack(kind: PackKind): Promise<void>;
  /** Whether a Hugging Face token is saved (for gated models). The token itself is never returned. */
  hasHuggingFaceToken(): Promise<boolean>;
  setHuggingFaceToken(token: string | null): Promise<void>;
  openHuggingFacePage(repo: string): Promise<void>;
  /** Opens a page in the system browser: where a model or extension came from, or an open-source homepage of the about dialog. Only https pages on the sites the backend lists (`SOURCE_SITES`) are accepted. */
  openSourcePage(url: string): Promise<void>;
  /** Whether a Civitai API key is saved. The key itself is never returned. */
  hasCivitaiKey(): Promise<boolean>;
  /** Saves the key encrypted by the backend (null or blank removes it). */
  setCivitaiKey(key: string | null): Promise<void>;
  /** Opens the model's page on civitai.com in the system browser (no-op report on the mock). */
  openCivitaiPage(modelId: string): Promise<void>;
  /** Desktop app: zooms the whole page (the browser build leaves zoom to the browser and ignores this). */
  setUiZoom(scale: number): Promise<void>;

  // AI assistant
  agentStatus(): Promise<AgentStatus>;
  /** Selects the tool and signs in to it when needed (opens the browser); resolves once done. */
  agentLogin(provider: AgentProvider): Promise<AgentStatus>;
  /** Saves the OpenAI-compatible server (address, model, key) and selects it as the assistant. */
  agentEndpointSave(input: AgentEndpointInput): Promise<AgentStatus>;
  /** The models the server offers; rejects when it lists none (the form then takes a typed name). */
  agentEndpointModels(input: AgentEndpointInput): Promise<string[]>;
  /** Checks the server, the model and a tool-call round trip; the outcome about tools is kept for the saved server. */
  agentEndpointTest(input: AgentEndpointInput): Promise<AgentEndpointTest>;
  /** Runs one request; its tool calls arrive as `agent_tool_call` events while it runs. */
  agentChat(request: AgentRequest): Promise<AgentReply>;
  /** The answer to one of the running request's tool calls. */
  agentToolResult(answer: AgentToolAnswer): Promise<void>;
  /**
   * The assistant's fact look-up: up to three Wikipedia articles about a short query, read by the backend (the window
   * never connects out). The caller has asked the user first, because the words leave this PC.
   */
  lookupReference(language: ReferenceLanguage, query: string): Promise<ReferenceHit[]>;
  /** Stops the chat turn that is running (its `agentChat` then fails); nothing happens when none is. */
  agentCancel(): Promise<void>;

  // Workflows
  saveWorkflow(workflow: Omit<SavedWorkflow, 'id' | 'updatedAt' | 'category'> & { id?: string }): Promise<SavedWorkflow>;
  deleteWorkflow(id: string): Promise<void>;
  // Canvas
  /** The saved canvas document (JSON text; its shape belongs to the frontend), `null` before the first save. */
  loadCanvas(): Promise<string | null>;
  /** Replaces the saved canvas document (a JSON object, at most 32 MiB). */
  saveCanvas(document: string): Promise<void>;
  // Screen state
  /**
   * The first call of a page: the screen state the backend holds (the `novira.*` texts of settings, history, drafts and
   * presets as one JSON object), or `null` when it holds none and takes `local` (what the page's own storage has; sent
   * only by a page that was never synced) as its state.
   */
  adoptUiState(local: string | null): Promise<string | null>;
  /** Replaces the saved screen state (a JSON object of `novira.*` keys with text values, at most 32 MiB). */
  saveUiState(state: string, origin?: string): Promise<void>;
  // Comics
  /** Every saved comic project, oldest change first. */
  listComics(): Promise<ComicRecord[]>;
  /** Saves a comic under `id` (1 to 64 letters, digits, `-` or `_`); the document is a JSON object of at most 32 MiB. */
  saveComic(id: string, document: unknown): Promise<void>;
  /** Removes a saved comic; nothing happens when there is none. */
  deleteComic(id: string): Promise<void>;
  /** Every node ComfyUI can run (its `object_info`), including installed custom node packs; starts ComfyUI when needed. */
  nodeDefs(): Promise<ComfyNodeDefs>;
  /** The words ComfyUI's own screens show in one of the app's languages, or null when it has none (none in the browser). */
  comfyUiLocale(locale: string): Promise<ComfyUiLocale | null>;
  /** The custom node packs in ComfyUI's folder. */
  nodePacks(): Promise<NodePacks>;
  /**
   * Installs a pack from `https://github.com/<owner>/<repo>` in the background (at the tag `version`, or from the default
   * branch when it is omitted); progress arrives as `node_pack` events.
   */
  installNodePack(url: string, version?: string): Promise<void>;
  /** The tags of a pack's repository, newest first: the versions it can be installed at. */
  nodePackVersions(url: string): Promise<string[]>;
  /** The author and licence of a pack's GitHub repository. */
  nodePackInfo(url: string): Promise<NodePackInfo>;
  /** Every pack of the ComfyUI Registry, most downloaded first (kept for an hour; `refresh` reads it again). */
  registryNodes(refresh: boolean): Promise<RegistryNode[]>;
  /** The ComfyUI releases it can be switched to, newest first. */
  comfyVersions(): Promise<string[]>;
  /**
   * Replaces the ComfyUI novira installed by the release `version` and installs every extension again (minutes; progress
   * arrives as `engine_status` and `node_pack` events). Resolves with the folders of the extensions that could not be installed again.
   */
  switchComfyVersion(version: string): Promise<string[]>;
  cancelNodePack(url: string): Promise<void>;
  removeNodePack(folder: string): Promise<NodePacks>;
  /** Restarts ComfyUI so it loads changed packs (refused while a job runs). */
  restartEngine(): Promise<NodePacks>;
  /** ComfyUI's low-memory mode. */
  lowMemoryMode(): Promise<LowMemoryMode>;
  /** Saves the setting and restarts ComfyUI to apply it, unless a job is running (then `pendingRestart` stays true). */
  setLowMemoryMode(enabled: boolean): Promise<LowMemoryMode>;
  /** The engine settings saved in `settings.json` (they apply at the next start; `restartNeeded` says when one is pending). */
  engineSettings(): Promise<EngineSettings>;
  /** Saves the package and the start timeout. A value out of range or unknown is refused, and then nothing is saved. */
  setEngineSettings(patch: EngineSettingsPatch): Promise<EngineSettings>;
  /**
   * Asks for a folder in a native dialog (desktop) and adds it to the extra model folders; null when the dialog is
   * cancelled. Refused when the folder is already listed, is the data folder or inside it, or 16 are listed.
   */
  addModelRoot(): Promise<EngineSettings | null>;
  /**
   * Asks for a folder in a native dialog and makes it the data folder of the next start, with the current data moved
   * into it when `moveData` is set (an empty folder is needed then); null when the dialog is cancelled.
   */
  chooseDataDir(moveData: boolean): Promise<EngineSettings | null>;
  /** Cancels a data folder change that waits for the next start. */
  cancelDataDirChange(): Promise<EngineSettings>;
  /** Asks for a folder and makes it the place novira's own ComfyUI is installed in from the next start; null when cancelled. */
  chooseComfyuiInstallDir(): Promise<EngineSettings | null>;
  /** novira's own ComfyUI goes back to `comfyui` in the data folder from the next start. */
  resetComfyuiInstallDir(): Promise<EngineSettings>;
  /** Removes the extra model folder at `index` of `modelRoots`. */
  removeModelRoot(index: number): Promise<EngineSettings>;
  /** The axes and presets of the Face Rig pack (needs NKD Basic Tools installed and loaded). */
  faceRigLibrary(): Promise<FaceRigLibrary>;
  /** Renders a pose on a portrait for the Face Rig editor. */
  faceRigPreview(request: FaceRigPreviewRequest): Promise<FaceRigPreviewResult>;

  // Export for sharing and backups. The desktop app asks for the folder or file in a native dialog itself (the page
  // never handles a path); null means the user cancelled that dialog.
  /** Writes clean copies of the pictures (videos and audio are skipped) into a folder the user chooses; the browser downloads them. */
  exportImages(names: string[], options: ExportOptions): Promise<ExportResult | null>;
  /** Opens the folder of the last export (desktop only). */
  revealExportFolder(): Promise<void>;
  /** Whether the export watermark's files are on this PC (they download in the background at start). */
  watermarkStatus(): Promise<WatermarkStatus>;
  /** Tries the watermark's download again; returns at once. */
  prepareWatermark(): Promise<void>;
  /** Asks for a picture file and reads its marks (watermark, content credentials, AI label); null when cancelled. */
  checkWatermarkFile(): Promise<WatermarkCheck | null>;
  /** Reads the marks of a gallery picture. */
  checkWatermarkImage(name: string): Promise<WatermarkCheck>;
  /** Writes a backup (database, gallery files and `uiState`, the saved screen state) to a file the user chooses. */
  createBackup(uiState: string): Promise<BackupSummary | null>;
  /** Asks for a backup, checks and unpacks it, and tells what it holds; nothing is replaced yet. */
  openBackup(): Promise<BackupInfo | null>;
  /** Replaces the current data with the opened backup: the desktop app restarts to apply it. */
  confirmRestore(): Promise<void>;
  /** Drops the opened backup. */
  discardRestore(): Promise<void>;
  /** Whether this start applied a restore (with the screen state to put back) or failed one; answered once. */
  takeRestoredUiState(): Promise<RestoreOutcome>;
  /** The partial files that interrupted downloads left behind, kept so each download can continue. */
  listUnfinishedDownloads(): Promise<UnfinishedDownload[]>;
  /** Deletes the partial files at `paths`; returns the entries still present (a file in use is kept). */
  deleteUnfinishedDownloads(paths: string[]): Promise<UnfinishedDownload[]>;

  /** Colours the window frame (title bar) to match the app theme. A no-op in the browser. */
  setWindowTheme(theme: 'light' | 'dark'): void;

  // Mock-only controls (no-ops on the real client)
  setStepDelay(ms: number): void;
}
