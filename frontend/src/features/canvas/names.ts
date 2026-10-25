// Display names for entities and labels for enum values (translated on read, never at module load).
import { t, type MessageKey } from '@/i18n';
import type { CanvasEntity, ControlMode, EntityType, FilterType, MaskFill, RasterBlend, Tool } from '@/state/canvas';
import type { RefImageMethod } from '@/state/params';

const DEFAULT_NAME: Record<EntityType, MessageKey> = {
  raster: 'canvas.entity.defaultName.raster',
  control: 'canvas.entity.defaultName.control',
  inpaint: 'canvas.entity.defaultName.inpaint',
  regional: 'canvas.entity.defaultName.regional',
};

export const GROUP_TITLE: Record<EntityType, MessageKey> = {
  raster: 'canvas.groups.raster',
  control: 'canvas.groups.control',
  inpaint: 'canvas.groups.inpaint',
  regional: 'canvas.groups.regional',
};

export const ADD_LABEL: Record<EntityType, MessageKey> = {
  raster: 'canvas.add.raster',
  control: 'canvas.add.control',
  inpaint: 'canvas.add.inpaint',
  regional: 'canvas.add.regional',
};

export function displayName(e: CanvasEntity): string {
  return e.name ?? t(DEFAULT_NAME[e.type], { number: e.seq });
}

export const TOOL_LABEL: Record<Tool, MessageKey> = {
  brush: 'canvas.tool.brush',
  eraser: 'canvas.tool.eraser',
  mosaic: 'canvas.tool.mosaic',
  rect: 'canvas.tool.rect',
  lasso: 'canvas.tool.lasso',
  pose: 'canvas.tool.pose',
  move: 'canvas.tool.move',
  bbox: 'canvas.tool.bbox',
  view: 'canvas.tool.view',
  colorPicker: 'canvas.tool.colorPicker',
  bucket: 'canvas.tool.bucket',
};

export const FILTER_LABEL: Record<FilterType, MessageKey> = {
  none: 'canvas.filter.none',
  canny: 'canvas.filter.canny',
  hed: 'canvas.filter.hed',
  lineart: 'canvas.filter.lineart',
  depth: 'canvas.filter.depth',
  normal: 'canvas.filter.normal',
  color_map: 'canvas.filter.colorMap',
};

export const CONTROL_MODE_LABEL: Record<ControlMode, MessageKey> = {
  balanced: 'canvas.control.mode.balanced',
  more_prompt: 'canvas.control.mode.morePrompt',
  more_control: 'canvas.control.mode.moreControl',
};

export const FILL_LABEL: Record<MaskFill, MessageKey> = {
  solid: 'canvas.mask.fill.solid',
  diagonal: 'canvas.mask.fill.diagonal',
  crosshatch: 'canvas.mask.fill.crosshatch',
  grid: 'canvas.mask.fill.grid',
  horizontal: 'canvas.mask.fill.horizontal',
  vertical: 'canvas.mask.fill.vertical',
};

export const BLEND_LABEL: Record<RasterBlend, MessageKey> = {
  normal: 'canvas.entity.blend.normal',
  multiply: 'canvas.entity.blend.multiply',
  screen: 'canvas.entity.blend.screen',
};

export const METHOD_LABEL: Record<RefImageMethod, MessageKey> = {
  full: 'canvas.ref.method.full',
  style: 'canvas.ref.method.style',
  composition: 'canvas.ref.method.composition',
  style_strong: 'canvas.ref.method.styleStrong',
  style_precise: 'canvas.ref.method.stylePrecise',
};
