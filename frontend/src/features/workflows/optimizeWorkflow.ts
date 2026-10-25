// Runs the graph optimizer on the workflow being edited as one undo step, and re-runs it on its own after the user
// adds or removes nodes or connections while the editor's "tidy automatically" setting is on.
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useWorkflows } from '@/state/workflows/workflows';
import { optimizeGraph, type OptimizeSummary } from './optimizeGraph';

export const AUTO_OPTIMIZE_DELAY_MS = 600;

/**
 * Optimizes the open graph. The automatic run is gentler: it removes nothing for being unconnected and leaves nodes
 * alone until their outputs are wired, so a node just added is not merged away before the user sets it up.
 * Returns what changed, or null when nothing did.
 */
export function optimizeWorkflow(mode: 'manual' | 'auto' = 'manual'): OptimizeSummary | null {
  const auto = mode === 'auto';
  const s = useWorkflows.getState();
  const result = optimizeGraph(s, auto ? { removeDead: false, onlyWired: true } : {});
  if (!result.changed) {
    if (!auto) toast({ status: 'info', title: t('workflows.optimize.nothing') });
    return null;
  }
  s.commitGraph(result.graph);
  const { merged, removed, edgesRemoved } = result.summary;
  const structural = merged + removed + edgesRemoved > 0;
  const description = t('workflows.optimize.summary', { merged, removed, edges: edgesRemoved });
  if (!auto) toast({ status: 'success', title: t('workflows.optimize.done'), description: structural ? description : t('workflows.optimize.layoutOnly') });
  // Moving nodes into place needs no message; a merge does, so the user knows it can be undone.
  else if (structural) toast({ status: 'info', title: t('workflows.optimize.autoDone'), description });
  return result.summary;
}

/**
 * Schedules an automatic run `delayMs` after each structural edit (adding or removing nodes or connections; not moves
 * or field edits). While `isBusy()` (a drag or a connection in progress) the run waits. Opening another graph or an
 * undo cancels a waiting run. Returns the function that stops it.
 */
export function startAutoOptimize(isBusy: () => boolean = () => false, delayMs = AUTO_OPTIMIZE_DELAY_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const run = () => {
    timer = undefined;
    const s = useWorkflows.getState();
    if (!s.settings.autoTidy) return;
    if (isBusy() || s.nodes.some((n) => n.dragging)) {
      timer = setTimeout(run, delayMs);
      return;
    }
    optimizeWorkflow('auto');
  };
  const unsubscribe = useWorkflows.subscribe((s, prev) => {
    const undone = s.past.length < prev.past.length;
    if (s.graphNonce !== prev.graphNonce || undone) {
      cancel();
      return;
    }
    if (s.structureNonce === prev.structureNonce || !s.settings.autoTidy) return;
    cancel();
    timer = setTimeout(run, delayMs);
  });
  return () => {
    unsubscribe();
    cancel();
  };
}
