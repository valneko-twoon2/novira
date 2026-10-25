// Lets the AI assistant read and change the text editor's scene.
import { registerAgentEditor } from '@/state/agent';
import { useTextEditor } from '@/state/text/textEditor';
import type { Scene } from '@/state/text/textModel';
import { applyTextOps, textContext } from './aiOps';

export function registerTextFeature() {
  registerAgentEditor('text', {
    context: () => {
      const s = useTextEditor.getState();
      return textContext(s.scene, s.selectedId);
    },
    apply: (ops) => {
      const s = useTextEditor.getState();
      const result = applyTextOps(s.scene, ops, s.selectedId);
      if (result.applied === 0) return false;
      // One undo step in the editor for everything the assistant changed.
      s.checkpoint();
      useTextEditor.setState({ scene: result.scene, selectedId: result.selectedId });
      return true;
    },
    snapshot: () => useTextEditor.getState().scene,
    restore: (scene) => useTextEditor.setState({ scene: scene as Scene, selectedId: null }),
  });
}
