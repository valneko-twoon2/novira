// Connects backend events to the stores and loads the initial data.
import { backend, perf } from '@/backend';
import { watchForMissedEvents } from './backendCatchUp';
import { useCanvas } from './canvas';
import { restoreAndWatchCanvas } from './canvasPersistence';
import { landPageInpaint } from './comic/pageInpaint';
import { restoreAndWatchComics } from './comic/persistence';
import { onComicImage, onComicQueueItem } from './comic/results';
import { useDevLog } from './devLog';
import { useEngine } from './engine';
import { useGallery } from './gallery';
import { markSummaries, watchGalleryDetails } from './galleryDetails';
import './liveStores';
import { useLowMemory } from './lowMemory';
import { offerPartsFor } from './modelParts';
import { useModels } from './models';
import { isOutOfMemory, reportOutOfMemory } from './outOfMemory';
import { mergeProgress, useQueue } from './queue';
import { applyStartTab, useSettings } from './settings';
import { showViewer, useUi } from './ui';
import { takeRestoredUiState } from './uiState';
import { useComfyNodes } from './comfy/comfyNodes';
import { useNodePacks } from './comfy/nodePacks';
import { useDownloads } from './downloads';
import { usePacks } from './media/packs';
import { useWorkflows } from './workflows/workflows';

let starting: Promise<void> | null = null;

/**
 * Starts the backend once. Every call returns the same promise, so a repeated call (StrictMode runs effects twice)
 * still waits until the initial data is in the stores instead of resolving straight away.
 */
export function startBackend(): Promise<void> {
  starting ??= start();
  return starting;
}

async function start(): Promise<void> {
  // After a restore the page reloads with the restored screen state; nothing else may write the storage before that.
  if (await takeRestoredUiState()) return new Promise<void>(() => undefined);
  applyStartTab();
  backend.setStepDelay(useSettings.getState().mockStepDelay);
  useSettings.subscribe((s) => backend.setStepDelay(s.mockStepDelay));

  backend.subscribe((event) => {
    const queue = useQueue.getState();
    switch (event.type) {
      case 'queue_item_status_changed': {
        const before = queue.items.find((i) => i.id === event.item.id);
        queue.upsertItem(event.item);
        if (isOutOfMemory(event.item) && before?.status !== 'failed') reportOutOfMemory(event.item);
        queue.setStatus(backend.queueStatus());
        if (event.item.status !== 'in_progress' && queue.progress?.itemId === event.item.id) queue.setProgress(null);
        onComicQueueItem(event.item);
        break;
      }
      case 'queue_cleared':
        queue.setItems(backend.listQueue());
        queue.setStatus(backend.queueStatus());
        queue.setProgress(null);
        break;
      case 'processor_state':
        queue.setStatus(backend.queueStatus());
        break;
      case 'invocation_progress':
        queue.setProgress(mergeProgress(queue.progress, event.progress));
        break;
      case 'image_added': {
        const { image, item } = event;
        const gallery = useGallery.getState();
        gallery.addImage(image);
        if (item) onComicImage(item, image);
        // Drafts live in the Drafts view; they do not move the gallery or the viewer.
        if (item?.params.draftAt !== undefined) break;
        // A helper result (a selection mask) is for the feature that asked; nothing else reacts to it.
        if (item?.destination === 'intermediate') break;
        if (item?.destination === 'canvas') {
          // A comic page's inpaint stays with the page that asked for it.
          if (landPageInpaint(item.id, image.name)) break;
          useCanvas.getState().addStagedImage(image.name, { fromQueue: true });
          break;
        }
        if (item && gallery.settings.autoSwitch) {
          const boardId = image.boardId ?? 'none';
          // Every queue result is a picture (category general), so it is listed under the images view.
          if (gallery.selectedBoardId !== boardId || gallery.view !== 'images') {
            useGallery.setState({ selectedBoardId: boardId, view: 'images', page: 0 });
          }
          gallery.setSelection([image.name]);
          if (useUi.getState().activeTab === item.origin) showViewer(item.origin);
        }
        break;
      }
      // Another page (or this one) changed what the backend keeps: every page shows it as the backend has it.
      case 'boards_changed':
        useGallery.getState().syncBoards(event.boards);
        break;
      case 'images_changed':
        useGallery.getState().applyImageChanges(event.images, event.removed);
        break;
      case 'models_changed':
        useModels.getState().syncModels(event.models);
        break;
      case 'workflows_changed':
        useWorkflows.getState().setLibrary(event.workflows);
        break;
      case 'model_install':
        useModels.getState().upsertInstallJob(event.job);
        break;
      case 'model_added':
        useModels.getState().upsertModel(event.model);
        // A model that loads in parts may lack its text encoders or VAE: offer to install them.
        void offerPartsFor(event.model);
        break;
      case 'engine_status': {
        const wasReady = useEngine.getState().status.state === 'ready';
        useEngine.getState().setStatus(event.status);
        // ComfyUI came back (a restart to load a pack, or a crash): what it can run may have changed, so the node
        // definitions read before are stale. Only when they were read at all; the features that need them read them.
        if (!wasReady && event.status.state === 'ready' && useComfyNodes.getState().status !== 'idle') void useComfyNodes.getState().load(true);
        break;
      }
      case 'pack':
        usePacks.getState().setPack(event.kind, event.status);
        useDownloads.getState().track({ key: `model:${event.kind}`, kind: 'model', pack: event.kind, status: event.status });
        break;
      case 'node_pack':
        useNodePacks.getState().setJob(event.url, event.status);
        useDownloads.getState().track({ key: `node:${event.url}`, kind: 'node', url: event.url, status: event.status });
        break;
      case 'log':
        useDevLog.getState().add(event.entry);
        break;
      // Read where they are waited for: the backup section, the assistant's open request (state/agent.ts) and the
      // page's saved state (state/uiStateSync.ts).
      case 'backup':
      case 'agent_tool_call':
      case 'ui_state_changed':
        break;
    }
  });

  const data = await backend.bootstrap();
  perf.mark('bootstrap-received');
  useModels.getState().setModels(data.models);
  useGallery.getState().setBoards(data.boards);
  // Marked before the gallery is set: what listens to the gallery reads the details of the pictures still marked as summaries.
  if (data.imagesSummary) markSummaries(data.images);
  useGallery.getState().setImages(data.images);
  if (data.imagesSummary) watchGalleryDetails();
  useWorkflows.getState().setLibrary(data.workflows);
  useEngine.getState().setStatus(data.engine);
  usePacks.getState().setAll(data.packs);
  // The jobs already there (another window or a phone may have queued them, or one is running): without them the
  // queue shows only what changes from now on.
  useQueue.getState().setItems(backend.listQueue());
  useQueue.getState().setStatus(backend.queueStatus());
  watchForMissedEvents();
  // After the gallery is in (layer pictures are looked up there) and after the backup-restore check above.
  await restoreAndWatchCanvas();
  await restoreAndWatchComics();
  perf.mark('stores-filled');
  // Read in the background: the out-of-memory notices and Settings need it, start-up does not wait for it.
  void useLowMemory.getState().load();
}
