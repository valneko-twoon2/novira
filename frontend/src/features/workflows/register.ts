// Registers the workflows Invoke builder and implements the shared workflow store actions.
import { registerAgentEditor, registerAgentExtensionNodes, registerAgentWorkflow } from '@/state/agent';
import { getLocale, onLocaleChange } from '@/i18n';
import { registerInvokeBuilder } from '@/state/invoke';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useComfyUiLocale } from '@/state/comfy/comfyUiLocale';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { useWorkflows, type EditorGraph } from '@/state/workflows/workflows';
import { addImageInputNode, canLoadImageGraph, loadImageGraph, loadWorkflowFile, loadWorkflowGraph } from './actions';
import { confirmDiscard } from './dialogs';
import { agentNodeTypes, agentRecipes, extensionNodes } from './agentRecipes';
import { searchComfyNodes } from './agentNodes';
import { comfyTemplates } from './comfyNodes';
import { checkAssistantGraph, editedGraph, workflowContext } from './aiOps';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { deserializeWorkflow, serializeWorkflow, WORKFLOW_FORMAT } from './serialize';
import { setExtensionTemplates } from './templates';

export function registerWorkflowsFeature() {
  // Nodes of installed custom node packs join the catalog whenever ComfyUI's definitions are (re)loaded.
  setExtensionTemplates(comfyTemplates(useComfyNodes.getState().defs));
  // ComfyUI's words for its nodes are read once it runs (its definitions are there), and again in a new language.
  const loadWords = () => {
    if (useComfyNodes.getState().defs) void useComfyUiLocale.getState().load(getLocale());
  };
  loadWords();
  onLocaleChange(loadWords);
  useComfyNodes.subscribe((s, prev) => {
    if (s.defs !== prev.defs) setExtensionTemplates(comfyTemplates(s.defs));
    if (s.defs && !prev.defs) loadWords();
    // A file that waited for packs opens as soon as ComfyUI knows their nodes.
    const waiting = useWorkflowImport.getState().pending;
    if (s.defs !== prev.defs && waiting && deserializeWorkflow(waiting.raw)) {
      useWorkflowImport.getState().clear();
      loadWorkflowGraph(waiting.raw, waiting.name);
    }
  });
  useWorkflows.setState({
    loadWorkflow: loadWorkflowGraph,
    canLoadImage: canLoadImageGraph,
    loadImage: loadImageGraph,
    addImageInput: addImageInputNode,
    loadFile: (file) => confirmDiscard(() => void loadWorkflowFile(file)),
  });
  registerAgentWorkflow(
    (name, graph) => {
      const report = checkAssistantGraph(typeof graph === 'object' && graph !== null ? graph : {});
      // A node type that does not exist stops the graph from opening: say which, instead of a toast only the user sees.
      if (report.unknownTypes.length) {
        const types = report.unknownTypes.map((t) => `"${t}"`).join(', ');
        return { error: `The graph was not opened: there is no node type ${types}. Find the right type with search_comfy_nodes (ComfyUI's nodes are "comfy:<Class>") or take one of get_workflow's nodeTypes.`, dropped: [] };
      }
      loadWorkflowGraph({ format: WORKFLOW_FORMAT, version: 1, meta: { name }, form: [], ...(report.graph as object) }, name);
      return { dropped: report.dropped };
    },
    agentNodeTypes,
    agentRecipes,
    searchComfyNodes,
  );
  registerAgentExtensionNodes((folder) => extensionNodes(useComfyNodes.getState().defs, folder));
  let skipped: string[] = [];
  registerAgentEditor('workflows', {
    // `problems` are what still keeps the graph from running (the Invoke button says the same), so the assistant can mend it.
    context: () => ({ ...(workflowContext(useWorkflows.getState()) as object), problems: readinessReasons(useWorkflows.getState()) }),
    apply: (ops) => {
      const s = useWorkflows.getState();
      const edited = editedGraph(s, ops);
      skipped = edited?.skipped ?? ['the result is not a valid workflow'];
      if (!edited || edited.applied === 0) return false;
      s.setGraph(edited.graph);
      return true;
    },
    skipped: () => skipped,
    snapshot: () => {
      const { nodes, edges, meta, form } = useWorkflows.getState();
      return { nodes, edges, meta, form };
    },
    restore: (graph) => useWorkflows.getState().setGraph(graph as EditorGraph),
  });
  registerInvokeBuilder('workflows', {
    readiness: () => readinessReasons(useWorkflows.getState()),
    build: async ({ prepend }) => {
      const s = useWorkflows.getState();
      return buildRequest(s, serializeWorkflow(s), { prepend });
    },
    subscribe: (onChange) =>
      useWorkflows.subscribe((s, prev) => {
        if (s.nodes !== prev.nodes || s.edges !== prev.edges) onChange();
      }),
  });
}
