// How the node library in the left panel puts a node on the canvas, which lives in another part of the tree: the editor
// registers where nodes go (the middle of what is on screen), the library calls `addLibraryNode` or drags with `NODE_MIME`.
import { useWorkflows } from '@/state/workflows/workflows';
import { createNode } from './graph';
import type { NodeTemplate } from './templates';

/** Drag data of a node type dragged from the library onto the canvas. */
export const NODE_MIME = 'application/x-novira-node';

type Adder = (template: NodeTemplate) => void;
let adder: Adder | null = null;

/** The editor says how a node is added when the library asks. Returns the way to take it back. */
export function registerNodeAdder(fn: Adder): () => void {
  adder = fn;
  return () => {
    if (adder === fn) adder = null;
  };
}

/** Adds a node. With no editor on screen it goes to the origin, so a click is never lost. */
export function addLibraryNode(template: NodeTemplate): void {
  if (adder) adder(template);
  else useWorkflows.getState().addNodes([{ ...createNode(template, { x: 0, y: 0 }), selected: true }], []);
}
