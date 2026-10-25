// Workflow editor state: library, the graph being edited, workflow details, the linear-view form, editor settings and
// the undo history of the graph.
import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ImageDTO, SavedWorkflow } from '@/backend';
import { undoLimit } from '../settings';

export interface WorkflowNodeData extends Record<string, unknown> {
  /** Node template type, e.g. 'denoise_latents'. */
  type: string;
  /** User label; empty means the template title. */
  label: string;
  notes: string;
  isOpen: boolean;
  useCache: boolean;
  /** Values of the input fields keyed by field name. */
  inputs: Record<string, unknown>;
}

export type WorkflowNode = Node<WorkflowNodeData, 'invocation'>;
export type WorkflowEdge = Edge;

export interface WorkflowMeta {
  /** Library id of the workflow this graph was opened from or saved as. */
  id: string | null;
  category: 'user' | 'default' | null;
  name: string;
  author: string;
  description: string;
  version: string;
  tags: string;
  notes: string;
  contact: string;
}

/** A node input exposed in the left panel form (linear view). */
export interface FormField {
  nodeId: string;
  fieldName: string;
}

export interface EditorSettings {
  snapToGrid: boolean;
  showEdgeLabels: boolean;
  animatedEdges: boolean;
  showMinimap: boolean;
  showFieldTypes: boolean;
  /** Re-run the graph optimizer shortly after nodes or connections are added or removed. */
  autoTidy: boolean;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  snapToGrid: false,
  showEdgeLabels: false,
  animatedEdges: true,
  showMinimap: true,
  showFieldTypes: true,
  autoTidy: false,
};

export interface EditorGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta: WorkflowMeta;
  form: FormField[];
}

/** The part of the graph an undo step restores. */
export type GraphSnapshot = Pick<EditorGraph, 'nodes' | 'edges' | 'form'>;

export const EMPTY_META: WorkflowMeta = {
  id: null,
  category: null,
  name: '',
  author: '',
  description: '',
  version: '1.0.0',
  tags: '',
  notes: '',
  contact: '',
};

export interface WorkflowsSharedState {
  library: SavedWorkflow[];
  setLibrary: (library: SavedWorkflow[]) => void;
  /** Load a serialized workflow graph into the editor (e.g. from an image's metadata). */
  loadWorkflow: (graph: unknown, name: string) => void;
  /** Whether a plain generation's settings can be opened as a graph (installed by registerWorkflowsFeature()). */
  canLoadImage: (image: ImageDTO) => boolean;
  /** Builds a graph from the settings kept with a generated image and opens it in the editor. */
  loadImage: (image: ImageDTO) => void;
  /** Adds an image input node holding `image` to the graph being edited and opens the editor. */
  addImageInput: (image: ImageDTO) => void;
  /** Opens a workflow file the user picked, asking first when unsaved changes would be lost. */
  loadFile: (file: File) => void;
}

interface WorkflowsState extends WorkflowsSharedState, EditorGraph {
  /** True when the graph has unsaved changes. */
  isTouched: boolean;
  /** Bumped whenever a whole graph is loaded (the editor refits the view). */
  graphNonce: number;
  /** Library ids opened most recently first. */
  recentIds: string[];
  /** Linear view mode of the left panel ('edit' shows reorder controls). */
  mode: 'view' | 'edit';
  settings: EditorSettings;
  /** Undo and redo stacks of the graph (cleared when another graph is loaded). */
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  /** Bumped when the user adds or removes nodes or connections (not by moves, field edits, undo/redo or loads). */
  structureNonce: number;

  upsertLibrary: (wf: SavedWorkflow) => void;
  removeFromLibrary: (id: string) => void;
  setGraph: (graph: EditorGraph, opts?: { touched?: boolean }) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  /** Adds an edge, replacing any edge already connected to the same input. */
  connect: (edge: WorkflowEdge) => void;
  /** Adds nodes and edges; an added edge replaces any edge already connected to the same input. */
  addNodes: (nodes: WorkflowNode[], edges?: WorkflowEdge[]) => void;
  /** Replaces the nodes, edges and form of the open graph as one undo step (unlike setGraph, which opens another graph). */
  commitGraph: (graph: GraphSnapshot) => void;
  /** Saves the graph for undo. Calls with the same key within a second join the previous step. */
  pushHistory: (coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  updateNodeData: (nodeId: string, patch: Partial<WorkflowNodeData>) => void;
  setFieldValue: (nodeId: string, fieldName: string, value: unknown) => void;
  setMeta: (patch: Partial<WorkflowMeta>) => void;
  addFormField: (field: FormField) => void;
  removeFormField: (field: FormField) => void;
  moveFormField: (index: number, delta: -1 | 1) => void;
  setMode: (mode: 'view' | 'edit') => void;
  setSettings: (patch: Partial<EditorSettings>) => void;
  markSaved: (id: string, category: 'user' | 'default') => void;
  pushRecent: (id: string) => void;
}

const sameField = (a: FormField, b: FormField) => a.nodeId === b.nodeId && a.fieldName === b.fieldName;
const sameInput = (a: WorkflowEdge, b: WorkflowEdge) => a.target === b.target && a.targetHandle === b.targetHandle;
const TOUCHING_NODE_CHANGES = new Set(['add', 'remove', 'replace', 'position']);
const COALESCE_MS = 1000;
/** Key and time of the last undo step, so a burst of edits to one control becomes one step. */
let lastStep: { key: string | null; at: number } = { key: null, at: 0 };
const resetCoalescing = () => {
  lastStep = { key: null, at: 0 };
};

/** Restores the saved part of the state. A setting added later keeps its default when the saved settings predate it. */
export function mergeSaved<S extends { settings: EditorSettings }>(persisted: unknown, current: S): S {
  const saved = (persisted ?? {}) as Partial<Pick<WorkflowsState, 'settings' | 'recentIds'>>;
  return { ...current, ...saved, settings: { ...current.settings, ...saved.settings } };
}

export const useWorkflows = create<WorkflowsState>()(
  persist(
    (set, get) => {
      const snapshot = (): GraphSnapshot => {
        const s = get();
        return { nodes: s.nodes, edges: s.edges, form: s.form };
      };
      return {
        library: [],
        setLibrary: (library) => set({ library }),
        loadWorkflow: () => {
          // Installed by registerWorkflowsFeature().
        },
        canLoadImage: () => false,
        loadImage: () => {
          // Installed by registerWorkflowsFeature().
        },
        addImageInput: () => {
          // Installed by registerWorkflowsFeature().
        },
        loadFile: () => {
          // Installed by registerWorkflowsFeature().
        },

        nodes: [],
        edges: [],
        meta: { ...EMPTY_META },
        form: [],
        isTouched: false,
        graphNonce: 0,
        recentIds: [],
        mode: 'view',
        settings: { ...DEFAULT_SETTINGS },
        past: [],
        future: [],
        structureNonce: 0,

        upsertLibrary: (wf) => {
          const lib = get().library;
          set({ library: lib.some((w) => w.id === wf.id) ? lib.map((w) => (w.id === wf.id ? wf : w)) : [...lib, wf] });
        },
        removeFromLibrary: (id) => set({ library: get().library.filter((w) => w.id !== id), recentIds: get().recentIds.filter((r) => r !== id) }),
        setGraph: (graph, opts) => {
          resetCoalescing();
          set({
            nodes: graph.nodes,
            edges: graph.edges,
            meta: graph.meta,
            form: graph.form,
            isTouched: opts?.touched ?? false,
            graphNonce: get().graphNonce + 1,
            past: [],
            future: [],
          });
        },
        onNodesChange: (changes) => {
          const removed = new Set(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])));
          const touched = changes.some((c) => TOUCHING_NODE_CHANGES.has(c.type) && !(c.type === 'position' && !c.position));
          const structural = changes.some((c) => c.type === 'add' || c.type === 'remove');
          const before = get();
          // A drag is one undo step, saved when it starts. React Flow removes a node's edges in a separate call: one step.
          const dragStart = changes.some((c) => c.type === 'position' && c.dragging && !before.nodes.find((n) => n.id === c.id)?.dragging);
          if (structural) before.pushHistory('remove');
          else if (dragStart) before.pushHistory();
          const s = get();
          set({
            nodes: applyNodeChanges(changes, s.nodes),
            edges: removed.size ? s.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)) : s.edges,
            form: removed.size ? s.form.filter((f) => !removed.has(f.nodeId)) : s.form,
            isTouched: s.isTouched || touched,
            structureNonce: structural ? s.structureNonce + 1 : s.structureNonce,
          });
        },
        onEdgesChange: (changes) => {
          const touched = changes.some((c) => c.type === 'add' || c.type === 'remove' || c.type === 'replace');
          const structural = changes.some((c) => c.type === 'add' || c.type === 'remove');
          if (structural) get().pushHistory('remove');
          const s = get();
          set({
            edges: applyEdgeChanges(changes, s.edges),
            isTouched: s.isTouched || touched,
            structureNonce: structural ? s.structureNonce + 1 : s.structureNonce,
          });
        },
        connect: (edge) => {
          get().pushHistory();
          const s = get();
          set({ edges: [...s.edges.filter((e) => !sameInput(e, edge)), edge], isTouched: true, structureNonce: s.structureNonce + 1 });
        },
        addNodes: (nodes, edges = []) => {
          get().pushHistory();
          const s = get();
          set({
            nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...nodes],
            edges: [...s.edges.filter((e) => !edges.some((x) => sameInput(e, x))), ...edges],
            isTouched: true,
            structureNonce: s.structureNonce + 1,
          });
        },
        commitGraph: (graph) => {
          get().pushHistory();
          set({ nodes: graph.nodes, edges: graph.edges, form: graph.form, isTouched: true });
        },
        pushHistory: (key) => {
          const now = Date.now();
          if (key && lastStep.key === key && now - lastStep.at < COALESCE_MS) {
            lastStep = { key, at: now };
            return;
          }
          lastStep = { key: key ?? null, at: now };
          set({ past: [...get().past, snapshot()].slice(-undoLimit()), future: [] });
        },
        undo: () => {
          const s = get();
          const prev = s.past[s.past.length - 1];
          if (!prev) return;
          resetCoalescing();
          set({ ...prev, past: s.past.slice(0, -1), future: [snapshot(), ...s.future], isTouched: true });
        },
        redo: () => {
          const s = get();
          const next = s.future[0];
          if (!next) return;
          resetCoalescing();
          set({ ...next, past: [...s.past, snapshot()], future: s.future.slice(1), isTouched: true });
        },
        updateNodeData: (nodeId, patch) => {
          get().pushHistory(`data:${nodeId}:${Object.keys(patch).sort().join(',')}`);
          set({ nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)), isTouched: true });
        },
        setFieldValue: (nodeId, fieldName, value) => {
          get().pushHistory(`field:${nodeId}:${fieldName}`);
          set({
            nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, [fieldName]: value } } } : n)),
            isTouched: true,
          });
        },
        setMeta: (patch) => set({ meta: { ...get().meta, ...patch }, isTouched: true }),
        addFormField: (field) => {
          if (get().form.some((f) => sameField(f, field))) return;
          get().pushHistory();
          set({ form: [...get().form, field], isTouched: true });
        },
        removeFormField: (field) => {
          get().pushHistory();
          set({ form: get().form.filter((f) => !sameField(f, field)), isTouched: true });
        },
        moveFormField: (index, delta) => {
          const form = [...get().form];
          const to = index + delta;
          if (to < 0 || to >= form.length) return;
          get().pushHistory();
          const [item] = form.splice(index, 1);
          if (item) form.splice(to, 0, item);
          set({ form, isTouched: true });
        },
        setMode: (mode) => set({ mode }),
        setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
        markSaved: (id, category) => set({ meta: { ...get().meta, id, category }, isTouched: false }),
        pushRecent: (id) => set({ recentIds: [id, ...get().recentIds.filter((r) => r !== id)].slice(0, 20) }),
      };
    },
    {
      name: 'novira.workflows',
      partialize: (s) => ({ settings: s.settings, recentIds: s.recentIds }),
      merge: mergeSaved,
    },
  ),
);
