// Help while a connection is being dragged: handles that cannot take it are greyed out, the ones that can are marked,
// and a node with no fitting handle is dimmed. The rules are the same as the ones that validate the connection.
import { Handle, useConnection, type HandleProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { useWorkflows } from '@/state/workflows/workflows';
import { cx } from '@/ui';
import { acceptsDrag, nodeAcceptsDrag, type DragFrom } from './graph';
import { getTemplate } from './templates';

export type HandleAssist = 'idle' | 'origin' | 'ok' | 'blocked';

const SEP = '|';

/** The handle being dragged from, or null while no connection is in progress. Changes only when the drag starts or ends. */
export function useDragFrom(): DragFrom | null {
  const key = useConnection((c) => (c.inProgress && c.fromHandle?.id ? [c.fromNode.id, c.fromHandle.id, c.fromHandle.type].join(SEP) : ''));
  if (!key) return null;
  const [nodeId, handle, side] = key.split(SEP) as [string, string, DragFrom['side']];
  return { nodeId, handle, side };
}

export function useHandleAssist(nodeId: string, handle: string, side: DragFrom['side']): HandleAssist {
  const from = useDragFrom();
  if (!from) return 'idle';
  if (from.nodeId === nodeId && from.handle === handle && from.side === side) return 'origin';
  const s = useWorkflows.getState();
  return acceptsDrag(s.nodes, s.edges, from, { nodeId, handle, side }) ? 'ok' : 'blocked';
}

/** True while a drag is on and nothing on this node can take it (the node it started from is never dimmed). */
export function useNodeBlocked(nodeId: string, type: string): boolean {
  const from = useDragFrom();
  if (!from || from.nodeId === nodeId) return false;
  const template = getTemplate(type);
  if (!template) return false;
  const s = useWorkflows.getState();
  return !nodeAcceptsDrag(s.nodes, s.edges, from, nodeId, template);
}

/** A React Flow handle that shows whether it can take the connection being dragged. */
export function AssistHandle({ nodeId, className, style, ...props }: HandleProps & { nodeId: string; className?: string; style?: CSSProperties }) {
  const state = useHandleAssist(nodeId, props.id ?? '', props.type);
  return <Handle {...props} className={cx(className, state === 'ok' && 'is-ok', state === 'blocked' && 'is-blocked', state === 'origin' && 'is-origin')} style={style} />;
}
