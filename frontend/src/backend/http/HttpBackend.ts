// Backend client for a page served by `novira-server` (backend/crates/novira-server): the same Rust backend as the
// desktop app, reached with `POST /api/<command>` (JSON, camelCase arguments, as the Tauri client sends them), a picture
// upload at `POST /upload/image` and the backend's events over the WebSocket `/events`. The commands the server does
// not answer (the ones that need a native dialog) come back as "not available in the browser yet" errors.
import type { BackendClient } from '../client';
import { DEFAULT_WORKFLOWS } from '../defaultWorkflows';
import { downloadBlob } from '../download';
import { perf } from '../perf';
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
  EnqueueRequest,
  ExportOptions,
  ExportResult,
  WatermarkCheck,
  WatermarkStatus,
  FaceRigLibrary,
  FaceRigPreviewRequest,
  FaceRigPreviewResult,
  ImageDTO,
  LowMemoryMode,
  EngineSettings,
  EngineSettingsPatch,
  ModelConfig,
  ModelInstallJob,
  NodePackInfo,
  NodePacks,
  ReferenceHit,
  ReferenceLanguage,
  RegistryNode,
  HardwareInfo,
  PackKind,
  QueueItem,
  QueueStatus,
  RetrySize,
  RestoreOutcome,
  UnfinishedDownload,
  SavedWorkflow,
  ModelPartsReport,
  StarterModel,
} from '../types';
import type { Bootstrap, WireEvent } from '../tauri/TauriBackend';

declare global {
  interface Window {
    /** Set by the script the server adds to `index.html`. */
    __NOVIRA_SERVER__?: boolean;
  }
}

/** Image URLs the server hands out (relative to the page). */
const IMAGE_URL_PREFIX = '/novira-image/';
const UPLOAD_ROUTE = '/upload/image';
const UPLOAD_OPTIONS_HEADER = 'x-novira-options';
const EXPORT_ROUTE = '/export/images';
const EXPORT_RESULT_HEADER = 'x-novira-export';
/** How long to wait before the event socket is opened again after it dropped. */
const RECONNECT_MS = 1000;
/** The longest the first read waits for the event socket. */
const OPEN_WAIT_MS = 3000;

type ImageOptions = {
  boardId: string | null;
  isIntermediate?: boolean;
  category?: ImageDTO['category'];
};

export function isServerImageUrl(url: string): boolean {
  return url.startsWith(IMAGE_URL_PREFIX);
}

/** Whether this page was served by `novira-server`. */
export function isServedByServer(): boolean {
  return typeof window !== 'undefined' && window.__NOVIRA_SERVER__ === true;
}

export class HttpBackend implements BackendClient {
  readonly kind = 'http' as const;
  private listeners = new Set<(e: BackendEvent) => void>();
  private queue: QueueItem[] = [];
  private paused = false;
  private socket: WebSocket | null = null;
  private opened: Promise<void> | null = null;
  private hasBeenOpen = false;

  /**
   * Opens the event socket once. The returned promise settles when it is open or has failed; a socket that drops opens
   * again after a pause and the queue is read again, because events were missed meanwhile.
   */
  private listen(): Promise<void> {
    this.opened ??= new Promise<void>((resolve) => {
      const open = () => {
        const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
        const socket = new WebSocket(`${scheme}://${location.host}/events`);
        this.socket = socket;
        socket.onopen = () => {
          const again = this.hasBeenOpen;
          this.hasBeenOpen = true;
          resolve();
          if (again) void this.resyncQueue().then(() => this.receive({ type: 'queue_cleared', items: this.queue }));
        };
        socket.onmessage = (message) => {
          try {
            this.receive(JSON.parse(String(message.data)) as WireEvent);
          } catch {
            // A message that is not an event is ignored.
          }
        };
        socket.onclose = () => {
          resolve();
          if (this.socket === socket) setTimeout(open, RECONNECT_MS);
        };
      };
      open();
      // A socket that neither opens nor fails must not hold the first read back.
      setTimeout(resolve, OPEN_WAIT_MS);
    });
    return this.opened;
  }

  private receive(event: WireEvent) {
    // Only the events that change the queue mirror are read here; every event is passed on below.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- the others need nothing from the mirror
    switch (event.type) {
      case 'queue_item_status_changed':
        this.upsert(event.item);
        break;
      case 'queue_cleared':
        this.queue = event.items.map((i) => ({ ...i }));
        break;
      case 'processor_state':
        this.paused = event.isPaused;
        break;
    }
    const out: BackendEvent = event.type === 'queue_cleared' ? { type: 'queue_cleared' } : event;
    this.listeners.forEach((l) => l(out));
  }

  /** One command: the arguments as a JSON object, the result (or the server's message as an error). */
  private call<T>(command: string, args?: object): Promise<T> {
    return perf.timed(command, () => this.send<T>(command, args));
  }

  private async send<T>(command: string, args?: object): Promise<T> {
    const response = await fetch(`/api/${command}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(args ?? {}),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (data as { error?: unknown } | null)?.error;
      throw new Error(
        typeof message === 'string' ? message : `${command} failed (${response.status})`,
      );
    }
    return data as T;
  }

  subscribe(listener: (event: BackendEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setWindowTheme(): void {
    // The browser has no window frame to colour.
  }

  setStepDelay(): void {
    // Real generations have no artificial step delay.
  }

  async bootstrap() {
    await this.listen();
    const data = await this.call<Bootstrap>('bootstrap');
    this.queue = data.queue.items;
    this.paused = data.queue.status.isPaused;
    // Built-in workflows are frontend-owned editor graphs; the backend stores only the user's.
    const builtIn = DEFAULT_WORKFLOWS.filter((w) => !data.workflows.some((u) => u.id === w.id));
    return {
      models: data.models,
      boards: data.boards,
      images: data.images,
      workflows: [...builtIn.map((w) => ({ ...w })), ...data.workflows],
      engine: data.engine,
      packs: data.packs,
    };
  }

  // Boards -----------------------------------------------------------------

  createBoard(name: string) {
    return this.call<BoardDTO>('create_board', { name });
  }

  updateBoard(id: string, patch: Partial<Pick<BoardDTO, 'name' | 'archived'>>) {
    return this.call<BoardDTO>('update_board', { id, patch });
  }

  async deleteBoard(id: string, deleteImages: boolean) {
    const deletedImages = await this.call<string[]>('delete_board', { id, deleteImages });
    return { deletedImages };
  }

  // Images -----------------------------------------------------------------

  /** A picture goes in as raw bytes with its options in a header (the route the desktop's raw upload body becomes). */
  private async upload(
    blob: Blob,
    opts: ImageOptions & { category: ImageDTO['category'] },
  ): Promise<ImageDTO> {
    const options = {
      boardId: opts.boardId,
      isIntermediate: opts.isIntermediate ?? false,
      category: opts.category,
    };
    const response = await fetch(UPLOAD_ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        [UPLOAD_OPTIONS_HEADER]: JSON.stringify(options),
      },
      credentials: 'same-origin',
      body: blob,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (data as { error?: unknown } | null)?.error;
      throw new Error(typeof message === 'string' ? message : `upload failed (${response.status})`);
    }
    return data as ImageDTO;
  }

  uploadImage(file: Blob, opts: ImageOptions) {
    return this.upload(file, { ...opts, category: opts.category ?? 'user' });
  }

  async saveImageFromUrl(url: string, opts: ImageOptions) {
    const blob = await (await fetch(url)).blob();
    return this.upload(blob, { ...opts, category: opts.category ?? 'general' });
  }

  updateImages(
    names: string[],
    patch: Partial<Pick<ImageDTO, 'boardId' | 'starred' | 'isIntermediate'>>,
  ) {
    return this.call<ImageDTO[]>('update_images', { names, patch });
  }

  deleteImages(names: string[]) {
    return this.call<void>('delete_images', { names });
  }

  // Queue ------------------------------------------------------------------

  /** A picture rendered in the page (canvas flatten, mask, blob) stored as a hidden image the backend can read. */
  private async stored(url: string, category: ImageDTO['category']): Promise<string> {
    if (isServerImageUrl(url)) return url;
    return (await this.saveImageFromUrl(url, { boardId: null, isIntermediate: true, category })).url;
  }

  async enqueue(request: EnqueueRequest): Promise<QueueItem[]> {
    const initImageUrl = request.initImageUrl ? await this.stored(request.initImageUrl, 'general') : null;
    const maskImageUrl = request.maskImageUrl ? await this.stored(request.maskImageUrl, 'mask') : null;
    const controlLayers = [];
    for (const c of request.controlLayers ?? []) controlLayers.push({ ...c, imageUrl: await this.stored(c.imageUrl, 'control') });
    const regionalLayers = [];
    for (const r of request.regionalLayers ?? []) regionalLayers.push({ ...r, imageUrl: await this.stored(r.imageUrl, 'mask') });
    const refImages = [];
    for (const r of request.refImages ?? []) refImages.push({ ...r, imageUrl: await this.stored(r.imageUrl, 'user') });
    const referencePictures = [];
    for (const url of request.referencePictures ?? []) referencePictures.push(await this.stored(url, 'user'));
    const items = await this.call<QueueItem[]>('enqueue', {
      request: { ...request, initImageUrl, maskImageUrl, controlLayers, regionalLayers, refImages, referencePictures, workflow: request.workflow ?? null },
    });
    if (request.prepend) await this.resyncQueue();
    else items.forEach((i) => this.upsert(i));
    return items;
  }

  private upsert(item: QueueItem) {
    const i = this.queue.findIndex((q) => q.id === item.id);
    if (i < 0) this.queue.push({ ...item });
    else this.queue[i] = { ...item };
  }

  private async resyncQueue() {
    const snap = await this.call<Bootstrap['queue']>('queue_snapshot');
    this.queue = snap.items;
    this.paused = snap.status.isPaused;
  }

  cancelQueueItem(id: number) {
    return this.call<void>('cancel_queue_item', { id });
  }

  cancelBatch(batchId: string) {
    return this.call<void>('cancel_batch', { batchId });
  }

  clearQueue() {
    return this.call<void>('clear_queue');
  }

  pruneQueue() {
    return this.call<void>('prune_queue');
  }

  pauseProcessor() {
    return this.call<void>('pause_processor');
  }

  resumeProcessor() {
    return this.call<void>('resume_processor');
  }

  retryQueueItem(id: number, size?: RetrySize) {
    return this.call<QueueItem | null>('retry_queue_item', { id, size: size ?? null });
  }

  queueStatus(): QueueStatus {
    const count = (s: QueueItem['status']) => this.queue.filter((q) => q.status === s).length;
    return {
      pending: count('pending'),
      inProgress: count('in_progress'),
      completed: count('completed'),
      failed: count('failed'),
      canceled: count('canceled'),
      total: this.queue.length,
      isPaused: this.paused,
    };
  }

  listQueue(): QueueItem[] {
    return this.queue.map((q) => ({ ...q }));
  }

  // Models -----------------------------------------------------------------

  listStarterModels() {
    return this.call<StarterModel[]>('list_starter_models');
  }

  modelParts(modelKey: string) {
    return this.call<ModelPartsReport>('model_parts', { modelKey });
  }

  installModel(source: string, name?: string) {
    return this.call<ModelInstallJob>('install_model', { source, name: name ?? null });
  }

  cancelInstall(jobId: string) {
    return this.call<void>('cancel_install', { jobId });
  }

  updateModel(key: string, patch: Partial<ModelConfig>) {
    return this.call<ModelConfig>('update_model', { key, patch });
  }

  deleteModel(key: string) {
    return this.call<void>('delete_model', { key });
  }

  scanFolder() {
    return this.call<{ path: string; installed: boolean }[] | null>('scan_folder');
  }

  listHuggingFaceFiles(repo: string) {
    return this.call<string[]>('list_hugging_face_files', { repo });
  }

  hardwareInfo() {
    return this.call<HardwareInfo>('hardware_info');
  }

  listFonts() {
    return this.call<string[]>('list_fonts');
  }

  async installPack(kind: PackKind) {
    await this.call('install_pack', { kind });
  }

  async cancelPack(kind: PackKind) {
    await this.call('cancel_pack', { kind });
  }

  hasHuggingFaceToken() {
    return this.call<boolean>('has_hf_token');
  }

  async setHuggingFaceToken(token: string | null) {
    await this.call('set_hf_token', { token });
  }

  /**
   * A page outside the app, in a new tab. The server answers the address the backend built and checked (the same
   * checks as the desktop app, `api::page_url`), so this page never opens a site the app would not.
   */
  private async openPage(command: string, args: Record<string, unknown>) {
    const url = await this.call<string>(command, args);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async openHuggingFacePage(repo: string) {
    await this.openPage('open_huggingface_page', { repo });
  }

  async openSourcePage(url: string) {
    await this.openPage('open_source_page', { url });
  }

  hasCivitaiKey() {
    return this.call<boolean>('has_civitai_key');
  }

  async setCivitaiKey(key: string | null) {
    await this.call('set_civitai_key', { key });
  }

  setUiZoom(_scale: number): Promise<void> {
    // The browser's own zoom does it.
    return Promise.resolve();
  }

  async openCivitaiPage(modelId: string) {
    await this.openPage('open_civitai_page', { modelId });
  }

  searchCivitai(params: CivitaiSearchParams) {
    return this.call<CivitaiSearchResult>('search_civitai', {
      params: { ...params, cursor: params.cursor ?? null },
    });
  }

  // AI assistant ------------------------------------------------------------

  agentStatus() {
    return this.call<AgentStatus>('agent_status');
  }

  agentLogin(provider: AgentProvider) {
    return this.call<AgentStatus>('agent_login', { provider });
  }

  agentEndpointSave(input: AgentEndpointInput) {
    return this.call<AgentStatus>('agent_endpoint_save', { input });
  }

  agentEndpointModels(input: AgentEndpointInput) {
    return this.call<string[]>('agent_endpoint_models', { input });
  }

  agentEndpointTest(input: AgentEndpointInput) {
    return this.call<AgentEndpointTest>('agent_endpoint_test', { input });
  }

  agentChat(request: AgentRequest) {
    return this.call<AgentReply>('agent_chat', { request });
  }

  async agentToolResult(answer: AgentToolAnswer) {
    await this.call('agent_tool_result', { answer });
  }

  lookupReference(language: ReferenceLanguage, query: string) {
    return this.call<ReferenceHit[]>('lookup_reference', { language, query });
  }

  async agentCancel() {
    await this.call('agent_cancel');
  }

  // Workflows --------------------------------------------------------------

  saveWorkflow(workflow: Omit<SavedWorkflow, 'id' | 'updatedAt' | 'category'> & { id?: string }) {
    return this.call<SavedWorkflow>('save_workflow', { workflow });
  }

  deleteWorkflow(id: string) {
    return this.call<void>('delete_workflow', { id });
  }

  // Comics -----------------------------------------------------------------

  listComics() {
    return this.call<ComicRecord[]>('list_comics');
  }

  saveComic(id: string, document: unknown) {
    return this.call<void>('save_comic', { id, document });
  }

  deleteComic(id: string) {
    return this.call<void>('delete_comic', { id });
  }

  // Canvas -----------------------------------------------------------------

  loadCanvas() {
    return this.call<string | null>('load_canvas');
  }

  saveCanvas(document: string) {
    return this.call<void>('save_canvas', { document });
  }

  // Screen state -----------------------------------------------------------

  adoptUiState(local: string | null) {
    return this.call<string | null>('adopt_ui_state', { local });
  }

  saveUiState(state: string, origin?: string) {
    return this.call<void>('save_ui_state', { state, origin });
  }

  nodeDefs() {
    return this.call<ComfyNodeDefs>('node_defs');
  }

  comfyUiLocale(locale: string) {
    return this.call<ComfyUiLocale | null>('comfy_ui_locale', { locale });
  }

  nodePacks() {
    return this.call<NodePacks>('node_packs');
  }

  installNodePack(url: string, version?: string) {
    return this.call<void>('install_node_pack', { url, version: version ?? null });
  }

  nodePackVersions(url: string) {
    return this.call<string[]>('node_pack_versions', { url });
  }

  nodePackInfo(url: string) {
    return this.call<NodePackInfo>('node_pack_info', { url });
  }

  registryNodes(refresh: boolean) {
    return this.call<RegistryNode[]>('registry_nodes', { refresh });
  }

  comfyVersions() {
    return this.call<string[]>('comfy_versions');
  }

  switchComfyVersion(version: string) {
    return this.call<string[]>('switch_comfy_version', { version });
  }

  cancelNodePack(url: string) {
    return this.call<void>('cancel_node_pack', { url });
  }

  removeNodePack(folder: string) {
    return this.call<NodePacks>('remove_node_pack', { folder });
  }

  restartEngine() {
    return this.call<NodePacks>('restart_engine');
  }

  lowMemoryMode() {
    return this.call<LowMemoryMode>('low_memory_mode');
  }

  setLowMemoryMode(enabled: boolean) {
    return this.call<LowMemoryMode>('set_low_memory_mode', { enabled });
  }

  engineSettings() {
    return this.call<EngineSettings>('engine_settings');
  }

  setEngineSettings(patch: EngineSettingsPatch) {
    return this.call<EngineSettings>('set_engine_settings', { patch });
  }

  /** The shell opens the folder dialog itself; the page never sends a path. */
  addModelRoot() {
    return this.call<EngineSettings | null>('add_model_root');
  }

  chooseDataDir(moveData: boolean) {
    return this.call<EngineSettings | null>('choose_data_dir', { moveData });
  }

  cancelDataDirChange() {
    return this.call<EngineSettings>('cancel_data_dir_change');
  }

  chooseComfyuiInstallDir() {
    return this.call<EngineSettings | null>('choose_comfyui_install_dir');
  }

  resetComfyuiInstallDir() {
    return this.call<EngineSettings>('reset_comfyui_install_dir');
  }

  removeModelRoot(index: number) {
    return this.call<EngineSettings>('remove_model_root', { index });
  }

  faceRigLibrary() {
    return this.call<FaceRigLibrary>('face_rig_library');
  }

  faceRigPreview(request: FaceRigPreviewRequest) {
    return this.call<FaceRigPreviewResult>('face_rig_preview', { request });
  }

  // Export for sharing and backups (the shell opens the native dialogs) -----

  /** The copies come back as one download (a picture, or a zip of several); the browser decides where it goes. */
  exportImages(names: string[], options: ExportOptions) {
    return perf.timed('export_images', async (): Promise<ExportResult> => {
      const response = await fetch(EXPORT_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ names, options }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message = (data as { error?: unknown } | null)?.error;
        throw new Error(typeof message === 'string' ? message : `export failed (${response.status})`);
      }
      const result = JSON.parse(response.headers.get(EXPORT_RESULT_HEADER) ?? 'null') as ExportResult | null;
      const fileName = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1];
      if (!result || !fileName) throw new Error('export failed: the answer has no file');
      downloadBlob(await response.blob(), fileName);
      return result;
    });
  }

  revealExportFolder() {
    return this.call<void>('reveal_export_folder');
  }

  watermarkStatus() {
    return this.call<WatermarkStatus>('watermark_status');
  }

  prepareWatermark() {
    return this.call<void>('prepare_watermark');
  }

  checkWatermarkFile() {
    return this.call<WatermarkCheck | null>('check_watermark_file');
  }

  checkWatermarkImage(name: string) {
    return this.call<WatermarkCheck>('check_watermark_image', { name });
  }

  createBackup(uiState: string) {
    return this.call<BackupSummary | null>('create_backup', { uiState });
  }

  openBackup() {
    return this.call<BackupInfo | null>('open_backup');
  }

  confirmRestore() {
    return this.call<void>('confirm_restore');
  }

  discardRestore() {
    return this.call<void>('discard_restore');
  }

  takeRestoredUiState() {
    return this.call<RestoreOutcome>('take_restored_ui_state');
  }

  listUnfinishedDownloads() {
    return this.call<UnfinishedDownload[]>('list_unfinished_downloads');
  }

  deleteUnfinishedDownloads(paths: string[]) {
    return this.call<UnfinishedDownload[]>('delete_unfinished_downloads', { paths });
  }
}
