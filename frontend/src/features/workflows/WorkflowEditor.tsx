// Center view of the Workflows tab: the node editor (React Flow) with toolbar, picker, hotkeys and automatic tidying.
import '@xyflow/react/dist/style.css';
import './workflows.css';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type OnConnectEnd,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { isImageDrag, resolveDropImages } from '@/state/dnd';
import type { TabName } from '@/state/ui';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useWorkflows, type WorkflowEdge, type WorkflowNode } from '@/state/workflows/workflows';
import { useHotkey } from '@/ui';
import { EditorToolbar, requestSave } from './EditorToolbar';
import { FieldEdge } from './FieldEdge';
import { autoConnection, compatibleField, createNode, isValidConnection, makeEdge, newId } from './graph';
import { useInitialWorkflow } from './initialWorkflow';
import { InvocationNode } from './InvocationNode';
import { NODE_MIME, registerNodeAdder } from './nodeAdder';
import { NodePicker, type PickerFilter } from './NodePicker';
import { startAutoOptimize } from './optimizeWorkflow';
import { getTemplate, type NodeTemplate } from './templates';

export { WorkflowsLeftPanel } from './LeftPanel';
export { WorkflowLibraryCard } from './LibraryCard';

const nodeTypes: NodeTypes = { invocation: InvocationNode };
const edgeTypes: EdgeTypes = { field: FieldEdge, default: FieldEdge };

interface PickerState {
  /** Position inside the editor element (px). */
  x: number;
  y: number;
  /** Flow position where the node is placed. */
  flow: { x: number; y: number };
  filter: PickerFilter | null;
  from: { nodeId: string; handle: string; side: 'source' | 'target' } | null;
}

let clipboard: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null = null;

export function WorkflowEditor(_props: { tab?: TabName }) {
  useInitialWorkflow();
  // The nodes of installed custom node packs (ComfyUI starts on the first request).
  useEffect(() => {
    void useComfyNodes.getState().load();
  }, []);
  return (
    <ReactFlowProvider>
      <EditorCanvas />
    </ReactFlowProvider>
  );
}

function EditorCanvas() {
  const nodes = useWorkflows((s) => s.nodes);
  const edges = useWorkflows((s) => s.edges);
  const onNodesChange = useWorkflows((s) => s.onNodesChange);
  const onEdgesChange = useWorkflows((s) => s.onEdgesChange);
  const settings = useWorkflows((s) => s.settings);
  const graphNonce = useWorkflows((s) => s.graphNonce);
  const flow = useReactFlow<WorkflowNode, WorkflowEdge>();
  const flowStore = useStoreApi<WorkflowNode, WorkflowEdge>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => void flow.fitView({ padding: 0.15, duration: 0 }));
    return () => cancelAnimationFrame(id);
  }, [graphNonce, flow]);

  // Re-optimizes after nodes or connections are added or removed, never in the middle of a drag or a new connection.
  useEffect(
    () =>
      startAutoOptimize(() => {
        const rf = flowStore.getState();
        return rf.connection.inProgress || rf.paneDragging || rf.userSelectionActive;
      }),
    [flowStore],
  );

  const checkConnection = useCallback((c: Connection | WorkflowEdge) => {
    const s = useWorkflows.getState();
    return isValidConnection(s.nodes, s.edges, c);
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.sourceHandle || !c.targetHandle) return;
    useWorkflows.getState().connect(makeEdge(c.source, c.sourceHandle, c.target, c.targetHandle));
  }, []);

  const openPickerAt = useCallback(
    (clientX: number, clientY: number, filter: PickerFilter | null, from: PickerState['from']) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(Math.max(8, clientX - rect.left), rect.width - 328);
      const y = Math.min(Math.max(8, clientY - rect.top), rect.height - 368);
      setPicker({ x: Math.max(8, x), y: Math.max(8, y), flow: flow.screenToFlowPosition({ x: clientX, y: clientY }), filter, from });
    },
    [flow],
  );

  const openPickerCenter = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    openPickerAt(rect.left + rect.width / 2 - 160, rect.top + rect.height / 3, null, null);
  }, [openPickerAt]);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || state.toNode || !state.fromHandle?.id || !state.fromNode) return;
      const s = useWorkflows.getState();
      // Released on a node's body: connect to the first handle that fits instead of asking for a new node.
      const dropped = (event.target as Element | null)?.closest?.('.react-flow__node')?.getAttribute('data-id');
      if (dropped) {
        const c = autoConnection(s.nodes, s.edges, { nodeId: state.fromNode.id, handle: state.fromHandle.id, side: state.fromHandle.type }, dropped);
        if (c?.sourceHandle && c.targetHandle && c.source && c.target) s.connect(makeEdge(c.source, c.sourceHandle, c.target, c.targetHandle));
        return;
      }
      const side = state.fromHandle.type;
      const handle = state.fromHandle.id;
      const nodeId = state.fromNode.id;
      const tpl = getTemplate(s.nodes.find((n) => n.id === nodeId)?.data.type ?? '');
      const fieldType = side === 'source' ? tpl?.outputs.find((o) => o.name === handle)?.type : tpl?.inputs.find((i) => i.name === handle)?.type;
      if (!fieldType) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      if (!point) return;
      openPickerAt(point.clientX, point.clientY, { type: fieldType, side }, { nodeId, handle, side });
    },
    [openPickerAt],
  );

  // The node library in the left panel adds to the middle of what is on screen, each one a little off the last so they do not pile up.
  const stagger = useRef(0);
  useEffect(
    () =>
      registerNodeAdder((template) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return;
        const off = (stagger.current++ % 8) * 30;
        const at = flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        useWorkflows.getState().addNodes([{ ...createNode(template, { x: at.x - 110 + off, y: at.y - 40 + off }), selected: true }], []);
      }),
    [flow],
  );

  const pick = (template: NodeTemplate) => {
    if (!picker) return;
    const s = useWorkflows.getState();
    const position = picker.from?.side === 'target' ? { x: picker.flow.x - 320, y: picker.flow.y - 40 } : { x: picker.flow.x, y: picker.flow.y - 40 };
    const node = { ...createNode(template, position), selected: true };
    const newEdges: WorkflowEdge[] = [];
    if (picker.from && picker.filter) {
      const field = compatibleField(template, picker.filter);
      if (field) {
        const e =
          picker.from.side === 'source'
            ? makeEdge(picker.from.nodeId, picker.from.handle, node.id, field)
            : makeEdge(node.id, field, picker.from.nodeId, picker.from.handle);
        newEdges.push(e);
      }
    }
    // An input accepts one connection: addNodes replaces the existing one.
    s.addNodes([node], newEdges);
    setPicker(null);
  };

  useHotkey(['shift+a', 'space'], openPickerCenter);
  useHotkey('mod+s', requestSave, { allowInInput: true });
  useHotkey('mod+z', () => useWorkflows.getState().undo());
  useHotkey(['mod+shift+z', 'mod+y'], () => useWorkflows.getState().redo());
  useHotkey(
    'mod+c',
    (e) => {
      const s = useWorkflows.getState();
      const selected = s.nodes.filter((n) => n.selected);
      if (!selected.length || window.getSelection()?.toString()) return;
      e.preventDefault();
      const ids = new Set(selected.map((n) => n.id));
      clipboard = { nodes: selected, edges: s.edges.filter((x) => ids.has(x.source) && ids.has(x.target)) };
    },
    { preventDefault: false },
  );
  useHotkey(
    'mod+v',
    (e) => {
      if (!clipboard) return;
      e.preventDefault();
      const map = new Map<string, string>();
      const pasted = clipboard.nodes.map((n) => {
        const id = newId(n.data.type);
        map.set(n.id, id);
        return { ...n, id, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 }, data: structuredClone(n.data) };
      });
      const pastedEdges = clipboard.edges.map((x) =>
        makeEdge(map.get(x.source) as string, x.sourceHandle ?? '', map.get(x.target) as string, x.targetHandle ?? ''),
      );
      useWorkflows.getState().addNodes(pasted, pastedEdges);
      clipboard = { nodes: pasted, edges: pastedEdges };
    },
    { preventDefault: false },
  );

  const onDragOver = (e: DragEvent) => {
    if (!isImageDrag(e) && !e.dataTransfer.types.includes(NODE_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: DragEvent) => {
    const dragged = e.dataTransfer.types.includes(NODE_MIME) ? e.dataTransfer.getData(NODE_MIME) : '';
    if (dragged) {
      e.preventDefault();
      const template = getTemplate(dragged);
      const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (template) useWorkflows.getState().addNodes([{ ...createNode(template, { x: at.x - 110, y: at.y - 20 }), selected: true }], []);
      return;
    }
    if (!isImageDrag(e)) return;
    e.preventDefault();
    const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void resolveDropImages(e).then((names) => {
      const template = getTemplate('image');
      if (!names.length || !template) return;
      useWorkflows.getState().addNodes(names.map((name, i) => createNode(template, { x: p.x + i * 30, y: p.y + i * 30 }, { inputs: { image: name } })));
    });
  };

  return (
    <div className="wf-editor" ref={wrapRef} onDragOver={onDragOver} onDrop={onDrop} data-testid="wf-editor">
      <ReactFlow<WorkflowNode, WorkflowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={checkConnection}
        defaultEdgeOptions={{ type: 'field' }}
        deleteKeyCode={['Delete', 'Backspace']}
        panActivationKeyCode={null}
        snapToGrid={settings.snapToGrid}
        snapGrid={[25, 25]}
        minZoom={0.1}
        maxZoom={2}
        colorMode="dark"
        connectionRadius={30}

        onPaneClick={() => setPicker(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} className="wf-bg" />
        <Controls className="wf-controls" showInteractive={false} />
        {settings.showMinimap && <MiniMap className="wf-minimap" pannable zoomable />}
        <EditorToolbar />
      </ReactFlow>
      {picker && <NodePicker filter={picker.filter} onPick={pick} onClose={() => setPicker(null)} />}
    </div>
  );
}
