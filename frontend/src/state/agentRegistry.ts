// What the features tell the assistant's tools: how to read and change their data (an editor per screen), how a graph
// from the assistant is opened, which workflow nodes and ready-made graphs exist, the nodes of an installed extension,
// and how a model is selected. Features register these at start-up; the tools (agentTools.ts) use them.
import type { AgentNodeSearch, AgentNodeType, AgentRecipe, ModelConfig } from '@/backend';
import type { AgentExtensionNode } from './agentExtensions';
import type { EditScreen } from './agentSessions';
import { useParams } from './params';
import { isScreenShown } from './ui';

/** How a feature lets the assistant read and change its data (the text editor's scene, the workflow graph, a form). */
export interface AgentEditor {
  /** What the assistant is told about the current data. */
  context: () => unknown;
  /** What an edit call answers with, when that should be less than `context` (a large editor answers with what it changed and what is open). */
  answer?: () => unknown;
  /** Applies operations from the assistant; false when none took effect. */
  apply: (ops: unknown[]) => boolean;
  /** What the last `apply` left out and why, when the editor can say (the model corrects itself from it). */
  skipped?: () => string[];
  /** The data as it is now, for undo. */
  snapshot: () => unknown;
  restore: (snapshot: unknown) => void;
  /** Stores a picture of a page (from 1) as an intermediate picture and gives its name, for an editor the assistant may look at. */
  view?: (page: number) => Promise<string>;
}

const editors: Partial<Record<EditScreen, AgentEditor>> = {};

export function registerAgentEditor(screen: EditScreen, editor: AgentEditor) {
  editors[screen] = editor;
}

/** The editor registered for a screen, if any; none for a screen this build hides, so every tool says it is not there. */
export function agentEditor(screen: EditScreen): AgentEditor | undefined {
  return isScreenShown(screen) ? editors[screen] : undefined;
}

/** What opening a graph from the assistant came to: `error` when it could not open, `dropped` for what it left out. */
export interface WorkflowOpened {
  error?: string;
  dropped: string[];
}

type WorkflowOpener = (name: string, graph: unknown) => WorkflowOpened;
type NodeSearcher = (query: string, limit: number) => AgentNodeSearch;
let openWorkflow: WorkflowOpener = () => ({ dropped: [] });
let nodeTypes: () => AgentNodeType[] = () => [];
let recipes: (installedPacks: string[]) => AgentRecipe[] = () => [];
let searchNodes: NodeSearcher = () => ({ ready: false, total: 0, matches: [] });

/** The workflows feature registers how a graph from the assistant is opened, which node types exist and how to find more. */
export function registerAgentWorkflow(open: WorkflowOpener, types: () => AgentNodeType[], ready: (installedPacks: string[]) => AgentRecipe[] = () => [], search?: NodeSearcher) {
  openWorkflow = open;
  nodeTypes = types;
  recipes = ready;
  searchNodes = search ?? (() => ({ ready: false, total: 0, matches: [] }));
}

export const agentWorkflow = {
  open: (name: string, graph: unknown) => openWorkflow(name, graph),
  nodeTypes: () => nodeTypes(),
  recipes: (installedPacks: string[]) => recipes(installedPacks),
  searchNodes: (query: string, limit: number) => searchNodes(query, limit),
};

let nodesOfExtension: (folder: string) => AgentExtensionNode[] = () => [];

/** The workflows feature registers how to list the nodes an installed extension adds (the editor knows them). */
export function registerAgentExtensionNodes(fn: (folder: string) => AgentExtensionNode[]) {
  nodesOfExtension = fn;
}

export const extensionNodes = (folder: string) => nodesOfExtension(folder);

type ModelSelector = (model: ModelConfig) => void;
let selectModel: ModelSelector = (m) => useParams.getState().set({ modelKey: m.key });

/** The params feature registers its richer model selection (default settings, compatibility cleanup). */
export function registerAgentModelSelector(fn: ModelSelector) {
  selectModel = fn;
}

export const selectAgentModel = (model: ModelConfig) => selectModel(model);
