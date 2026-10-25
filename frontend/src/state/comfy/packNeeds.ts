// What a feature that needs a custom node pack shows while the pack is missing: whether it is installed (and only
// waits for ComfyUI to restart), the install in progress, and the actions. `id` is a catalog id (see packCatalog.ts).
import type { ClipVisionModel, ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { PACK_CATALOG, packFolder } from './packCatalog';
import { packKey, useNodePacks, type NodePacksState } from './nodePacks';

/** Reference images (IP-Adapter) run on the nodes of this pack. */
export const IPADAPTER_PACK = 'ipadapter';

/** The manga finish runs on the nodes of this pack. */
export const MANGASCREEN_PACK = 'mangascreen';

function isInstalled(installed: { folder: string; url: string | null }[] | undefined, url: string): boolean {
  return !!installed?.some((i) => i.url === packKey(url) || i.folder === packFolder(url));
}

/** The folder name of a catalog pack, for messages. */
export function catalogPackName(id: string): string {
  return packFolder(PACK_CATALOG.find((p) => p.id === id)?.url ?? id);
}

/**
 * Whether a catalog pack is known to be missing: the pack list is loaded, novira manages the packs, and the pack is
 * not in it. While the list is unknown the pack counts as present (the backend checks again before running a job).
 */
export function packMissing(id: string, state: Pick<NodePacksState, 'packs'> = useNodePacks.getState()): boolean {
  const url = PACK_CATALOG.find((p) => p.id === id)?.url;
  const packs = state.packs;
  if (!url || !packs || !packs.available) return false;
  return !isInstalled(packs.installed, url);
}

/** Why enabled reference images cannot run yet: their node pack is known to be missing (null otherwise). */
export function refImagesPackReason(refImages: { isEnabled: boolean }[], state?: Pick<NodePacksState, 'packs'>): string | null {
  if (!refImages.some((r) => r.isEnabled) || !packMissing(IPADAPTER_PACK, state)) return null;
  return t('params.readiness.refNeedsPack', { pack: catalogPackName(IPADAPTER_PACK) });
}

/**
 * The size of the image encoder a CLIP vision model file is, read from its file name as the backend reads it first
 * (guidance.rs). Null when the name does not say: the backend then looks inside the file, which this cannot.
 */
export function clipVisionSizeByName(path: string): ClipVisionModel | null {
  const name = (path.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/_/g, '-');
  if (name.includes('bigg') || name.includes('vit-g')) return 'ViT-G';
  if (name.includes('vit-h')) return 'ViT-H';
  if (name.includes('vit-l')) return 'ViT-L';
  return null;
}

/**
 * Whether the image encoder (CLIP vision model) of a size is known to be missing. It is certain only when no encoder is
 * installed, or every installed one says its size in its name and none is the wanted size; an encoder whose name does
 * not say is left to the backend, which checks again before running a job.
 */
export function encoderMissing(wanted: ClipVisionModel, models: Pick<ModelConfig, 'type' | 'path'>[]): boolean {
  const encoders = models.filter((m) => m.type === 'clip_vision').map((m) => clipVisionSizeByName(m.path));
  return !encoders.includes(wanted) && !encoders.includes(null);
}

/** Why enabled reference images cannot run yet: the image encoder they need is known to be missing (null otherwise). */
export function refImagesEncoderReason(refImages: { isEnabled: boolean; clipVisionModel: ClipVisionModel }[], models: Pick<ModelConfig, 'type' | 'path'>[]): string | null {
  for (const wanted of new Set(refImages.filter((r) => r.isEnabled).map((r) => r.clipVisionModel))) {
    if (encoderMissing(wanted, models)) return t('params.readiness.refNeedsEncoder', { size: wanted });
  }
  return null;
}

export function usePackNeeds(id: string) {
  const target = PACK_CATALOG.find((p) => p.id === id);
  const installed = useNodePacks((s) => s.packs?.installed);
  const jobs = useNodePacks((s) => s.jobs);
  const install = useNodePacks((s) => s.install);
  const restart = useNodePacks((s) => s.restart);
  const restarting = useNodePacks((s) => s.restarting);
  const url = target?.url ?? '';
  const job = jobs[packKey(url)];
  return {
    /** The pack's folder name, for messages. */
    name: packFolder(url),
    /** Installed in ComfyUI's folder (it may still need a restart to load). */
    has: isInstalled(installed, url),
    busy: job?.state === 'downloading' || job?.state === 'installing',
    error: job?.state === 'error' ? job.message : null,
    restarting,
    install: () => void install(url),
    restart: () => void restart(),
  };
}
