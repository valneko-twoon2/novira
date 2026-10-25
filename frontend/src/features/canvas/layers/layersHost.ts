// What the screen showing the layers panel allows in it. The Image tab uses the defaults; another host (a comic page)
// narrows the layer kinds, hides the global reference images and names the slots it draws.
import { createContext, useContext } from 'react';
import { ENTITY_TYPES, type CanvasEntity, type EntityType } from '@/state/canvas';
import { displayName } from '../names';

export interface LayersHost {
  /** The layer kinds the panel may add; all of them when absent. */
  addable?: EntityType[];
  /** Hides the global reference images group and its add item. */
  hideGlobalRefs?: boolean;
  /** The label of each slot row, by slot name; the layer's own name when a slot is not listed. */
  slotLabels?: Record<string, string>;
  /** Why a layer of this kind cannot be added now (a limit is reached), or null; the add items are disabled with it shown. */
  addBlocked?: (entities: CanvasEntity[], type: EntityType) => string | null;
}

const DEFAULT_HOST: LayersHost = {};

export const LayersHostContext = createContext<LayersHost>(DEFAULT_HOST);

export const useLayersHost = (): LayersHost => useContext(LayersHostContext);

/** Whether the host lets the panel add layers of this kind. */
export const canAdd = (host: LayersHost, type: EntityType): boolean => (host.addable ?? ENTITY_TYPES).includes(type);

/** The name shown on a layer's row: the host's label for a slot, else the layer's name. */
export function rowLabel(host: LayersHost, e: CanvasEntity): string {
  const slot = e.type === 'raster' ? e.slot : undefined;
  return (slot !== undefined && host.slotLabels?.[slot]) || displayName(e);
}
