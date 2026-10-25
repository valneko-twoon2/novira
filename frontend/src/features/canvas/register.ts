// Registers the canvas Invoke builder, the shared importImage action and the bbox <-> params size sync.
import { t } from '@/i18n';
import { useCanvas, type CanvasEntity, type CanvasState } from '@/state/canvas';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { refImagesPackReason } from '@/state/comfy/packNeeds';
import { registerDragSource } from '@/state/dnd';
import { registerInvokeBuilder } from '@/state/invoke';
import { findModel, useModels } from '@/state/models';
import { useParams, type ParamsState } from '@/state/params';
import { CANVAS_LAYER_DRAG, CANVAS_STAGED_DRAG } from './dragSources';
import { registerAgentEditor } from '@/state/agent';
import { entityAsGalleryImage, importImage, posesForAssistant, setPoses, stagedAsGalleryImage } from './actions';
import { canvasRenderer } from './render/generationInputs';
import { buildCanvasRequest } from './request';

let registered = false;

/** Reasons why the canvas cannot be invoked right now (empty = ready). */
export function canvasReadiness(s: Pick<CanvasState, 'entities' | 'groupHidden'>, p: Pick<ParamsState, 'modelKey' | 'refImages'>): string[] {
  const reasons: string[] = [];
  if (!p.modelKey || !findModel(p.modelKey)) reasons.push(t('canvas.readiness.noModel'));
  const active = s.entities.filter((e) => e.isEnabled && !s.groupHidden[e.type]);
  for (const e of active) {
    if (e.type === 'control' && !e.modelKey) reasons.push(t('canvas.readiness.controlNoModel', { number: e.seq }));
    if (e.type === 'regional') {
      const hasPrompt = !!e.positivePrompt?.trim() || !!e.negativePrompt?.trim();
      if (!hasPrompt && !e.refImages.length) reasons.push(t('canvas.readiness.regionalEmpty', { number: e.seq }));
      if (e.refImages.some((r) => !r.imageUrl || !r.modelKey)) reasons.push(t('canvas.readiness.regionalRefIncomplete', { number: e.seq }));
    }
  }
  p.refImages.forEach((r, i) => {
    if (r.isEnabled && (!r.imageUrl || !r.modelKey)) reasons.push(t('canvas.readiness.refIncomplete', { number: i + 1 }));
  });
  const packReason = refImagesPackReason(p.refImages);
  if (packReason) reasons.push(packReason);
  return reasons;
}

export function registerCanvasFeature() {
  if (registered) return;
  registered = true;

  useCanvas.setState({ importImage });
  // Layers and the staged result can be dragged onto any image target; they reach the gallery when dropped.
  registerDragSource(CANVAS_LAYER_DRAG, (id) => entityAsGalleryImage(id));
  registerDragSource(CANVAS_STAGED_DRAG, () => stagedAsGalleryImage());

  // Keep the bbox size in sync with the width/height parameters.
  useParams.subscribe((p, prev) => {
    if (p.width === prev.width && p.height === prev.height) return;
    const { bbox, setBbox } = useCanvas.getState();
    if (bbox.width === p.width && bbox.height === p.height) return;
    setBbox({ ...bbox, width: p.width, height: p.height }, { history: false, syncParams: false });
  });

  // The assistant can place and change poses on a control layer (and undo it with the rest of its answer).
  registerAgentEditor('canvas', {
    context: () => posesForAssistant(),
    apply: (ops) => {
      const op = ops[0] as { people?: unknown; add?: unknown } | undefined;
      return Array.isArray(op?.people) && setPoses(op.people, op.add === true);
    },
    snapshot: () => ({ entities: useCanvas.getState().entities, selectedEntityId: useCanvas.getState().selectedEntityId }),
    restore: (snapshot) => {
      const { entities, selectedEntityId } = snapshot as { entities: CanvasEntity[]; selectedEntityId: string | null };
      useCanvas.getState().replaceEntities(entities);
      useCanvas.getState().select(selectedEntityId);
    },
  });

  registerInvokeBuilder('canvas', {
    readiness: () => canvasReadiness(useCanvas.getState(), useParams.getState()),
    build: ({ prepend }) => buildCanvasRequest(useCanvas.getState(), useParams.getState(), prepend, canvasRenderer),
    subscribe: (onChange) => {
      const a = useParams.subscribe((s, prev) => (s.modelKey !== prev.modelKey || s.refImages !== prev.refImages) && onChange());
      const b = useCanvas.subscribe((s, prev) => (s.entities !== prev.entities || s.groupHidden !== prev.groupHidden) && onChange());
      const c = useModels.subscribe((s, prev) => s.models !== prev.models && onChange());
      // Reference images wait for their node pack.
      const d = useNodePacks.subscribe((s, prev) => s.packs !== prev.packs && onChange());
      return () => {
        a();
        b();
        c();
        d();
      };
    },
  });
}
