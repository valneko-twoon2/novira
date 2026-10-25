// Picks sensible defaults once models are known (upscale and tile models). The main model is never chosen for the user; the
// one chosen is kept across starts and only dropped when it is gone.
import type { ModelConfig } from '@/backend';
import { isDrawable, modelsOfType, useModels } from '@/state/models';
import { useParams } from '@/state/params';

function pickTileControlnet(models: ModelConfig[], base: ModelConfig['base'] | undefined): string | null {
  if (!base) return null;
  const list = modelsOfType(models, 'controlnet', base);
  return (list.find((m) => /tile/i.test(m.name)) ?? list[0])?.key ?? null;
}

export function autoSelectModels() {
  const models = useModels.getState().models;
  if (!models.length) return;
  const p = useParams.getState();
  const main = models.find((m) => m.key === p.modelKey && isDrawable(m));
  if (!main && p.modelKey) p.set({ modelKey: null });
  const u = useParams.getState().upscale;
  const patch: Partial<typeof u> = {};
  if (!u.upscaleModelKey || !models.some((m) => m.key === u.upscaleModelKey)) {
    patch.upscaleModelKey = modelsOfType(models, 'spandrel_image_to_image')[0]?.key ?? null;
  }
  const tile = models.find((m) => m.key === u.tileControlnetModelKey);
  if (!tile || (main && tile.base !== main.base && tile.base !== 'any')) {
    patch.tileControlnetModelKey = pickTileControlnet(models, main?.base);
  }
  if (u.postProcessingModelKey && !modelsOfType(models, 'spandrel_image_to_image').some((m) => m.key === u.postProcessingModelKey)) {
    patch.postProcessingModelKey = null;
  }
  if (patch.upscaleModelKey !== undefined && patch.upscaleModelKey === u.upscaleModelKey) delete patch.upscaleModelKey;
  if (patch.tileControlnetModelKey !== undefined && patch.tileControlnetModelKey === u.tileControlnetModelKey) delete patch.tileControlnetModelKey;
  if (Object.keys(patch).length) useParams.getState().setUpscale(patch);
}
