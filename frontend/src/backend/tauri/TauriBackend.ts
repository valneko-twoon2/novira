// Backend client for the desktop app: forwards every call to the Rust commands over Tauri IPC
// (backend/src-tauri/src/commands.rs) and keeps a mirror of the queue so queueStatus()/listQueue() stay synchronous.
import { invoke as ipc, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { BackendClient } from '../client';
import { DEFAULT_WORKFLOWS } from '../defaultWorkflows';
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
  Packs,
  QueueItem,
  QueueStatus,
  RetrySize,
  RestoreOutcome,
  UnfinishedDownload,
  SavedWorkflow,
  ModelPartsReport,
  StarterModel,
} from '../types';

export const EVENT_CHANNEL = 'novira://event';

/** Every command goes through here, so its time is noted (../perf.ts). */
function invoke<T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
  return perf.timed(cmd, () => ipc<T>(cmd, args, options));
}
const UPLOAD_OPTIONS_HEADER = 'x-novira-options';
/** Image URLs served by the shell (Windows form first). */
const IMAGE_URL_PREFIXES = ['http://novira-image.localhost/', 'novira-image://localhost/'];

/** On the wire `queue_cleared` also carries the items that remain, so the mirror can resync. */
export type WireEvent =
  Exclude<BackendEvent, { type: 'queue_cleared' }> | { type: 'queue_cleared'; items: QueueItem[] };

export interface Bootstrap {
  models: ModelConfig[];
  boards: BoardDTO[];
  images: ImageDTO[];
  workflows: SavedWorkflow[];
  queue: { items: QueueItem[]; status: QueueStatus };
  engine: EngineStatus;
  packs: Packs;
}

type ImageOptions = {
  boardId: string | null;
  isIntermediate?: boolean;
  category?: ImageDTO['category'];
};

export function isBackendImageUrl(url: string): boolean {
  return IMAGE_URL_PREFIXES.some((p) => url.startsWith(p));
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class TauriBackend implements BackendClient {
  readonly kind = 'tauri' as const;
  private listeners = new Set<(e: BackendEvent) => void>();
  private queue: QueueItem[] = [];
  private paused = false;
  private readonly listening: Promise<unknown>;

  constructor() {
    this.listening = listen<WireEvent>(EVENT_CHANNEL, (e) => this.receive(e.payload));
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

  private upsert(item: QueueItem) {
    const i = this.queue.findIndex((q) => q.id === item.id);
    if (i < 0) this.queue.push({ ...item });
    else this.queue[i] = { ...item };
  }

  private async resyncQueue() {
    const snap = await invoke<Bootstrap['queue']>('queue_snapshot');
    this.queue = snap.items;
    this.paused = snap.status.isPaused;
  }

  subscribe(listener: (event: BackendEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setWindowTheme(theme: 'light' | 'dark'): void {
    getCurrentWindow()
      .setTheme(theme)
      .catch(() => undefined);
  }

  setStepDelay(): void {
    // Real generations have no artificial step delay.
  }

  async bootstrap() {
    await this.listening;
    const data = await invoke<Bootstrap>('bootstrap');
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
    return invoke<BoardDTO>('create_board', { name });
  }

  updateBoard(id: string, patch: Partial<Pick<BoardDTO, 'name' | 'archived'>>) {
    return invoke<BoardDTO>('update_board', { id, patch });
  }

  async deleteBoard(id: string, deleteImages: boolean) {
    const deletedImages = await invoke<string[]>('delete_board', { id, deleteImages });
    return { deletedImages };
  }

  // Images -----------------------------------------------------------------

  private async upload(
    blob: Blob,
    opts: ImageOptions & { category: ImageDTO['category'] },
  ): Promise<ImageDTO> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const options = {
      boardId: opts.boardId,
      isIntermediate: opts.isIntermediate ?? false,
      category: opts.category,
    };
    return invoke<ImageDTO>('upload_image', bytes, {
      headers: { [UPLOAD_OPTIONS_HEADER]: JSON.stringify(options) },
    });
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
    return invoke<ImageDTO[]>('update_images', { names, patch });
  }

  deleteImages(names: string[]) {
    return invoke<void>('delete_images', { names });
  }

  // Queue ------------------------------------------------------------------

  /** A picture rendered in the page (canvas flatten, mask, blob) stored as a hidden image the backend can read. */
  private async stored(url: string, category: ImageDTO['category']): Promise<string> {
    if (isBackendImageUrl(url)) return url;
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
    const items = await invoke<QueueItem[]>('enqueue', {
      request: { ...request, initImageUrl, maskImageUrl, controlLayers, regionalLayers, refImages, referencePictures, workflow: request.workflow ?? null },
    });
    if (request.prepend) await this.resyncQueue();
    else items.forEach((i) => this.upsert(i));
    return items;
  }

  cancelQueueItem(id: number) {
    return invoke<void>('cancel_queue_item', { id });
  }

  cancelBatch(batchId: string) {
    return invoke<void>('cancel_batch', { batchId });
  }

  clearQueue() {
    return invoke<void>('clear_queue');
  }

  pruneQueue() {
    return invoke<void>('prune_queue');
  }

  pauseProcessor() {
    return invoke<void>('pause_processor');
  }

  resumeProcessor() {
    return invoke<void>('resume_processor');
  }

  retryQueueItem(id: number, size?: RetrySize) {
    return invoke<QueueItem | null>('retry_queue_item', { id, size: size ?? null });
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
    return invoke<StarterModel[]>('list_starter_models');
  }

  modelParts(modelKey: string) {
    return invoke<ModelPartsReport>('model_parts', { modelKey });
  }

  installModel(source: string, name?: string) {
    return invoke<ModelInstallJob>('install_model', { source, name: name ?? null });
  }

  cancelInstall(jobId: string) {
    return invoke<void>('cancel_install', { jobId });
  }

  updateModel(key: string, patch: Partial<ModelConfig>) {
    return invoke<ModelConfig>('update_model', { key, patch });
  }

  deleteModel(key: string) {
    return invoke<void>('delete_model', { key });
  }

  scanFolder() {
    return invoke<{ path: string; installed: boolean }[] | null>('scan_folder');
  }

  listHuggingFaceFiles(repo: string) {
    return invoke<string[]>('list_hugging_face_files', { repo });
  }

  hardwareInfo() {
    return invoke<HardwareInfo>('hardware_info');
  }

  listFonts() {
    return invoke<string[]>('list_fonts');
  }

  async installPack(kind: PackKind) {
    await invoke('install_pack', { kind });
  }

  async cancelPack(kind: PackKind) {
    await invoke('cancel_pack', { kind });
  }

  hasHuggingFaceToken() {
    return invoke<boolean>('has_hf_token');
  }

  async setHuggingFaceToken(token: string | null) {
    await invoke('set_hf_token', { token });
  }

  async openHuggingFacePage(repo: string) {
    await invoke('open_huggingface_page', { repo });
  }

  async openSourcePage(url: string) {
    await invoke('open_source_page', { url });
  }

  hasCivitaiKey() {
    return invoke<boolean>('has_civitai_key');
  }

  async setCivitaiKey(key: string | null) {
    await invoke('set_civitai_key', { key });
  }

  async setUiZoom(scale: number) {
    await invoke('set_ui_zoom', { scale });
  }

  async openCivitaiPage(modelId: string) {
    await invoke('open_civitai_page', { modelId });
  }

  searchCivitai(params: CivitaiSearchParams) {
    return invoke<CivitaiSearchResult>('search_civitai', {
      params: { ...params, cursor: params.cursor ?? null },
    });
  }

  // AI assistant ------------------------------------------------------------

  agentStatus() {
    return invoke<AgentStatus>('agent_status');
  }

  agentLogin(provider: AgentProvider) {
    return invoke<AgentStatus>('agent_login', { provider });
  }

  agentEndpointSave(input: AgentEndpointInput) {
    return invoke<AgentStatus>('agent_endpoint_save', { input });
  }

  agentEndpointModels(input: AgentEndpointInput) {
    return invoke<string[]>('agent_endpoint_models', { input });
  }

  agentEndpointTest(input: AgentEndpointInput) {
    return invoke<AgentEndpointTest>('agent_endpoint_test', { input });
  }

  agentChat(request: AgentRequest) {
    return invoke<AgentReply>('agent_chat', { request });
  }

  async agentToolResult(answer: AgentToolAnswer) {
    await invoke('agent_tool_result', { answer });
  }

  lookupReference(language: ReferenceLanguage, query: string) {
    return invoke<ReferenceHit[]>('lookup_reference', { language, query });
  }

  async agentCancel() {
    await invoke('agent_cancel');
  }

  // Workflows --------------------------------------------------------------

  saveWorkflow(workflow: Omit<SavedWorkflow, 'id' | 'updatedAt' | 'category'> & { id?: string }) {
    return invoke<SavedWorkflow>('save_workflow', { workflow });
  }

  deleteWorkflow(id: string) {
    return invoke<void>('delete_workflow', { id });
  }

  // Comics -----------------------------------------------------------------

  listComics() {
    return invoke<ComicRecord[]>('list_comics');
  }

  saveComic(id: string, document: unknown) {
    return invoke<void>('save_comic', { id, document });
  }

  deleteComic(id: string) {
    return invoke<void>('delete_comic', { id });
  }

  // Canvas -----------------------------------------------------------------

  loadCanvas() {
    return invoke<string | null>('load_canvas');
  }

  saveCanvas(document: string) {
    return invoke<void>('save_canvas', { document });
  }

  // Screen state -----------------------------------------------------------

  adoptUiState(local: string | null) {
    return invoke<string | null>('adopt_ui_state', { local });
  }

  saveUiState(state: string, origin?: string) {
    return invoke<void>('save_ui_state', { state, origin });
  }

  nodeDefs() {
    return invoke<ComfyNodeDefs>('node_defs');
  }

  comfyUiLocale(locale: string) {
    return invoke<ComfyUiLocale | null>('comfy_ui_locale', { locale });
  }

  nodePacks() {
    return invoke<NodePacks>('node_packs');
  }

  installNodePack(url: string, version?: string) {
    return invoke<void>('install_node_pack', { url, version: version ?? null });
  }

  nodePackVersions(url: string) {
    return invoke<string[]>('node_pack_versions', { url });
  }

  nodePackInfo(url: string) {
    return invoke<NodePackInfo>('node_pack_info', { url });
  }

  registryNodes(refresh: boolean) {
    return invoke<RegistryNode[]>('registry_nodes', { refresh });
  }

  comfyVersions() {
    return invoke<string[]>('comfy_versions');
  }

  switchComfyVersion(version: string) {
    return invoke<string[]>('switch_comfy_version', { version });
  }

  cancelNodePack(url: string) {
    return invoke<void>('cancel_node_pack', { url });
  }

  removeNodePack(folder: string) {
    return invoke<NodePacks>('remove_node_pack', { folder });
  }

  restartEngine() {
    return invoke<NodePacks>('restart_engine');
  }

  lowMemoryMode() {
    return invoke<LowMemoryMode>('low_memory_mode');
  }

  setLowMemoryMode(enabled: boolean) {
    return invoke<LowMemoryMode>('set_low_memory_mode', { enabled });
  }

  engineSettings() {
    return invoke<EngineSettings>('engine_settings');
  }

  setEngineSettings(patch: EngineSettingsPatch) {
    return invoke<EngineSettings>('set_engine_settings', { patch });
  }

  /** The shell opens the folder dialog itself; the page never sends a path. */
  addModelRoot() {
    return invoke<EngineSettings | null>('add_model_root');
  }

  removeModelRoot(index: number) {
    return invoke<EngineSettings>('remove_model_root', { index });
  }

  faceRigLibrary() {
    return invoke<FaceRigLibrary>('face_rig_library');
  }

  faceRigPreview(request: FaceRigPreviewRequest) {
    return invoke<FaceRigPreviewResult>('face_rig_preview', { request });
  }

  // Export for sharing and backups (the shell opens the native dialogs) -----

  exportImages(names: string[], options: ExportOptions) {
    return invoke<ExportResult | null>('export_images', { names, options });
  }

  revealExportFolder() {
    return invoke<void>('reveal_export_folder');
  }

  watermarkStatus() {
    return invoke<WatermarkStatus>('watermark_status');
  }

  prepareWatermark() {
    return invoke<void>('prepare_watermark');
  }

  checkWatermarkFile() {
    return invoke<WatermarkCheck | null>('check_watermark_file');
  }

  checkWatermarkImage(name: string) {
    return invoke<WatermarkCheck>('check_watermark_image', { name });
  }

  createBackup(uiState: string) {
    return invoke<BackupSummary | null>('create_backup', { uiState });
  }

  openBackup() {
    return invoke<BackupInfo | null>('open_backup');
  }

  confirmRestore() {
    return invoke<void>('confirm_restore');
  }

  discardRestore() {
    return invoke<void>('discard_restore');
  }

  takeRestoredUiState() {
    return invoke<RestoreOutcome>('take_restored_ui_state');
  }

  listUnfinishedDownloads() {
    return invoke<UnfinishedDownload[]>('list_unfinished_downloads');
  }

  deleteUnfinishedDownloads(paths: string[]) {
    return invoke<UnfinishedDownload[]>('delete_unfinished_downloads', { paths });
  }
}
