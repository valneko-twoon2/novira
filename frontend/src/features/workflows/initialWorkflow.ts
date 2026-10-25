// Loads the default text-to-image workflow the first time the Workflows tab is shown with nothing loaded.
import { useEffect } from 'react';
import { useWorkflows } from '@/state/workflows/workflows';
import { graphForLibraryItem } from './actions';

const INITIAL_ID = 'default-t2i-sd15';
let done = false;

export function useInitialWorkflow() {
  // The library arrives with the backend's start-up data; until then there is nothing to choose from, so keep waiting.
  const library = useWorkflows((s) => s.library);
  useEffect(() => {
    if (done || library.length === 0) return;
    const s = useWorkflows.getState();
    done = true;
    if (s.nodes.length || s.isTouched || s.graphNonce > 0) return;
    const wf = library.find((w) => w.id === INITIAL_ID);
    const graph = wf ? graphForLibraryItem(wf) : null;
    if (!graph || !wf) return;
    s.setGraph(graph);
    s.pushRecent(wf.id);
  }, [library]);
}
