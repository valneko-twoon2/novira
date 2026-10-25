// What the NKD Face Rig node shows under its fields: a button that opens the editor on the picture feeding the node.
import { Smiley } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useWorkflows } from '@/state/workflows/workflows';
import { Button } from '@/ui';
import { incomingEdge } from '../graph';
import { FaceRigEditor } from './FaceRigEditor';
import { adjustedCount, parseRig } from './rig';

/** The gallery picture that feeds `nodeId`'s image input, when it comes straight from an Image node. */
function sourcePicture(nodes: ReturnType<typeof useWorkflows.getState>['nodes'], edges: ReturnType<typeof useWorkflows.getState>['edges'], nodeId: string): string | null {
  const edge = incomingEdge(edges, nodeId, 'image');
  const source = edge ? nodes.find((n) => n.id === edge.source) : undefined;
  if (source?.data.type !== 'image') return null;
  const name = source.data.inputs.image;
  return typeof name === 'string' && name ? name : null;
}

export function FaceRigNodeWidget({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false);
  const picture = useWorkflows((s) => sourcePicture(s.nodes, s.edges, nodeId));
  const rig = useWorkflows((s) => {
    const v = s.nodes.find((n) => n.id === nodeId)?.data.inputs.rig;
    return typeof v === 'string' ? v : '';
  });
  const setValue = useWorkflows((s) => s.setFieldValue);
  const count = adjustedCount(parseRig(rig));
  return (
    <div className="wf-widget nodrag">
      <Button size="sm" variant="solid" leftIcon={<Smiley size={14} />} disabled={!picture} onClick={() => setOpen(true)} data-testid="rig-open">
        {t('workflows.faceRig.open')}
      </Button>
      <span className="wf-widget__note">{picture ? t('workflows.faceRig.adjusted', { count }) : t('workflows.faceRig.needsImage')}</span>
      <FaceRigEditor open={open} onOpenChange={setOpen} imageName={picture} rig={rig} onApply={(next) => setValue(nodeId, 'rig', next)} />
    </div>
  );
}
