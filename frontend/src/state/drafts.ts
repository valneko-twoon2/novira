// Draft sessions: one batch of candidates (same settings, different seeds) drawn only part of the way, so the
// user can pick the promising ones and have only those drawn to the end. The queue holds the real work; this store
// remembers which queue items belong to which candidate and what the user decided.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { backend, draftStep, type EnqueueRequest, type GenerationMetadata, type ModelConfig, type QueueItem, type RefImageInput } from '@/backend';
import { buildRequestFor } from './invoke';
import { BASE_ORDER, drawableModels, findModel } from './models';
import { useQueue } from './queue';

export type Verdict = 'keep' | 'reject' | null;
export type DraftStatus = 'queued' | 'running' | 'ready' | 'failed';

export interface DraftCandidate {
  id: string;
  seed: number;
  /** Queue item that draws the draft. */
  itemId: number | null;
  imageName: string | null;
  status: DraftStatus;
  error: string | null;
  /** Queue item that draws the finished image from the same seed. */
  finalItemId: number | null;
  finalImageName: string | null;
  finalStatus: DraftStatus | null;
  verdict: Verdict;
}

export interface DraftGroup {
  id: string;
  createdAt: number;
  /** Settings of the batch without the draft position. */
  params: GenerationMetadata;
  /** Reference images of the batch (as many as `params.refImageCount`), sent again when a draft is finished. */
  refImages?: RefImageInput[];
  boardId: string | null;
  /** Fraction of the steps the drafts are drawn to. */
  position: number;
  candidates: DraftCandidate[];
}

export const POSITION_MIN = 0.25;
export const POSITION_MAX = 0.6;
export const POSITION_DEFAULT = 0.35;

/** The file name of a model, lower case: what the backend reads a model's variant from (`classify::detect_variant`). */
const fileNameOf = (m: ModelConfig) => ((m.path || m.name).split(/[\\/]/).pop() ?? '').toLowerCase();

/**
 * Why a model the Generate tab draws with cannot make drafts, or null when it can. The edit models (Flux Fill, Flux
 * Kontext, Qwen-Image-Edit) only change a source picture, and a draft is drawn from text. The backend tells them apart
 * by the same words in the file name (Fill also by its tensors, so it refuses one this misses).
 */
export function draftRefusal(m: ModelConfig): 'edit' | null {
  const name = fileNameOf(m);
  if (m.base === 'flux' && (name.includes('kontext') || name.includes('fill'))) return 'edit';
  if (m.base === 'qwen-image' && name.includes('edit')) return 'edit';
  return null;
}

/** The models the Drafts view offers: those the Generate tab draws with (diffusion models of the newer families too), less the ones that cannot draft. */
export function draftModels(models: ModelConfig[]): ModelConfig[] {
  return drawableModels(models)
    .filter((m) => draftRefusal(m) === null)
    .sort((a, b) => BASE_ORDER.indexOf(a.base) - BASE_ORDER.indexOf(b.base) || a.name.localeCompare(b.name));
}

/** The models the Generate tab draws with that the Drafts view leaves out. */
export function modelsWithoutDrafts(models: ModelConfig[]): ModelConfig[] {
  return drawableModels(models).filter((m) => draftRefusal(m) !== null);
}

export const draftStepOf = (group: Pick<DraftGroup, 'params' | 'position'>) => draftStep(group.params.steps, group.position);

function statusOf(item: QueueItem | undefined, hasImage: boolean): DraftStatus {
  if (!item) return hasImage ? 'ready' : 'failed';
  if (item.status === 'pending') return 'queued';
  if (item.status === 'in_progress') return 'running';
  if (item.status === 'completed') return 'ready';
  return 'failed';
}

/** Applies the queue's view of each candidate's items to the groups; returns the same array when nothing changed. */
export function syncGroups(groups: DraftGroup[], items: QueueItem[]): DraftGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  let changed = false;
  const next = groups.map((g) => {
    let groupChanged = false;
    const candidates = g.candidates.map((c) => {
      const draft = c.itemId === null ? undefined : byId.get(c.itemId);
      const final = c.finalItemId === null ? undefined : byId.get(c.finalItemId);
      const imageName = draft?.imageName ?? c.imageName;
      const finalImageName = final?.imageName ?? c.finalImageName;
      const status = c.itemId === null ? c.status : statusOf(draft, !!imageName);
      const finalStatus = c.finalItemId === null ? null : statusOf(final, !!finalImageName);
      const error = draft?.error ?? (status === 'failed' ? c.error : null);
      const same = status === c.status && finalStatus === c.finalStatus && imageName === c.imageName && finalImageName === c.finalImageName && error === c.error;
      if (same) return c;
      groupChanged = true;
      return { ...c, status, finalStatus, imageName, finalImageName, error };
    });
    if (!groupChanged) return g;
    changed = true;
    return { ...g, candidates };
  });
  return changed ? next : groups;
}

interface DraftsState {
  groups: DraftGroup[];
  currentId: string | null;
  /** Selected candidate ids of the current group. */
  selection: string[];
  busy: boolean;
  setCurrent: (id: string) => void;
  toggleSelect: (candidateId: string) => void;
  clearSelection: () => void;
  mark: (groupId: string, candidateId: string, verdict: Verdict) => void;
  closeGroup: (id: string) => void;
  sync: (items: QueueItem[]) => void;
  /** Starts a batch from the Generate tab's current settings, with another main model when `modelKey` is given. Resolves with a reason when it cannot start. */
  start: (count: number, position: number, modelKey?: string | null) => Promise<{ error: 'no-builder' | 'not-txt2img' | 'edit-model' } | null>;
  /** Draws the given candidates to the end. */
  finish: (groupId: string, candidateIds: string[]) => Promise<void>;
  /** Runs the failed drafts again with the same seeds. */
  retryFailed: (groupId: string) => Promise<void>;
}

/** The settings of a draft drawn again: the group's settings stopping at its position, without the second pass. */
function draftOf(params: GenerationMetadata, seed: number, position: number): GenerationMetadata {
  const draft: GenerationMetadata = { ...params, seed, draftAt: position };
  delete draft.hiresFix;
  delete draft.mangaScreen;
  return draft;
}

/** The settings with another main model. Settings tied to the old model's family (VAE, LoRAs) are dropped, and the new
 * model's own defaults replace the sampling settings, so the draft is not drawn with values meant for another family. */
export function withModel(params: GenerationMetadata, modelKey: string | null | undefined): GenerationMetadata {
  const next = modelKey && modelKey !== params.modelKey ? findModel(modelKey) : undefined;
  if (!next) return params;
  const swapped: GenerationMetadata = { ...params, modelKey: next.key, modelName: next.name };
  const previous = findModel(params.modelKey);
  if (previous && previous.base === next.base) return swapped;
  const d = next.defaultSettings;
  return {
    ...swapped,
    vaeKey: null,
    loras: [],
    ...(d?.steps !== undefined ? { steps: d.steps } : {}),
    ...(d?.cfgScale !== undefined ? { cfgScale: d.cfgScale } : {}),
    ...(d?.scheduler !== undefined ? { scheduler: d.scheduler } : {}),
    ...(d?.width !== undefined && d?.height !== undefined ? { width: d.width, height: d.height } : {}),
  };
}

let counter = 1;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export const useDrafts = create<DraftsState>()(
  persist(
    (set, get) => ({
      groups: [],
      currentId: null,
      selection: [],
      busy: false,
      setCurrent: (id) => set({ currentId: id, selection: [] }),
      toggleSelect: (cid) => set({ selection: get().selection.includes(cid) ? get().selection.filter((s) => s !== cid) : [...get().selection, cid] }),
      clearSelection: () => set({ selection: [] }),
      mark: (groupId, candidateId, verdict) =>
        set({
          groups: get().groups.map((g) =>
            g.id === groupId ? { ...g, candidates: g.candidates.map((c) => (c.id === candidateId ? { ...c, verdict: c.verdict === verdict ? null : verdict } : c)) } : g,
          ),
        }),
      closeGroup: (id) => {
        const groups = get().groups.filter((g) => g.id !== id);
        const wasCurrent = get().currentId === id;
        set({ groups, currentId: wasCurrent ? (groups[groups.length - 1]?.id ?? null) : get().currentId, selection: wasCurrent ? [] : get().selection });
      },
      sync: (items) => {
        const groups = syncGroups(get().groups, items);
        if (groups !== get().groups) set({ groups });
      },
      start: async (count, position, modelKey) => {
        const built = buildRequestFor('generate');
        if (!built) return { error: 'no-builder' };
        set({ busy: true });
        try {
          const request = await built;
          if (request.params.generationMode !== 'txt2img') return { error: 'not-txt2img' };
          const model = findModel(withModel(request.params, modelKey).modelKey);
          if (model && draftRefusal(model)) return { error: 'edit-model' };
          // A draft stops early and is never enlarged; the finished picture gets the high-resolution fix again.
          const draftParams: GenerationMetadata = { ...withModel(request.params, modelKey), draftAt: position };
          delete draftParams.hiresFix;
          delete draftParams.mangaScreen;
          const draft: EnqueueRequest = {
            ...request,
            params: draftParams,
            iterations: count,
            randomizeSeed: true,
            prepend: false,
            destination: 'gallery',
          };
          const items = await backend.enqueue(draft);
          const params: GenerationMetadata = { ...withModel(request.params, modelKey) };
          const group: DraftGroup = {
            id: uid(),
            createdAt: Date.now(),
            params,
            ...(request.refImages?.length ? { refImages: request.refImages } : {}),
            boardId: request.boardId,
            position,
            candidates: items.map((it, i) => ({
              id: `${uid()}-${i}`,
              seed: it.params.seed,
              itemId: it.id,
              imageName: null,
              status: 'queued',
              error: null,
              finalItemId: null,
              finalImageName: null,
              finalStatus: null,
              verdict: null,
            })),
          };
          set({ groups: [...get().groups, group], currentId: group.id, selection: [] });
          return null;
        } finally {
          set({ busy: false });
        }
      },
      finish: async (groupId, candidateIds) => {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return;
        set({ busy: true });
        try {
          const started = new Map<string, number>();
          for (const cid of candidateIds) {
            const c = group.candidates.find((x) => x.id === cid);
            if (!c || c.finalItemId !== null) continue;
            const [item] = await backend.enqueue({
              origin: 'generate',
              destination: 'gallery',
              params: { ...group.params, seed: c.seed },
              ...(group.refImages ? { refImages: group.refImages } : {}),
              iterations: 1,
              randomizeSeed: false,
              prepend: false,
              boardId: group.boardId,
            });
            if (item) started.set(cid, item.id);
          }
          set({
            groups: get().groups.map((g) =>
              g.id !== groupId
                ? g
                : { ...g, candidates: g.candidates.map((c) => (started.has(c.id) ? { ...c, finalItemId: started.get(c.id)!, finalStatus: 'queued' as const } : c)) },
            ),
            selection: get().selection.filter((s) => !started.has(s)),
          });
        } finally {
          set({ busy: false });
        }
      },
      retryFailed: async (groupId) => {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return;
        set({ busy: true });
        try {
          const restarted = new Map<string, number>();
          for (const c of group.candidates.filter((x) => x.status === 'failed')) {
            const [item] = await backend.enqueue({
              origin: 'generate',
              destination: 'gallery',
              params: draftOf(group.params, c.seed, group.position),
              ...(group.refImages ? { refImages: group.refImages } : {}),
              iterations: 1,
              randomizeSeed: false,
              prepend: false,
              boardId: group.boardId,
            });
            if (item) restarted.set(c.id, item.id);
          }
          set({
            groups: get().groups.map((g) =>
              g.id !== groupId
                ? g
                : {
                    ...g,
                    candidates: g.candidates.map((c) =>
                      restarted.has(c.id) ? { ...c, itemId: restarted.get(c.id)!, status: 'queued' as const, error: null, imageName: null } : c,
                    ),
                  },
            ),
          });
        } finally {
          set({ busy: false });
        }
      },
    }),
    {
      name: 'novira.drafts',
      version: 1,
      partialize: (s) => ({ groups: s.groups, currentId: s.currentId }),
    },
  ),
);

// Keep the candidates in step with the queue.
useQueue.subscribe((s, prev) => {
  if (s.items !== prev.items) useDrafts.getState().sync(s.items);
});
