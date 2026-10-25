// A workflow graph that reproduces how a plain generation was made, built from the settings kept with its image
// (model, prompts, seed, steps, CFG, scheduler, size, LoRAs, VAE). Opening it lets the user change the generation
// step by step in the editor. Running it gives the same request the generation screen sent.
import type { BaseModel, GenerationMetadata, ImageDTO, ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { EMPTY_META, type EditorGraph } from '@/state/workflows/workflows';
import { GraphBuilder } from './defaultGraphs';

/** Modes that start from the model alone. The others also need a source picture or a mask the graph cannot recover. */
const FROM_SCRATCH = ['txt2img'] as const;
/** Modes whose text-to-image part is still worth opening (the source picture is added by hand). */
const WITH_SOURCE = ['img2img', 'inpaint', 'outpaint'] as const;

export interface ImageGraph {
  graph: EditorGraph;
  /** Settings of the generation that the graph does not carry (shown to the user once). */
  lost: string[];
}

function baseOf(models: ModelConfig[], key: string): BaseModel | null {
  const base = models.find((m) => m.key === key)?.base;
  return base === 'sdxl' || base === 'sd-1' ? base : null;
}

/** Whether the image can be turned into a graph: a still made from a model of a family the graph nodes cover. */
export function canBuildFromImage(image: ImageDTO, models: ModelConfig[]): boolean {
  const m = image.metadata;
  if (!m || (image.mediaType && image.mediaType !== 'image')) return false;
  const mode = m.generationMode;
  if (!(FROM_SCRATCH as readonly string[]).includes(mode) && !(WITH_SOURCE as readonly string[]).includes(mode)) return false;
  return baseOf(models, m.modelKey) !== null;
}

function lostSettings(m: GenerationMetadata): string[] {
  const lost: string[] = [];
  if ((WITH_SOURCE as readonly string[]).includes(m.generationMode)) lost.push(t('workflows.fromImage.lost.source'));
  if (m.clipSkip > 0) lost.push(t('workflows.fromImage.lost.clipSkip'));
  if (m.cfgRescale > 0) lost.push(t('workflows.fromImage.lost.cfgRescale'));
  if (m.seamlessX || m.seamlessY) lost.push(t('workflows.fromImage.lost.seamless'));
  if ((m.refImageCount ?? 0) > 0) lost.push(t('workflows.fromImage.lost.refImages'));
  if ((m.controlLayerCount ?? 0) > 0) lost.push(t('workflows.fromImage.lost.controlLayers'));
  if ((m.regionalGuidanceCount ?? 0) > 0) lost.push(t('workflows.fromImage.lost.regional'));
  return lost;
}

export function graphFromImage(image: ImageDTO, models: ModelConfig[]): ImageGraph | null {
  const m = image.metadata;
  if (!m || !canBuildFromImage(image, models)) return null;
  const sdxl = baseOf(models, m.modelKey) === 'sdxl';
  const b = new GraphBuilder();

  const loader = b.node(sdxl ? 'sdxl_model_loader' : 'main_model_loader', 0, 120, { model: m.modelKey });
  const promptType = sdxl ? 'sdxl_compel_prompt' : 'compel';
  const pos = b.node(promptType, 380, -260, { prompt: m.positivePrompt }, t('workflows.defaults.positivePrompt'));
  const neg = b.node(promptType, 380, 120, { prompt: m.negativePrompt }, t('workflows.defaults.negativePrompt'));
  const noise = b.node('noise', 380, 520, { seed: m.seed, width: m.width, height: m.height });
  const denoise = b.node('denoise_latents', 760, 0, { steps: m.steps, cfg_scale: m.cfgScale, scheduler: m.scheduler });
  const decode = b.node('l2i', 1140, 120);
  const save = b.node('save_image', 1520, 120);

  // The LoRAs form a chain between the model loader and everything that reads its UNet and text encoder.
  let unet: [string, string] = [loader, 'unet'];
  let clip: [string, string] = [loader, 'clip'];
  m.loras
    .filter((l) => l.isEnabled)
    .forEach((l, i) => {
      const node = b.node('lora_loader', 380 + i * 380, 700, { lora: l.key, weight: l.weight });
      b.edge(unet[0], unet[1], node, 'unet');
      b.edge(clip[0], clip[1], node, 'clip');
      unet = [node, 'unet'];
      clip = [node, 'clip'];
    });

  for (const p of [pos, neg]) {
    b.edge(clip[0], clip[1], p, 'clip');
    if (sdxl) b.edge(loader, 'clip2', p, 'clip2');
  }
  b.edge(unet[0], unet[1], denoise, 'unet');
  if (m.vaeKey) {
    const vae = b.node('vae_loader', 760, 520, { vae_model: m.vaeKey });
    b.edge(vae, 'vae', decode, 'vae');
  } else {
    b.edge(loader, 'vae', decode, 'vae');
  }
  b.edge(pos, 'conditioning', denoise, 'positive_conditioning');
  b.edge(neg, 'conditioning', denoise, 'negative_conditioning');
  b.edge(noise, 'noise', denoise, 'noise');
  b.edge(denoise, 'latents', decode, 'latents');
  b.edge(decode, 'image', save, 'image');

  b.expose(loader, 'model');
  b.expose(pos, 'prompt');
  b.expose(neg, 'prompt');
  b.expose(noise, 'seed');
  b.expose(noise, 'width');
  b.expose(noise, 'height');
  b.expose(denoise, 'steps');
  b.expose(denoise, 'cfg_scale');

  return {
    graph: { nodes: b.nodes, edges: b.edges, form: b.form, meta: { ...EMPTY_META, name: t('workflows.fromImage.name', { name: image.name }) } },
    lost: lostSettings(m),
  };
}
