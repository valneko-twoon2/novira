// What the phone's canvas editor does to the canvas store: a picture opens alone on a fresh canvas with an empty inpaint
// mask, and its three tools (a mosaic on the picture, painting the mask, wiping the mask) each pick the tool and the layer
// it works on. The left form's size is left alone: the editor works on the picture, not on the next generation's size.
import type { ImageDTO } from '@/backend';
import { newId, useCanvas, type CanvasEntity, type CanvasStore, type Tool } from '@/state/canvas';
import { containIn } from '../geometry';
import { acceptStaged, discardAllStaged } from '../actions';

export const PHONE_TOOLS = ['mosaic', 'mask', 'unmask'] as const;
export type PhoneTool = (typeof PHONE_TOOLS)[number];

/** The canvas tool each phone tool paints with, and the kind of layer it paints on. */
const TOOL_OF: Record<PhoneTool, { tool: Tool; on: 'raster' | 'inpaint' }> = {
  mosaic: { tool: 'mosaic', on: 'raster' },
  mask: { tool: 'brush', on: 'inpaint' },
  unmask: { tool: 'eraser', on: 'inpaint' },
};

/** The picture on top (an accepted result lies over the picture it came from), or the inpaint mask. */
function layerFor(entities: CanvasEntity[], on: 'raster' | 'inpaint'): CanvasEntity | undefined {
  return entities.filter((e) => e.type === on).at(-1);
}

/** The inpaint mask the editor paints, if there is one. */
export const phoneMask = (entities: CanvasEntity[]) => layerFor(entities, 'inpaint');

/** Puts the phone tool in hand: its canvas tool, and its layer selected (a mask is made when there is none). */
export function takePhoneTool(tool: PhoneTool, store: CanvasStore = useCanvas) {
  const { tool: canvasTool, on } = TOOL_OF[tool];
  const s = store.getState();
  const layer = layerFor(s.entities, on);
  if (layer) s.select(layer.id);
  else if (on === 'inpaint') s.addEntity('inpaint');
  store.getState().setTool(canvasTool);
}

/** The phone tool the canvas is in now, or null when its tool is none of them. */
export function phoneToolOf(tool: Tool): PhoneTool | null {
  return PHONE_TOOLS.find((x) => TOOL_OF[x].tool === tool) ?? null;
}

/**
 * Opens `image` alone on a fresh canvas: the box is the picture, an empty inpaint mask waits over it, the results of
 * earlier work are discarded and the mosaic is in hand. Undo starts here. The box and the left form's size stop
 * following each other until `closePhoneEdit`.
 */
export function openForPhoneEdit(image: ImageDTO, store: CanvasStore = useCanvas) {
  discardAllStaged(store);
  const s = store.getState();
  s.setSizeSync(false);
  s.clearCanvas();
  s.setBbox({ x: 0, y: 0, width: image.width, height: image.height }, { history: false, syncParams: false });
  const fit = containIn(image.width, image.height, store.getState().bbox);
  s.addEntity('raster', { objects: [{ kind: 'image', id: newId('img'), url: image.url, imageName: image.name, ...fit }] });
  s.addEntity('inpaint');
  takePhoneTool('mosaic', store);
  store.getState().clearHistory();
}

/**
 * Takes the shown result as a layer over the picture. Its painted part is done, so the mask is wiped for the next part,
 * and the tool in hand goes on with the right layer.
 */
export function acceptOnPhone(store: CanvasStore = useCanvas) {
  const before = store.getState().tool;
  acceptStaged(store);
  const s = store.getState();
  const mask = layerFor(s.entities, 'inpaint');
  if (mask?.objects.length) s.updateEntity(mask.id, { objects: [] }, { history: false });
  takePhoneTool(phoneToolOf(before) ?? 'mosaic', store);
}

/** Ends the editing: the box and the left form's size follow each other again. The canvas keeps what was done. */
export function closePhoneEdit(store: CanvasStore = useCanvas) {
  store.getState().setSizeSync(true);
}
