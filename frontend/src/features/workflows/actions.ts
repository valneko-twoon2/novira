// Workflow-level actions: open, new, save, save as, download, load from file.
import { backend, type ImageDTO, type SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { useUi } from '@/state/ui';
import { EMPTY_META, useWorkflows, type EditorGraph } from '@/state/workflows/workflows';
import { buildDefaultGraph } from './defaultGraphs';
import { createNode } from './graph';
import { canBuildFromImage, graphFromImage } from './imageGraph';
import { missingPacks } from './packRequirements';
import { deserializeWorkflow, serializeWorkflow } from './serialize';
import { getTemplate } from './templates';

function showEditor() {
  const ui = useUi.getState();
  if (ui.activeTab !== 'workflows') ui.setTab('workflows');
  ui.setMainView('workflows', 'editor');
}

/** Graph of a library entry (built for defaults without a stored graph). */
export function graphForLibraryItem(wf: SavedWorkflow): EditorGraph | null {
  const parsed = wf.graph ? deserializeWorkflow(wf.graph) : buildDefaultGraph(wf, useModels.getState().models);
  if (!parsed) return null;
  return {
    ...parsed,
    meta: { ...parsed.meta, name: parsed.meta.name || wf.name, id: wf.id, category: wf.category },
  };
}

export function openLibraryWorkflow(wf: SavedWorkflow): boolean {
  const graph = graphForLibraryItem(wf);
  const store = useWorkflows.getState();
  if (!graph) {
    // A user workflow saved without a graph opens empty, like a fresh workflow with its details.
    if (wf.category !== 'user') {
      toast({ status: 'error', title: t('workflows.toasts.loadFailed'), description: wf.name });
      return false;
    }
    store.setGraph({
      nodes: [],
      edges: [],
      form: [],
      meta: { ...EMPTY_META, id: wf.id, category: wf.category, name: wf.name, description: wf.description, author: wf.author, tags: wf.tags.join(', ') },
    });
  } else store.setGraph(graph);
  store.pushRecent(wf.id);
  showEditor();
  useUi.getState().openModal(null);
  return true;
}

/** A graph that only lacks custom node packs waits for them (the import dialog explains); true when it does. */
function waitForPacks(raw: unknown, name: string): boolean {
  const missing = missingPacks(raw);
  if (!missing) return false;
  const meta = typeof raw === 'object' && raw !== null ? (raw as { meta?: { name?: unknown } }).meta : undefined;
  useWorkflowImport.getState().set({ raw, name: typeof meta?.name === 'string' && meta.name ? meta.name : name, ...missing });
  return true;
}

/** Shared-store loadWorkflow: used by the gallery ("Load workflow") and the launchpad. */
export function loadWorkflowGraph(graph: unknown, name: string) {
  const parsed = deserializeWorkflow(graph);
  if (!parsed) {
    if (waitForPacks(graph, name)) return;
    toast({ status: 'error', title: t('workflows.toasts.loadFailed'), description: t('workflows.toasts.invalidGraph') });
    return;
  }
  useWorkflows.getState().setGraph({ ...parsed, meta: { ...parsed.meta, name: parsed.meta.name || name, id: null, category: null } });
  showEditor();
  toast({ status: 'success', title: t('workflows.toasts.loaded', { name: parsed.meta.name || name }) });
}

/** Whether the image's own settings can be opened as a graph (a plain generation of a model the nodes cover). */
export function canLoadImageGraph(image: ImageDTO): boolean {
  return canBuildFromImage(image, useModels.getState().models);
}

/** Opens a plain generation as a graph, so it can be changed step by step; says what the graph could not carry. */
export function loadImageGraph(image: ImageDTO) {
  const built = graphFromImage(image, useModels.getState().models);
  if (!built) {
    toast({ status: 'warning', title: t('workflows.fromImage.unsupported') });
    return;
  }
  useWorkflows.getState().setGraph(built.graph);
  showEditor();
  toast({
    status: built.lost.length ? 'warning' : 'success',
    title: t('workflows.fromImage.loaded'),
    description: built.lost.length ? t('workflows.fromImage.lost', { items: built.lost.join(t('workflows.fromImage.separator')) }) : undefined,
  });
}

/** Free spot for a new node: left of the graph's leftmost node, at the top (the origin for an empty graph). */
export function inputNodePosition(nodes: { position: { x: number; y: number } }[]): { x: number; y: number } {
  if (!nodes.length) return { x: 0, y: 0 };
  const left = Math.min(...nodes.map((n) => n.position.x));
  const top = Math.min(...nodes.map((n) => n.position.y));
  return { x: left - 380, y: top };
}

/** Adds an image input node with a gallery picture to the current graph, so a generated picture feeds a workflow. */
export function addImageInputNode(image: ImageDTO) {
  const template = getTemplate('image');
  if (!template) return;
  const s = useWorkflows.getState();
  s.addNodes([createNode(template, inputNodePosition(s.nodes), { inputs: { image: image.name } })]);
  showEditor();
  toast({ status: 'success', title: t('workflows.toast.imageAdded') });
}

export function newWorkflow() {
  useWorkflows.getState().setGraph({ nodes: [], edges: [], form: [], meta: { ...EMPTY_META } });
  showEditor();
}

function currentSerialized() {
  const s = useWorkflows.getState();
  return serializeWorkflow(s);
}

async function persist(asNew: boolean, name?: string) {
  const s = useWorkflows.getState();
  const finalName = (name ?? s.meta.name).trim() || t('workflows.untitled');
  if (name !== undefined) s.setMeta({ name: finalName });
  const graph = currentSerialized();
  const id = !asNew && s.meta.category === 'user' ? (s.meta.id ?? undefined) : undefined;
  try {
    const saved = await backend.saveWorkflow({
      id,
      name: finalName,
      description: s.meta.description,
      author: s.meta.author,
      tags: s.meta.tags.split(',').map((x) => x.trim()).filter(Boolean),
      graph,
    });
    const store = useWorkflows.getState();
    store.upsertLibrary(saved);
    store.markSaved(saved.id, saved.category);
    store.pushRecent(saved.id);
    toast({ status: 'success', title: t('workflows.toasts.saved', { name: saved.name }) });
  } catch (err) {
    toast({ status: 'error', title: t('workflows.toasts.saveFailed'), description: String(err instanceof Error ? err.message : err) });
  }
}

/** Saves in place for user workflows; otherwise the caller must ask for a name (Save As). */
export function canSaveInPlace(): boolean {
  const m = useWorkflows.getState().meta;
  return m.category === 'user' && !!m.id;
}

export const saveWorkflow = () => persist(false);
export const saveWorkflowAs = (name: string) => persist(true, name);

/** Copies a default workflow to the user's workflows. */
export async function copyToMyWorkflows(wf: SavedWorkflow) {
  const graph = graphForLibraryItem(wf);
  try {
    const saved = await backend.saveWorkflow({
      name: t('workflows.library.copyName', { name: wf.name }),
      description: wf.description,
      author: wf.author,
      tags: wf.tags.filter((x) => x !== 'default'),
      // The backend keeps only a graph that is an object: a workflow with nothing to carry is copied as an empty one.
      graph: serializeWorkflow({ ...(graph ?? { nodes: [], edges: [], form: [], meta: EMPTY_META }), meta: { ...(graph?.meta ?? EMPTY_META), name: t('workflows.library.copyName', { name: wf.name }) } }),
    });
    useWorkflows.getState().upsertLibrary(saved);
    toast({ status: 'success', title: t('workflows.toasts.copied', { name: saved.name }) });
  } catch (err) {
    toast({ status: 'error', title: t('workflows.toasts.saveFailed'), description: String(err instanceof Error ? err.message : err) });
  }
}

export async function deleteLibraryWorkflow(wf: SavedWorkflow) {
  try {
    await backend.deleteWorkflow(wf.id);
    const store = useWorkflows.getState();
    store.removeFromLibrary(wf.id);
    if (store.meta.id === wf.id) store.setGraph({ nodes: store.nodes, edges: store.edges, form: store.form, meta: { ...store.meta, id: null, category: null } }, { touched: true });
    toast({ status: 'success', title: t('workflows.toasts.deleted', { name: wf.name }) });
  } catch (err) {
    toast({ status: 'error', title: t('workflows.toasts.deleteFailed'), description: String(err instanceof Error ? err.message : err) });
  }
}

export function downloadWorkflow() {
  const s = useWorkflows.getState();
  const blob = new Blob([JSON.stringify(serializeWorkflow(s), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(s.meta.name || t('workflows.untitled')).replace(/[\\/:*?"<>|]+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadWorkflowFile(file: File) {
  const text = await file.text();
  const parsed = deserializeWorkflow(text);
  if (!parsed) {
    if (waitForPacks(text, file.name.replace(/\.json$/i, ''))) return;
    toast({ status: 'error', title: t('workflows.toasts.loadFailed'), description: t('workflows.toasts.invalidFile', { name: file.name }) });
    return;
  }
  const name = parsed.meta.name || file.name.replace(/\.json$/i, '');
  useWorkflows.getState().setGraph({ ...parsed, meta: { ...parsed.meta, name, id: null, category: null } }, { touched: true });
  showEditor();
  useUi.getState().openModal(null);
  toast({ status: 'success', title: t('workflows.toasts.loaded', { name }) });
}
