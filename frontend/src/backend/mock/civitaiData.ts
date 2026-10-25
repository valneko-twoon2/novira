// Fixture catalog for the Browse tab: ~60 fake models generated deterministically from a compact table.
import type { CivitaiFile, CivitaiKind, CivitaiModel, CivitaiVersion, CommercialUse, ModelPermission } from '../types';
import { hashString, mulberry32 } from './random';

/** Fixed "now" so the period filter is deterministic. */
export const CIVITAI_NOW = Date.UTC(2026, 9, 1);
const DAY = 86_400_000;

type Row = [name: string, kind: CivitaiKind, base: string];

const ROWS: Row[] = [
  ['Soft Watercolor Style', 'LoRA', 'SDXL 1.0'],
  ['Cyber Neon Lights', 'LoRA', 'Illustrious'],
  ['Anime Eyes Detailer', 'LoRA', 'NoobAI'],
  ['Film Grain Portrait', 'LoRA', 'SDXL 1.0'],
  ['Pastel Dream Clouds', 'LoRA', 'Pony'],
  ['Ink Brush Landscapes', 'LoRA', 'SD 1.5'],
  ['Retro Pixel Sprites', 'LoRA', 'SD 1.5'],
  ['Golden Hour Glow', 'LoRA', 'FLUX.1'],
  ['Cozy Cafe Interiors', 'LoRA', 'Illustrious'],
  ['Mecha Armor Plates', 'LoRA', 'NoobAI'],
  ['Studio Ghibli Meadows', 'LoRA', 'SDXL 1.0'],
  ['Hand Fixer Pro', 'LoRA', 'Pony'],
  ['Oil Paint Texture', 'LoRA', 'FLUX.1'],
  ['Chibi Mascot Maker', 'LoRA', 'Illustrious'],
  ['Foggy Forest Mood', 'LoRA', 'SDXL 1.0'],
  ['Line Art Cleaner', 'LoRA', 'NoobAI'],
  ['Vintage Poster Look', 'LoRA', 'SD 1.5'],
  ['Cloth Fold Physics', 'LoRA', 'Illustrious'],
  ['Crystal Armor Fantasy', 'LoRA', 'Pony'],
  ['Minimal Flat Icons', 'LoRA', 'SDXL 1.0'],
  ['Rainy Street Night', 'LoRA', 'FLUX.1'],
  ['Skin Detail Enhancer', 'LoRA', 'SDXL 1.0'],
  ['Comic Halftone Shade', 'LoRA', 'NoobAI'],
  ['Sunlit Hair Highlights', 'LoRA', 'Illustrious'],
  ['Isometric Tiny Rooms', 'LoRA', 'SD 1.5'],
  ['Dream Diffusion XL', 'Checkpoint', 'SDXL 1.0'],
  ['Illustrious Prime', 'Checkpoint', 'Illustrious'],
  ['NoobAI Vision', 'Checkpoint', 'NoobAI'],
  ['Pony Realism Mix', 'Checkpoint', 'Pony'],
  ['Classic Dreamlike 1.5', 'Checkpoint', 'SD 1.5'],
  ['Flux Studio Dev', 'Checkpoint', 'FLUX.1'],
  ['Anime Pastel Merge', 'Checkpoint', 'Illustrious'],
  ['Photoreal Lens XL', 'Checkpoint', 'SDXL 1.0'],
  ['Painterly Canvas', 'Checkpoint', 'SD 1.5'],
  ['Midnight Cinema', 'Checkpoint', 'NoobAI'],
  ['Pony Toon Factory', 'Checkpoint', 'Pony'],
  ['Flux Realist Q8', 'Checkpoint', 'FLUX.1'],
  ['Concept Art Forge', 'Checkpoint', 'SDXL 1.0'],
  ['Gentle Anime Base', 'Checkpoint', 'SD 1.5'],
  ['Neon City Diffusion', 'Checkpoint', 'Illustrious'],
  ['Cinematic Light XL', 'Checkpoint', 'SDXL 1.0'],
  ['Canny Edge Guide', 'ControlNet', 'SDXL 1.0'],
  ['OpenPose Skeleton', 'ControlNet', 'SD 1.5'],
  ['Depth Map Union', 'ControlNet', 'SDXL 1.0'],
  ['Lineart Anime Control', 'ControlNet', 'Illustrious'],
  ['Scribble Sketch Guide', 'ControlNet', 'SD 1.5'],
  ['Tile Detail Upscaler', 'ControlNet', 'SDXL 1.0'],
  ['Pony Pose Control', 'ControlNet', 'Pony'],
  ['Flux Canny Dev', 'ControlNet', 'FLUX.1'],
  ['NoobAI Lineart Guide', 'ControlNet', 'NoobAI'],
  ['Segmentation Layout', 'ControlNet', 'SD 1.5'],
  ['SDXL Fixed VAE', 'VAE', 'SDXL 1.0'],
  ['Anime Color VAE', 'VAE', 'SD 1.5'],
  ['Vivid Tone VAE', 'VAE', 'Illustrious'],
  ['Flux Autoencoder', 'VAE', 'FLUX.1'],
  ['Pony Soft VAE', 'VAE', 'Pony'],
  ['NoobAI Clean VAE', 'VAE', 'NoobAI'],
  ['Sharp Detail VAE', 'VAE', 'SDXL 1.0'],
  ['Natural Skin VAE', 'VAE', 'SD 1.5'],
  ['Wan 2.2 I2V A14B (GGUF Q4)', 'Diffusion', 'Wan Video 2.2 I2V-A14B'],
  ['Wan 2.1 T2V 14B (fp8)', 'Diffusion', 'Wan Video 14B t2v'],
  ['Wan 2.2 TI2V 5B Turbo', 'Diffusion', 'Wan Video 2.2 TI2V-5B'],
  ['Studio Matte Finish', 'LoRA', 'Pony'],
  ['Bubble Letter Fonts', 'LoRA', 'SDXL 1.0'],
  ['Anima Soft Shading', 'LoRA', 'Anima'],
  ['Anima Preview Merge', 'Checkpoint', 'Anima'],
];

const CREATORS = ['aurora_lab', 'mistfox', 'pixelwren', 'quietbrush', 'nova_atelier', 'kitsune_ai', 'lumen_works', 'tidepool', 'grayscale99', 'orbit_studio'];
const TAGS = ['style', 'anime', 'realistic', 'concept', 'character', 'lighting', 'detail', 'painting', 'fantasy', 'scifi', 'portrait', 'landscape', 'texture', 'tool', 'clothing'];
const LICENSES = ['Sell generated images', 'Use on generation services', 'Share merges', 'Credit required', 'No commercial use'];
const WORDS = ['aurora', 'softlight', 'neonwave', 'inkstyle', 'detailx', 'dreamy', 'pastelmix', 'cinelook', 'brushed', 'glassy'];
const SIZE: Record<CivitaiKind, number[]> = {
  LoRA: [38, 150, 220, 435],
  Checkpoint: [2000, 4200, 6600, 11500],
  ControlNet: [360, 1400, 2500],
  VAE: [160, 335],
  Diffusion: [5400, 9650, 10800],
};
const BYTES_MB = 1024 * 1024;

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)] as T;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** The summary as the real backend makes it (`commercial_of`): all three commercial uses allowed, none, or some. */
function commercialOf(permissions: ModelPermission[]): CommercialUse {
  const uses = permissions.slice(0, 3).map((p) => p.allowed);
  if (uses.every((a) => a === true)) return 'allowed';
  if (uses.every((a) => a === false)) return 'denied';
  return 'limited';
}

/** The mock's license terms as the permission list the real backend sends. */
function permissionsOf(license: string[]): ModelPermission[] {
  const has = (l: string) => license.includes(l);
  return [
    { key: 'sellImages', allowed: has('Sell generated images') },
    { key: 'generationServices', allowed: has('Use on generation services') },
    // A model that lets its pictures be sold and run on services may be sold too: the mock's fully open license.
    { key: 'sellModel', allowed: has('Sell generated images') && has('Use on generation services') },
    { key: 'shareMerges', allowed: has('Share merges') },
    { key: 'differentLicense', allowed: null },
    { key: 'noCredit', allowed: !has('Credit required') },
  ];
}

function buildModel(row: Row, index: number): CivitaiModel {
  const [name, kind, baseModel] = row;
  const rand = mulberry32(hashString(`civitai:${name}`));
  const id = String(10_000 + index * 37);
  const createdAt = CIVITAI_NOW - Math.floor(rand() * 500) * DAY - Math.floor(rand() * DAY);
  const triggerWords = kind === 'LoRA' ? [...new Set(Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(rand, WORDS)))] : [];
  const versionCount = 1 + Math.floor(rand() * 3);
  const versions: CivitaiVersion[] = Array.from({ length: versionCount }, (_, v) => {
    const sizeMb = pick(rand, SIZE[kind]);
    const stem = `${slug(name)}_v${versionCount - v}`;
    const files: CivitaiFile[] = [{ id: `${id}-${v}-a`, name: `${stem}.safetensors`, sizeBytes: sizeMb * BYTES_MB, format: 'SafeTensor', precision: 'fp16' }];
    if (kind !== 'LoRA' && kind !== 'VAE' && rand() > 0.4) {
      files.push({ id: `${id}-${v}-b`, name: `${stem}_fp8.safetensors`, sizeBytes: Math.round((sizeMb * BYTES_MB) / 2), format: 'SafeTensor', precision: 'fp8' });
    }
    if (rand() > 0.7) {
      files.push({ id: `${id}-${v}-c`, name: `${stem}.ckpt`, sizeBytes: Math.round(sizeMb * 1.9 * BYTES_MB), format: 'PickleTensor', precision: 'fp32' });
    }
    return {
      id: `${id}${v}`,
      name: `v${versionCount - v}.0`,
      baseModel,
      createdAt: createdAt - v * Math.floor(20 + rand() * 60) * DAY,
      triggerWords,
      files,
    };
  });
  const downloads = Math.floor(200 + rand() ** 3 * 240_000);
  const picked = [...new Set([pick(rand, LICENSES), pick(rand, LICENSES)])];
  // A "No commercial use" model cannot also grant selling rights.
  const license = picked.includes('No commercial use') ? picked.filter((l) => l !== 'Sell generated images' && l !== 'Use on generation services') : picked;
  return {
    id,
    name,
    kind,
    baseModel,
    creator: pick(rand, CREATORS),
    downloads,
    likes: Math.floor(downloads / (6 + rand() * 12)),
    rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
    ratingCount: Math.floor(downloads / (12 + rand() * 30)),
    createdAt,
    nsfw: rand() > 0.82,
    imageCount: 3 + Math.floor(rand() * 5),
    tags: [...new Set([pick(rand, TAGS), pick(rand, TAGS), pick(rand, TAGS)])],
    description: `${name} is a ${kind} for ${baseModel}.\nIt was tuned on a small curated set and works best with moderate weights.\nRecommended: CFG 5-7, 25-30 steps. Feedback and example posts are welcome.`,
    license,
    commercial: commercialOf(permissionsOf(license)),
    permissions: permissionsOf(license),
    triggerWords,
    versions,
  };
}

export const CIVITAI_MODELS: CivitaiModel[] = ROWS.map(buildModel);
