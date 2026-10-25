// Field types of node inputs/outputs and the connection compatibility rules between them.
import type { BaseModel, ModelType } from '@/backend';

export type FieldType =
  | 'integer'
  | 'float'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'SchedulerField'
  | 'ImageField'
  | 'LatentsField'
  | 'ConditioningField'
  | 'UNetField'
  | 'CLIPField'
  | 'VAEField'
  | 'NoiseField'
  | 'ControlField'
  | 'IPAdapterField'
  | 'MainModelField'
  | 'LoRAModelField'
  | 'VAEModelField'
  | 'ControlNetModelField'
  | 'IPAdapterModelField'
  | 'SpandrelModelField'
  | 'BoardField'
  | 'Collection'
  | 'Any'
  /** A connection type of a custom node pack with no editor counterpart (e.g. `comfy:MASK`). */
  | `comfy:${string}`;

/** Model selector field types and the model type/base they list. */
export const MODEL_FIELDS: Partial<Record<FieldType, { modelType: ModelType }>> = {
  MainModelField: { modelType: 'main' },
  LoRAModelField: { modelType: 'lora' },
  VAEModelField: { modelType: 'vae' },
  ControlNetModelField: { modelType: 'controlnet' },
  IPAdapterModelField: { modelType: 'ip_adapter' },
  SpandrelModelField: { modelType: 'spandrel_image_to_image' },
};

export type BaseFilter = BaseModel | null;

/** Whether an output of type `from` may feed an input of type `to`. */
export function isCompatible(from: FieldType, to: FieldType): boolean {
  if (from === to) return true;
  if (from === 'Any' || to === 'Any') return true;
  if (from === 'integer' && to === 'float') return true;
  // A collection feeds collection inputs of any item type and vice versa an iterate item is 'Any'.
  if (to === 'Collection') return from === 'Collection';
  return false;
}

/** CSS custom property holding the color of a field type (defined in workflows.css). */
export function typeColorVar(type: FieldType): string {
  return type.startsWith('comfy:') ? 'var(--wf-c-comfy)' : `var(--wf-c-${type})`;
}
