// Fixture data for the mock backend. Model and board names are engine/user data, not UI text.
import type { BoardDTO, ModelConfig, SavedWorkflow, StarterModel } from '../types';
import { mockPicture } from './mockPictures';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** A flat picture of the given shape: what a model with several pictures of different shapes looks like. */
const shape = (width: number, height: number, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`;

export const SEED_MODELS: ModelConfig[] = [
  {
    key: 'main-juggernaut-xl',
    name: 'Juggernaut XL v9',
    base: 'sdxl',
    type: 'main',
    format: 'checkpoint',
    description: 'Photorealistic SDXL checkpoint.',
    path: 'sdxl/main/juggernautXL_v9.safetensors',
    size: 6.9 * GB,
    source: 'https://civitai.com/models/133005',
    defaultSettings: { steps: 30, cfgScale: 6, scheduler: 'dpmpp_2m_k', width: 1024, height: 1024 },
    coverImageUrls: [mockPicture('main-juggernaut-xl'), shape(640, 360, '#3b5b8c'), shape(360, 640, '#8c3b5b')],
    triggerPhrases: [],
    license: {
      site: 'civitai',
      commercial: 'limited',
      permissions: [
        { key: 'sellImages', allowed: true },
        { key: 'generationServices', allowed: true },
        { key: 'sellModel', allowed: false },
        { key: 'shareMerges', allowed: true },
        { key: 'differentLicense', allowed: null },
        { key: 'noCredit', allowed: false },
      ],
    },
  },
  {
    key: 'main-dreamshaper-8',
    name: 'Dreamshaper 8',
    base: 'sd-1',
    type: 'main',
    format: 'diffusers',
    description: 'Versatile SD 1.5 model.',
    path: 'sd-1/main/dreamshaper-8',
    size: 2.1 * GB,
    source: 'Lykon/dreamshaper-8',
    defaultSettings: { steps: 25, cfgScale: 7, scheduler: 'euler_a', width: 512, height: 768 },
  },
  {
    key: 'main-flux-schnell',
    name: 'FLUX Schnell (Quantized)',
    base: 'flux',
    type: 'main',
    format: 'bnb_quantized',
    description: 'Fast FLUX model, 4 steps.',
    path: 'flux/main/flux1-schnell-bnb_nf4.safetensors',
    size: 11.9 * GB,
    source: 'InvokeAI/flux_schnell::transformer/bnb_nf4/flux1-schnell-bnb_nf4.safetensors',
    defaultSettings: { steps: 4, cfgScale: 1, scheduler: 'euler', width: 1024, height: 1024 },
  },
  {
    key: 'main-noobai-xl',
    name: 'NoobAI-XL v1.1',
    base: 'sdxl',
    type: 'main',
    format: 'checkpoint',
    description: 'Anime-focused SDXL model.',
    path: 'sdxl/main/noobaiXL_v11.safetensors',
    size: 6.5 * GB,
    source: 'https://civitai.com/models/833294',
    defaultSettings: { steps: 28, cfgScale: 5, scheduler: 'euler_a', width: 832, height: 1216 },
  },
  { key: 'vae-sdxl-fp16', name: 'sdxl-vae-fp16-fix', base: 'sdxl', type: 'vae', format: 'diffusers', description: '', path: 'sdxl/vae/sdxl-vae-fp16-fix', size: 320 * MB, source: 'madebyollin/sdxl-vae-fp16-fix' },
  { key: 'vae-sd1-ft-mse', name: 'sd-vae-ft-mse', base: 'sd-1', type: 'vae', format: 'diffusers', description: '', path: 'sd-1/vae/sd-vae-ft-mse', size: 320 * MB, source: 'stabilityai/sd-vae-ft-mse' },
  { key: 'vae-flux', name: 'FLUX.1-schnell VAE', base: 'flux', type: 'vae', format: 'checkpoint', description: '', path: 'flux/vae/ae.safetensors', size: 320 * MB, source: 'black-forest-labs/FLUX.1-schnell::ae.safetensors' },
  { key: 'lora-add-detail-xl', name: 'Add Detail XL', base: 'sdxl', type: 'lora', format: 'lycoris', description: 'Adds fine detail.', path: 'sdxl/lora/add-detail-xl.safetensors', size: 220 * MB, source: 'https://civitai.com/models/122359', triggerPhrases: [] },
  { key: 'lora-pixel-art-xl', name: 'Pixel Art XL', base: 'sdxl', type: 'lora', format: 'lycoris', description: '', path: 'sdxl/lora/pixel-art-xl.safetensors', size: 170 * MB, source: 'nerijs/pixel-art-xl', triggerPhrases: ['pixel art'] },
  { key: 'lora-watercolor-sd1', name: 'Watercolor Style', base: 'sd-1', type: 'lora', format: 'lycoris', description: '', path: 'sd-1/lora/watercolor.safetensors', size: 144 * MB, source: 'https://civitai.com/models/4440', triggerPhrases: ['watercolor'] },
  { key: 'lora-flux-realism', name: 'FLUX Realism', base: 'flux', type: 'lora', format: 'lycoris', description: '', path: 'flux/lora/flux-realism.safetensors', size: 22 * MB, source: 'XLabs-AI/flux-RealismLora' },
  { key: 'cn-canny-sd1', name: 'canny', base: 'sd-1', type: 'controlnet', format: 'diffusers', description: '', path: 'sd-1/controlnet/canny', size: 1.4 * GB, source: 'lllyasviel/control_v11p_sd15_canny' },
  { key: 'cn-depth-sd1', name: 'depth', base: 'sd-1', type: 'controlnet', format: 'diffusers', description: '', path: 'sd-1/controlnet/depth', size: 1.4 * GB, source: 'lllyasviel/control_v11f1p_sd15_depth' },
  { key: 'cn-openpose-sd1', name: 'openpose', base: 'sd-1', type: 'controlnet', format: 'diffusers', description: '', path: 'sd-1/controlnet/openpose', size: 1.4 * GB, source: 'lllyasviel/control_v11p_sd15_openpose' },
  { key: 'cn-union-sdxl', name: 'controlnet-union-promax-sdxl', base: 'sdxl', type: 'controlnet', format: 'diffusers', description: 'Union ControlNet for SDXL.', path: 'sdxl/controlnet/union-promax', size: 2.5 * GB, source: 'xinsir/controlnet-union-sdxl-1.0' },
  { key: 'cn-tile-sdxl', name: 'controlnet-tile-sdxl', base: 'sdxl', type: 'controlnet', format: 'diffusers', description: '', path: 'sdxl/controlnet/tile', size: 2.5 * GB, source: 'xinsir/controlnet-tile-sdxl-1.0' },
  { key: 'cn-tile-sd1', name: 'tile', base: 'sd-1', type: 'controlnet', format: 'diffusers', description: '', path: 'sd-1/controlnet/tile', size: 1.4 * GB, source: 'lllyasviel/control_v11f1e_sd15_tile' },
  { key: 't2i-sketch-sdxl', name: 't2i-adapter-sketch-sdxl', base: 'sdxl', type: 't2i_adapter', format: 'diffusers', description: '', path: 'sdxl/t2i_adapter/sketch', size: 300 * MB, source: 'TencentARC/t2i-adapter-sketch-sdxl-1.0' },
  { key: 'ipa-plus-sd1', name: 'IP Adapter Plus', base: 'sd-1', type: 'ip_adapter', format: 'invokeai', description: '', path: 'sd-1/ip_adapter/ip_adapter_plus_sd15', size: 98 * MB, source: 'InvokeAI/ip_adapter_plus_sd15' },
  { key: 'ipa-sdxl', name: 'Standard Reference (IP Adapter ViT-H)', base: 'sdxl', type: 'ip_adapter', format: 'invokeai', description: '', path: 'sdxl/ip_adapter/ip-adapter_sdxl_vit-h', size: 700 * MB, source: 'InvokeAI/ip-adapter_sdxl_vit-h' },
  { key: 'ipa-flux', name: 'Standard Reference (XLabs FLUX IP-Adapter v2)', base: 'flux', type: 'ip_adapter', format: 'checkpoint', description: '', path: 'flux/ip_adapter/ip_adapter_v2.safetensors', size: 1 * GB, source: 'XLabs-AI/flux-ip-adapter-v2' },
  { key: 'clipvision-vith', name: 'ViT-H', base: 'any', type: 'clip_vision', format: 'diffusers', description: '', path: 'any/clip_vision/ViT-H', size: 2.5 * GB, source: 'InvokeAI/ip_adapter_sd_image_encoder' },
  { key: 'up-realesrgan-x4', name: 'RealESRGAN_x4plus', base: 'any', type: 'spandrel_image_to_image', format: 'checkpoint', description: '', path: 'any/spandrel/RealESRGAN_x4plus.pth', size: 64 * MB, source: 'https://github.com/xinntao/Real-ESRGAN' },
  { key: 'up-4x-ultrasharp', name: '4x-UltraSharp', base: 'any', type: 'spandrel_image_to_image', format: 'checkpoint', description: '', path: 'any/spandrel/4x-UltraSharp.pth', size: 64 * MB, source: 'https://huggingface.co/lokCX/4x-Ultrasharp' },
  { key: 'up-swinir-x4', name: 'SwinIR x4', base: 'any', type: 'spandrel_image_to_image', format: 'checkpoint', description: '', path: 'any/spandrel/SwinIR_x4.pth', size: 136 * MB, source: 'https://github.com/JingyunLiang/SwinIR' },
  { key: 't5-encoder-bnb', name: 't5_bnb_int8_quantized_encoder', base: 'any', type: 't5_encoder', format: 'bnb_quantized', description: '', path: 'any/t5_encoder/t5_bnb_int8', size: 5.2 * GB, source: 'InvokeAI/t5-v1_1-xxl::bnb_llm_int8' },
  { key: 'clip-embed-l', name: 'clip-vit-large-patch14', base: 'any', type: 'clip_embed', format: 'diffusers', description: '', path: 'any/clip_embed/clip-vit-large-patch14', size: 470 * MB, source: 'InvokeAI/clip-vit-large-patch14' },
];

export const STARTER_MODELS: StarterModel[] = [
  { id: 'starter-anima', name: 'Anima Base 1.0', base: 'anima', type: 'diffusion_model', description: 'Anime and illustration model with a Qwen3 text encoder.', source: 'circlestone-labs/Anima::split_files/diffusion_models/anima-base-v1.0.safetensors', dependencies: ['starter-qwen3-06b', 'starter-qwen-image-vae'] },
  { id: 'starter-qwen3-06b', name: 'qwen_3_06b_base', base: 'any', type: 'text_encoder', description: 'Qwen3 0.6B text encoder that Anima reads prompts with.', source: 'circlestone-labs/Anima::split_files/text_encoders/qwen_3_06b_base.safetensors', sizeBytes: 1_190_000_000 },
  { id: 'starter-qwen-image-vae', name: 'qwen_image_vae', base: 'any', type: 'vae', description: 'VAE of Qwen-Image, also used by Anima.', source: 'circlestone-labs/Anima::split_files/vae/qwen_image_vae.safetensors', sizeBytes: 254_000_000 },
  { id: 'starter-sdxl-base', name: 'SDXL Base 1.0', base: 'sdxl', type: 'main', description: 'Stable Diffusion XL base model.', source: 'stabilityai/stable-diffusion-xl-base-1.0', dependencies: ['vae-sdxl-fp16'] },
  { id: 'starter-sd15', name: 'Stable Diffusion 1.5', base: 'sd-1', type: 'main', description: 'Stable Diffusion 1.5 base model.', source: 'stable-diffusion-v1-5/stable-diffusion-v1-5' },
  { id: 'starter-flux-dev', name: 'FLUX Dev (Quantized)', base: 'flux', type: 'main', description: 'FLUX.1 dev, non-commercial license.', source: 'InvokeAI/flux_dev::transformer/bnb_nf4/flux1-dev-bnb_nf4.safetensors', dependencies: ['t5-encoder-bnb', 'clip-embed-l', 'vae-flux'] },
  { id: 'starter-sd35-medium', name: 'SD3.5 Medium', base: 'sd-3', type: 'main', description: 'Stable Diffusion 3.5 Medium.', source: 'stabilityai/stable-diffusion-3.5-medium' },
  { id: 'starter-cn-canny-sdxl', name: 'canny-sdxl', base: 'sdxl', type: 'controlnet', description: 'Canny edge ControlNet for SDXL.', source: 'xinsir/controlnet-canny-sdxl-1.0' },
  { id: 'starter-cn-depth-sdxl', name: 'depth-sdxl', base: 'sdxl', type: 'controlnet', description: 'Depth ControlNet for SDXL.', source: 'diffusers/controlnet-depth-sdxl-1.0' },
  { id: 'starter-ipa-plus-sdxl', name: 'Precise Reference (IP Adapter Plus ViT-H)', base: 'sdxl', type: 'ip_adapter', description: 'IP-Adapter Plus for SDXL.', source: 'InvokeAI/ip-adapter-plus_sdxl_vit-h' },
  { id: 'starter-lora-lcm-sdxl', name: 'LCM LoRA SDXL', base: 'sdxl', type: 'lora', description: 'Latent consistency LoRA for SDXL.', source: 'latent-consistency/lcm-lora-sdxl' },
  { id: 'starter-up-esrgan-anime', name: 'RealESRGAN_x4plus_anime_6B', base: 'any', type: 'spandrel_image_to_image', description: 'Anime upscaler.', source: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth' },
  { id: 'starter-up-esrgan-x2', name: 'RealESRGAN_x2plus', base: 'any', type: 'spandrel_image_to_image', description: '2x general upscaler.', source: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth' },
];

export const SEED_BOARDS: BoardDTO[] = [
  { id: 'board-landscapes', name: 'Landscapes', archived: false, createdAt: 1759500000000 },
  { id: 'board-characters', name: 'Characters', archived: false, createdAt: 1759510000000 },
  { id: 'board-old', name: 'Old experiments', archived: true, createdAt: 1759400000000 },
];

export interface SeedImageSpec {
  prompt: string;
  negative: string;
  modelKey: string;
  seed: number;
  width: number;
  height: number;
  boardId: string | null;
  starred?: boolean;
}

export const SEED_IMAGES: SeedImageSpec[] = [
  { prompt: 'misty mountain valley at dawn, golden light, volumetric fog', negative: 'blurry, lowres', modelKey: 'main-juggernaut-xl', seed: 1182736, width: 1216, height: 832, boardId: 'board-landscapes', starred: true },
  { prompt: 'aurora over frozen lake, starry night, long exposure', negative: 'blurry', modelKey: 'main-juggernaut-xl', seed: 9912, width: 1216, height: 832, boardId: 'board-landscapes' },
  { prompt: 'desert dunes under violet sky, two moons', negative: '', modelKey: 'main-flux-schnell', seed: 4471, width: 1344, height: 768, boardId: 'board-landscapes' },
  { prompt: 'portrait of a knight with silver armor, dramatic rim light', negative: 'deformed hands', modelKey: 'main-noobai-xl', seed: 50213, width: 832, height: 1216, boardId: 'board-characters', starred: true },
  { prompt: 'cyberpunk girl with neon umbrella, rainy street', negative: 'bad anatomy', modelKey: 'main-noobai-xl', seed: 70011, width: 832, height: 1216, boardId: 'board-characters' },
  { prompt: 'cozy cabin interior, fireplace, warm tones', negative: '', modelKey: 'main-dreamshaper-8', seed: 3141, width: 768, height: 512, boardId: null },
  { prompt: 'underwater coral reef, sun rays, tropical fish', negative: '', modelKey: 'main-dreamshaper-8', seed: 2718, width: 512, height: 768, boardId: null },
  { prompt: 'retro futuristic city skyline, sunset synthwave', negative: 'text, watermark', modelKey: 'main-flux-schnell', seed: 8080, width: 1024, height: 1024, boardId: null, starred: true },
  { prompt: 'forest spirit, glowing mushrooms, fantasy art', negative: '', modelKey: 'main-juggernaut-xl', seed: 6060, width: 1024, height: 1024, boardId: null },
  { prompt: 'abstract ink in water, teal and orange', negative: '', modelKey: 'main-flux-schnell', seed: 1234, width: 1024, height: 1024, boardId: 'board-old' },
];

/** A workflow the mock starts with as the user's own (the desktop app starts with none; it keeps only what is saved). */
export const MOCK_USER_WORKFLOWS: SavedWorkflow[] = [
  { id: 'user-my-pipeline', name: 'My Upscale Pipeline', description: 'Personal workflow', author: 'me', tags: ['upscale'], category: 'user', updatedAt: 1759600000000, graph: null },
];
