// Candidate sessions. A draft batch is candidates (same settings, different seeds) drawn only part of the way, so the
// user can pick the promising ones and have only those drawn to the end. A generation batch is what one press of Invoke
// made, kept out of the boards until the user moves the pictures they want there. The queue holds the real work; this
// store remembers which queue items belong to which candidate and what the user decided.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { backend, draftStep, type EnqueueRequest, type GenerationMetadata, type ImageDTO, type ModelConfig, type QueueItem, type RefImageInput } from '@/backend';
import { t, tCount } from '@/i18n';
import { boardLabel } from './boardTree';
import { buildRequestFor } from './invoke';
import { useGallery } from './gallery';
import { ensureAllDetails, ensureDetails, isSummary, summaryCount } from './galleryDetails';
import { recordDeletion, undoDeletion } from './galleryUndo';
import { BASE_ORDER, drawableModels, findModel } from './models';
import { useQueue } from './queue';
import { toast } from './toasts';

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
  /**
   * `generation`: what one press of Invoke made, every candidate a picture drawn to the end (its `finalItemId`; there is no
   * draft step). Absent: a batch of drafts.
   */
  kind?: 'generation';
  createdAt: number;
  /** Settings of the batch without the draft position. */
  params: GenerationMetadata;
  /** Reference images of the batch (as many as `params.refImageCount`), sent again when a draft is finished. */
  refImages?: RefImageInput[];
  /** The stored picture image to image draws over, sent again when a draft is finished. */
  initImageUrl?: string;
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
 * Kontext, Qwen-Image-Edit) take a source picture through their own conditioning, which a draft does not stop early. The backend tells them apart
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

/**
 * Whether a candidate can be drawn to the end (again). A candidate whose finished picture was cancelled, failed or was
 * deleted from the gallery is offered again: the draft stays good, since drawing the finished picture starts from the seed.
 * Only one whose finished picture is being drawn, or exists, waits.
 */
export function canFinish(c: DraftCandidate, finalPictureExists: boolean): boolean {
  if (c.status !== 'ready') return false;
  if (c.finalItemId === null || c.finalStatus === 'failed') return true;
  return c.finalStatus === 'ready' && !finalPictureExists;
}

export const draftStepOf = (group: Pick<DraftGroup, 'params' | 'position'>) => draftStep(group.params.steps, group.position);

function statusOf(item: QueueItem | undefined, hasImage: boolean): DraftStatus {
  if (!item) return hasImage ? 'ready' : 'failed';
  if (item.status === 'pending') return 'queued';
  if (item.status === 'in_progress') return 'running';
  if (item.status === 'completed') return 'ready';
  return 'failed';
}

/** How long before a group's own clock its items may have been made (the batch is queued, then the group is stored). */
const ITEM_BEFORE_GROUP_MS = 60_000;

/**
 * Whether a queue item is the one a candidate asked for. Items are named by id, and an id that was given before (the
 * queue was cleared, older versions restarted the numbers) can belong to an unrelated job now: its picture would then
 * replace the candidate's. The seed, the draft position and the time tell them apart.
 */
export function isItemOf(item: QueueItem | undefined, group: DraftGroup, candidate: DraftCandidate, kind: 'draft' | 'final'): item is QueueItem {
  if (!item) return false;
  if (item.params.seed !== candidate.seed || item.createdAt < group.createdAt - ITEM_BEFORE_GROUP_MS) return false;
  return kind === 'draft' ? item.params.draftAt !== undefined : item.params.draftAt === undefined;
}

/**
 * The groups with the queue as it is now. A batch is made after the enqueue call returns, and an idle queue has started the
 * job by then: its change to "in progress" came before the batch knew the item, and the queue does not change again until
 * the picture is done, so without this the picture would show as waiting all the while it is drawn.
 */
function withQueue(groups: DraftGroup[]): DraftGroup[] {
  return syncGroups(groups, useQueue.getState().items, { keepUnknown: true });
}

/**
 * Applies the queue's view of each candidate's items to the groups; returns the same array when nothing changed. An item the
 * queue does not hold is gone (failed, or done when its picture is known), unless `keepUnknown`: then the queue may not have
 * heard of it yet, and the candidate keeps its state.
 */
export function syncGroups(groups: DraftGroup[], items: QueueItem[], { keepUnknown = false } = {}): DraftGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  let changed = false;
  const next = groups.map((g) => {
    let groupChanged = false;
    const candidates = g.candidates.map((c) => {
      const found = c.itemId === null ? undefined : byId.get(c.itemId);
      const foundFinal = c.finalItemId === null ? undefined : byId.get(c.finalItemId);
      // An id that now names another job is as good as gone: the candidate keeps what it had.
      const draft = isItemOf(found, g, c, 'draft') ? found : undefined;
      const final = isItemOf(foundFinal, g, c, 'final') ? foundFinal : undefined;
      const imageName = draft?.imageName ?? c.imageName;
      const finalImageName = final?.imageName ?? c.finalImageName;
      const status = c.itemId === null || (keepUnknown && !found) ? c.status : statusOf(draft, !!imageName);
      const finalStatus = c.finalItemId === null ? null : keepUnknown && !foundFinal ? c.finalStatus : statusOf(final, !!finalImageName);
      const error = draft?.error ?? (status === 'failed' ? c.error : (final?.error ?? (finalStatus === 'failed' ? c.error : null)));
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

/** Whether a stored picture is the one a candidate drew: its own seed, draft or finished, and made after its batch was started. */
function pictureIsOf(image: ImageDTO, group: DraftGroup, candidate: DraftCandidate, kind: 'draft' | 'final'): boolean {
  const m = image.metadata;
  if (!m || m.seed !== candidate.seed || image.createdAt < group.createdAt - ITEM_BEFORE_GROUP_MS) return false;
  return kind === 'draft' ? m.draftAt !== undefined : m.draftAt === undefined;
}

/**
 * Mends batches that took another job's picture (the queue numbers were given twice, see `isItemOf`). A picture that is
 * not the candidate's is replaced by the candidate's own one found in the gallery by seed, prompt, model and time, or let go
 * when there is none, so the candidate shows nothing (a finished picture can be drawn again) instead of a stranger's.
 * Returns the same array when every picture is right.
 */
export function repairGroups(groups: DraftGroup[], images: ImageDTO[]): DraftGroup[] {
  const byName = new Map(images.map((i) => [i.name, i]));
  let changed = false;
  const next = groups.map((g) => {
    let groupChanged = false;
    const own = (c: DraftCandidate, kind: 'draft' | 'final') =>
      images
        .filter((i) => pictureIsOf(i, g, c, kind) && i.metadata?.positivePrompt === g.params.positivePrompt && i.metadata?.modelKey === g.params.modelKey)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
    const candidates = g.candidates.map((c) => {
      let out = c;
      // A picture whose settings are not known yet (not read from the backend) cannot be judged, so it is left as it is.
      const draft = c.imageName ? byName.get(c.imageName) : undefined;
      if (draft?.metadata && !pictureIsOf(draft, g, c, 'draft')) {
        const found = own(c, 'draft');
        out = found ? { ...out, imageName: found.name } : { ...out, imageName: null, status: 'failed', error: null };
      }
      const final = c.finalImageName ? byName.get(c.finalImageName) : undefined;
      if (final?.metadata && !pictureIsOf(final, g, c, 'final')) {
        const found = own(c, 'final');
        out = found ? { ...out, finalImageName: found.name } : { ...out, finalImageName: null, finalItemId: null, finalStatus: null };
      }
      if (out !== c) groupChanged = true;
      return out;
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
  /** Whether the batches stored by an older version were checked for another job's pictures (`repairGroups`). */
  picturesRepaired: boolean;
  /** Selected candidate ids of the current group. */
  selection: string[];
  /** The candidate the large view shows; null shows the list. Kept here, not in the view, so switching to the viewer and
   * back finds it open again (the view is unmounted meanwhile). Not stored on disk. */
  viewing: string | null;
  busy: boolean;
  setViewing: (candidateId: string | null) => void;
  setCurrent: (id: string) => void;
  toggleSelect: (candidateId: string) => void;
  /** Replaces the selection (a click, or a Shift click over a range of the Candidates view). */
  setSelection: (candidateIds: string[]) => void;
  clearSelection: () => void;
  mark: (groupId: string, candidateId: string, verdict: Verdict) => void;
  closeGroup: (id: string) => void;
  /** Closes several groups at once (the older ones of the history). */
  closeGroups: (ids: string[]) => void;
  /**
   * Throws the chosen candidates of a group away: what they still wait for or draw is cancelled, the pictures a generation
   * batch holds back go to the trash (as `closeGroup` does with the rest), and they leave the group; a group left empty closes.
   */
  discard: (groupId: string, candidateIds: string[]) => void;
  sync: (items: QueueItem[]) => void;
  /** Starts a batch from the Generate tab's current settings, with another main model when `modelKey` is given. Resolves with a reason when it cannot start. */
  start: (count: number, position: number, modelKey?: string | null) => Promise<{ error: 'no-builder' | 'edit-model' } | null>;
  /** Draws the given candidates to the end. */
  finish: (groupId: string, candidateIds: string[]) => Promise<void>;
  /** Runs the failed drafts again with the same seeds. */
  retryFailed: (groupId: string) => Promise<void>;
  /** Keeps what one press of Invoke queued (to the `candidates` destination) as a batch of its own, with the pictures it makes. */
  addGeneration: (items: QueueItem[], request: EnqueueRequest) => void;
  /** Moves the chosen finished pictures of a generation batch to the board selected in the gallery now (Uncategorized when none is), and out of the batch. */
  adopt: (groupId: string, candidateIds: string[]) => Promise<void>;
}

/** The pictures of a generation batch that are still held back: not moved to a board, not deleted. */
export function heldPictures(group: DraftGroup, images: ImageDTO[]): ImageDTO[] {
  const names = new Set(group.candidates.map((c) => c.finalImageName).filter((n): n is string => n !== null));
  return images.filter((i) => names.has(i.name) && i.isIntermediate);
}

/**
 * Lets go of the candidates of generation batches whose finished picture was taken to a board some other way (dragged onto a
 * board, moved from the gallery): the picture is in the gallery now, so it is no longer held back. A picture the gallery does
 * not know yet stays. A batch left empty closes. Returns the same array when nothing changed. Pure.
 */
export function dropAdopted(groups: DraftGroup[], images: ImageDTO[]): DraftGroup[] {
  const shown = new Set(images.filter((i) => !i.isIntermediate).map((i) => i.name));
  let changed = false;
  const next = groups.flatMap((g) => {
    if (g.kind !== 'generation') return [g];
    const rest = g.candidates.filter((c) => c.finalImageName === null || !shown.has(c.finalImageName));
    if (rest.length === g.candidates.length) return [g];
    changed = true;
    return rest.length ? [{ ...g, candidates: rest }] : [];
  });
  return changed ? next : groups;
}

/** The board adopted pictures go to: the one selected in the gallery now, or Uncategorized when none is (or the selected one is gone). */
function selectedBoard(): string | null {
  const { selectedBoardId, boards } = useGallery.getState();
  return selectedBoardId !== 'none' && boards.some((b) => b.id === selectedBoardId) ? selectedBoardId : null;
}

const waiting = (status: DraftStatus | null) => status === 'queued' || status === 'running';

/**
 * Stops what the candidates (all of the group when none are given) still wait for or draw, and trashes the pictures a
 * generation batch holds back for them; they can be taken back from the toast. A batch of drafts keeps its pictures, as
 * closing it does.
 */
async function throwAway(group: DraftGroup, candidates: DraftCandidate[] = group.candidates): Promise<void> {
  try {
    for (const c of candidates) {
      if (c.finalItemId !== null && waiting(c.finalStatus)) await backend.cancelQueueItem(c.finalItemId).catch(() => undefined);
      if (group.kind !== 'generation' && c.itemId !== null && waiting(c.status)) await backend.cancelQueueItem(c.itemId).catch(() => undefined);
    }
    if (group.kind !== 'generation') return;
    const names = heldPictures({ ...group, candidates }, useGallery.getState().images).map((i) => i.name);
    if (!names.length) return;
    // Visible again before they go to the trash, so taking them back brings them to their board and not to a hidden place.
    await backend.updateImages(names, { isIntermediate: false });
    await backend.deleteImages(names);
    useGallery.getState().removeImages(names);
    recordDeletion(names);
    toast({ status: 'success', quiet: true, title: tCount('gallery.toast.deleted', names.length), actions: [{ label: t('gallery.undoDelete.action'), run: () => void undoDeletion(names) }] });
  } catch (err) {
    toast({ status: 'error', title: t('drafts.discardFailed'), description: err instanceof Error ? err.message : String(err) });
  }
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
      picturesRepaired: false,
      selection: [],
      viewing: null,
      busy: false,
      setViewing: (viewing) => set({ viewing }),
      setCurrent: (id) => set({ currentId: id, selection: [] }),
      toggleSelect: (cid) => set({ selection: get().selection.includes(cid) ? get().selection.filter((s) => s !== cid) : [...get().selection, cid] }),
      setSelection: (selection) => set({ selection }),
      clearSelection: () => set({ selection: [] }),
      mark: (groupId, candidateId, verdict) =>
        set({
          groups: get().groups.map((g) =>
            g.id === groupId ? { ...g, candidates: g.candidates.map((c) => (c.id === candidateId ? { ...c, verdict: c.verdict === verdict ? null : verdict } : c)) } : g,
          ),
        }),
      closeGroup: (id) => get().closeGroups([id]),
      closeGroups: (ids) => {
        // The pictures a closed generation batch still holds back would be hidden for good: they go to the trash.
        for (const g of get().groups) if (g.kind === 'generation' && ids.includes(g.id)) void throwAway(g);
        const groups = get().groups.filter((g) => !ids.includes(g.id));
        const wasCurrent = ids.includes(get().currentId ?? '');
        // The selection may span groups: the candidates of the closed ones leave it.
        const gone = new Set(get().groups.filter((g) => ids.includes(g.id)).flatMap((g) => g.candidates.map((c) => c.id)));
        set({ groups, currentId: wasCurrent ? (groups[groups.length - 1]?.id ?? null) : get().currentId, selection: get().selection.filter((s) => !gone.has(s)) });
      },
      discard: (groupId, candidateIds) => {
        const group = get().groups.find((g) => g.id === groupId);
        const picked = group?.candidates.filter((c) => candidateIds.includes(c.id)) ?? [];
        if (!group || !picked.length) return;
        void throwAway(group, picked);
        const gone = new Set(picked.map((c) => c.id));
        const rest = group.candidates.filter((c) => !gone.has(c.id));
        const groups = get().groups.flatMap((g) => (g.id !== groupId ? [g] : rest.length ? [{ ...g, candidates: rest }] : []));
        set({
          groups,
          currentId: get().currentId === groupId && !rest.length ? (groups.at(-1)?.id ?? null) : get().currentId,
          selection: get().selection.filter((s) => !gone.has(s)),
        });
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
            ...(items[0]?.initImageUrl ? { initImageUrl: items[0].initImageUrl } : {}),
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
          set({ groups: withQueue([...get().groups, group]), currentId: group.id });
          return null;
        } finally {
          set({ busy: false });
        }
      },
      addGeneration: (items, request) => {
        if (!items.length) return;
        const group: DraftGroup = {
          id: uid(),
          createdAt: Date.now(),
          kind: 'generation',
          params: { ...items[0]!.params },
          boardId: request.boardId,
          position: 1,
          candidates: items.map((it, i) => ({
            id: `${uid()}-${i}`,
            seed: it.params.seed,
            itemId: null,
            imageName: null,
            status: 'ready',
            error: null,
            finalItemId: it.id,
            finalImageName: null,
            finalStatus: 'queued',
            verdict: null,
          })),
        };
        set({ groups: withQueue([...get().groups, group]), currentId: group.id });
      },
      adopt: async (groupId, candidateIds) => {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return;
        const held = new Set(heldPictures(group, useGallery.getState().images).map((i) => i.name));
        const picked = group.candidates.filter((c) => candidateIds.includes(c.id) && c.finalImageName !== null && held.has(c.finalImageName));
        if (!picked.length) return;
        set({ busy: true });
        try {
          const boardId = selectedBoard();
          const updated = await backend.updateImages(
            picked.map((c) => c.finalImageName!),
            { boardId, isIntermediate: false },
          );
          useGallery.getState().upsertImages(updated);
          const gone = new Set(picked.map((c) => c.id));
          const rest = group.candidates.filter((c) => !gone.has(c.id));
          const { boards } = useGallery.getState();
          const board = boards.find((b) => b.id === boardId);
          toast({ status: 'success', title: tCount('gallery.toast.moved', updated.length, { board: board ? boardLabel(boards, board) : t('gallery.boards.uncategorized') }) });
          const groups = get().groups.flatMap((g) => (g.id !== groupId ? [g] : rest.length ? [{ ...g, candidates: rest }] : []));
          set({
            groups,
            currentId: get().currentId === groupId && !rest.length ? (groups.at(-1)?.id ?? null) : get().currentId,
            selection: get().selection.filter((s) => !gone.has(s)),
          });
        } catch (err) {
          toast({ status: 'error', title: t('drafts.adoptFailed'), description: err instanceof Error ? err.message : String(err) });
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
            // The finished picture being drawn, or not yet known, is not started twice; a cancelled or failed one, or one
            // that is done (its picture deleted since), is drawn again.
            if (!c || (c.finalItemId !== null && c.finalStatus !== 'failed' && c.finalStatus !== 'ready')) continue;
            const [item] = await backend.enqueue({
              origin: 'generate',
              destination: 'gallery',
              params: { ...group.params, seed: c.seed },
              ...(group.refImages ? { refImages: group.refImages } : {}),
              ...(group.initImageUrl ? { initImageUrl: group.initImageUrl } : {}),
              iterations: 1,
              randomizeSeed: false,
              prepend: false,
              boardId: group.boardId,
            });
            if (item) started.set(cid, item.id);
          }
          set({
            groups: withQueue(
              get().groups.map((g) =>
                g.id !== groupId
                  ? g
                  : { ...g, candidates: g.candidates.map((c) => (started.has(c.id) ? { ...c, finalItemId: started.get(c.id)!, finalStatus: 'queued' as const, finalImageName: null } : c)) },
              ),
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
              ...(group.initImageUrl ? { initImageUrl: group.initImageUrl } : {}),
              iterations: 1,
              randomizeSeed: false,
              prepend: false,
              boardId: group.boardId,
            });
            if (item) restarted.set(c.id, item.id);
          }
          set({
            groups: withQueue(
              get().groups.map((g) =>
                g.id !== groupId
                  ? g
                  : {
                      ...g,
                      candidates: g.candidates.map((c) =>
                        restarted.has(c.id) ? { ...c, itemId: restarted.get(c.id)!, status: 'queued' as const, error: null, imageName: null } : c,
                      ),
                    },
              ),
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
      partialize: (s) => ({ groups: s.groups, currentId: s.currentId, picturesRepaired: s.picturesRepaired }),
    },
  ),
);

// Keep the candidates in step with the queue.
useQueue.subscribe((s, prev) => {
  if (s.items !== prev.items) useDrafts.getState().sync(s.items);
});

// Once the gallery is known, mend the batches stored by an older version that mixed up pictures (once: the result is kept).
// The gallery holds summaries without settings, so the candidates' pictures are read first to see whether any is wrong; only
// then are all the settings read, to find the right ones.
async function repairStored(): Promise<void> {
  const state = useDrafts.getState();
  if (state.picturesRepaired) return;
  const names = state.groups.flatMap((g) => g.candidates.flatMap((c) => [c.imageName, c.finalImageName])).filter((n): n is string => n !== null);
  await ensureDetails(names);
  const images = () => useGallery.getState().images;
  if (repairGroups(state.groups, images()) !== state.groups) await ensureAllDetails();
  // A picture that could not be read cannot be judged: the check is left for a later start.
  if (names.some(isSummary) || (repairGroups(state.groups, images()) !== state.groups && summaryCount() > 0)) return;
  // From the batches as they are now, not as they were before the reads: pictures may have arrived meanwhile. Batches started
  // meanwhile are kept as they are.
  const started = new Set(state.groups.map((g) => g.id));
  const now = useDrafts.getState().groups;
  const mended = new Map(repairGroups(now.filter((g) => started.has(g.id)), images()).map((g) => [g.id, g]));
  useDrafts.setState({ groups: now.map((g) => mended.get(g.id) ?? g), picturesRepaired: true });
}

let repairing = false;
/** Starts the check when there is something to check: the gallery and the stored batches both arrive on their own time. */
function tryRepair() {
  const d = useDrafts.getState();
  if (repairing || d.picturesRepaired || d.groups.length === 0 || useGallery.getState().images.length === 0) return;
  repairing = true;
  void repairStored()
    .catch(() => undefined)
    .finally(() => (repairing = false));
}
useGallery.subscribe(tryRepair);
useDrafts.subscribe(tryRepair);

// A held picture taken to a board by hand (a drag onto a board) leaves its batch.
useGallery.subscribe((s, prev) => {
  if (s.images === prev.images) return;
  const { groups, currentId, selection } = useDrafts.getState();
  const next = dropAdopted(groups, s.images);
  if (next === groups) return;
  const alive = new Set(next.flatMap((g) => g.candidates.map((c) => c.id)));
  useDrafts.setState({
    groups: next,
    currentId: next.some((g) => g.id === currentId) ? currentId : (next.at(-1)?.id ?? null),
    selection: selection.filter((id) => alive.has(id)),
  });
});
