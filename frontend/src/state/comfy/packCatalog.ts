// Custom node packs novira suggests, grouped by what the user wants to do (beginners start from the goal, not from a
// pack name). Each pack does real work in a graph (a ComfyUI interface add-on would do nothing in this editor) and
// was updated recently. `about` is for the AI assistant (English); the screen shows the catalog messages.
import type { MessageKey } from '@/i18n';

export type PackGoalId = 'face' | 'background' | 'partial' | 'upscale' | 'pose' | 'style' | 'video' | 'color' | 'caption' | 'light' | 'handy';

/** What a pack needs: `on` is `comfyui` or the id of another catalog pack, and the version of it must be inside `min`..`max`. */
export interface PackRequirement {
  on: string;
  min?: string;
  max?: string;
}

export interface CatalogPack {
  id: string;
  url: string;
  license: string;
  /** Versions of ComfyUI or of other packs this pack works with. Only what has been checked is written here. */
  requires?: PackRequirement[];
  /** What it is for, most important first; the first goal is where the pack is listed first. */
  goals: PackGoalId[];
  /** One English sentence for the AI assistant. */
  about: string;
  /** Something to know before installing. */
  caveat?: 'git' | 'heavy' | 'unmaintained';
}

/** The goals in the order they are shown. */
export const PACK_GOALS: PackGoalId[] = ['face', 'background', 'partial', 'upscale', 'pose', 'style', 'video', 'color', 'caption', 'light', 'handy'];

export const PACK_CATALOG: CatalogPack[] = [
  {
    id: 'impact',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    license: 'GPL-3.0',
    goals: ['face', 'partial'],
    about: 'FaceDetailer finds faces (and hands) and redraws them at higher resolution; also segmentation-based detail fixes.',
    caveat: 'git',
  },
  {
    id: 'impactSubpack',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Subpack',
    license: 'AGPL-3.0',
    goals: ['face'],
    about: 'Loads the YOLO face and hand detectors that the Impact Pack uses.',
  },
  {
    id: 'nkd',
    url: 'https://github.com/Nekodificador/ComfyUI-NKD-Basic-Tools',
    license: 'MIT',
    goals: ['face', 'color', 'handy'],
    about: 'Face Rig (change expression, gaze and head turn of a portrait), film grain, colour grading, masks, crop and merge, resolution picker.',
  },
  {
    id: 'rmbg',
    url: 'https://github.com/1038lab/ComfyUI-RMBG',
    license: 'GPL-3.0',
    goals: ['background'],
    about: 'Removes the background of a picture and keeps the subject (several background-removal and segmentation models).',
    caveat: 'heavy',
  },
  {
    id: 'sam2',
    url: 'https://github.com/kijai/ComfyUI-segment-anything-2',
    license: 'Apache-2.0',
    goals: ['background', 'partial'],
    about: 'Segment Anything 2: picks an object by clicking or by a box and makes a mask of it, for pictures and video.',
  },
  {
    id: 'cropStitch',
    url: 'https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch',
    license: 'GPL-3.0',
    goals: ['partial'],
    about: 'Crops the masked part of a picture, lets it be redrawn at full resolution, and stitches it back in without seams.',
  },
  {
    id: 'inpaintNodes',
    url: 'https://github.com/Acly/comfyui-inpaint-nodes',
    license: 'GPL-3.0',
    goals: ['partial'],
    about: 'Better inpainting: fills masked areas before sampling and applies inpaint models (Fooocus, LaMa, MAT).',
  },
  {
    id: 'ultimateUpscale',
    url: 'https://github.com/ssitu/ComfyUI_UltimateSDUpscale',
    license: 'GPL-3.0',
    goals: ['upscale'],
    about: 'Enlarges a picture in tiles, redrawing each tile for fine detail without running out of memory.',
  },
  {
    id: 'seedvr2',
    url: 'https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler',
    license: 'Apache-2.0',
    goals: ['upscale', 'video'],
    about: 'SeedVR2 restoration and upscaling for pictures and video, one step, good at faces and old footage.',
    caveat: 'heavy',
  },
  {
    id: 'controlnetAux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    license: 'Apache-2.0',
    goals: ['pose'],
    about: 'ControlNet preprocessors: pose (OpenPose, DWPose), depth, line art, normal map, segmentation and more from a reference picture.',
    caveat: 'heavy',
  },
  {
    id: 'ipadapter',
    url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus',
    license: 'GPL-3.0',
    goals: ['style'],
    about: 'IPAdapter: carries the style, composition or face of a reference picture into the generation. Needs IPAdapter and CLIP-vision models.',
    caveat: 'unmaintained',
  },
  {
    id: 'mangascreen',
    url: 'https://github.com/ashukae/ComfyUI-MangaScreen',
    license: 'MIT',
    goals: ['color'],
    about: 'Manga Finish turns a picture into a black-and-white manga page: crisp lines, flat tones, real 45-degree screentone and white lines inside solid black. Manga Levels and Manga Panel are lighter helpers.',
  },
  {
    id: 'pulid',
    url: 'https://github.com/cubiq/PuLID_ComfyUI',
    license: 'Apache-2.0',
    goals: ['style', 'face'],
    about: 'PuLID keeps the identity of a person from one photo while the rest follows the prompt (SDXL).',
    caveat: 'unmaintained',
  },
  {
    id: 'frameInterpolation',
    url: 'https://github.com/Fannovel16/ComfyUI-Frame-Interpolation',
    license: 'MIT',
    goals: ['video'],
    about: 'Adds frames between the frames of a video (RIFE, FILM and others) for smoother motion.',
  },
  {
    id: 'wanVideo',
    url: 'https://github.com/kijai/ComfyUI-WanVideoWrapper',
    license: 'Apache-2.0',
    goals: ['video', 'light'],
    about: 'Wan 2.x video models with extra controls (camera, reference, long clips, low-memory loading).',
    caveat: 'heavy',
  },
  {
    id: 'videoHelper',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    license: 'GPL-3.0',
    goals: ['video'],
    about: 'Loads video files into frames and saves frames as MP4 or GIF; frame selection and batching tools.',
  },
  {
    id: 'animatediff',
    url: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
    license: 'Apache-2.0',
    goals: ['video'],
    about: 'AnimateDiff: makes short animations from SD1.5 / SDXL image models with motion modules.',
  },
  {
    id: 'layerStyle',
    url: 'https://github.com/chflame163/ComfyUI_LayerStyle',
    license: 'MIT',
    goals: ['color', 'background'],
    about: 'Photoshop-like layer blending, drop shadow, stroke, glow, colour adjustment and masks.',
    caveat: 'heavy',
  },
  {
    id: 'detailDaemon',
    url: 'https://github.com/Jonseed/ComfyUI-Detail-Daemon',
    license: 'MIT',
    goals: ['color', 'upscale'],
    about: 'Adds fine detail and texture during sampling by adjusting the sigma schedule.',
  },
  {
    id: 'florence2',
    url: 'https://github.com/kijai/ComfyUI-Florence2',
    license: 'MIT',
    goals: ['caption'],
    about: 'Florence-2: describes a picture in words, finds objects and makes masks by name. Good for turning a picture into a prompt.',
  },
  {
    id: 'wd14',
    url: 'https://github.com/pythongosssss/ComfyUI-WD14-Tagger',
    license: 'MIT',
    goals: ['caption'],
    about: 'WD14 tagger: turns an anime-style picture into Danbooru tags to reuse as a prompt.',
  },
  {
    id: 'gguf',
    url: 'https://github.com/city96/ComfyUI-GGUF',
    license: 'Apache-2.0',
    goals: ['light'],
    about: 'Loads GGUF-quantised models (Flux, Wan and others) so big models fit in less VRAM.',
  },
  {
    id: 'nunchaku',
    url: 'https://github.com/nunchux-ai/ComfyUI-nunchaku',
    license: 'Apache-2.0',
    goals: ['light'],
    about: 'Runs Flux, Qwen-Image and similar models as 4-bit (SVDQuant) files: far less VRAM and faster sampling. Needs the matching nunchaku Python wheel.',
    caveat: 'heavy',
  },
  {
    id: 'framePack',
    url: 'https://github.com/kijai/ComfyUI-FramePackWrapper',
    license: 'Apache-2.0',
    goals: ['light', 'video'],
    about: 'FramePack: makes a long video from one image a section at a time, so it fits in as little as 6 GB of VRAM.',
    caveat: 'heavy',
  },
  {
    id: 'kjnodes',
    url: 'https://github.com/kijai/ComfyUI-KJNodes',
    license: 'GPL-3.0',
    goals: ['handy'],
    about: 'A large set of small helpers: masks, image batching, resizing, colour matching, conditioning tools.',
  },
  {
    id: 'essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    license: 'MIT',
    goals: ['handy'],
    about: 'Everyday nodes ComfyUI lacks: image resize and crop, mask tools, simple math, text and batch helpers.',
    caveat: 'unmaintained',
  },
  {
    id: 'was',
    url: 'https://github.com/WASasquatch/was-node-suite-comfyui',
    license: 'MIT',
    goals: ['handy', 'color'],
    about: 'A big suite: image filters and blends, text and number tools, masks, lists and file helpers.',
  },
];

/** Folder a pack installs to: the repository name. */
export const packFolder = (url: string) => url.replace(/\/+$/, '').replace(/\.git$/, '').split('/').pop() ?? url;

/** The catalog entry of an installed pack (matched by the address novira installed it from, or by its folder name). */
export function catalogPackOf(p: { folder: string; url: string | null }, catalog: CatalogPack[] = PACK_CATALOG): CatalogPack | undefined {
  return catalog.find((c) => p.url === c.url.replace(/\/+$/, '').replace(/\.git$/, '') || p.folder === packFolder(c.url));
}

export const packDescKey = (id: string) => `workflows.packs.catalog.${id}` as MessageKey;
export const caveatKey = (c: NonNullable<CatalogPack['caveat']>) => `workflows.packs.caveat.${c}` as MessageKey;
export const goalTitleKey = (g: PackGoalId) => `workflows.packs.goal.${g}.title` as MessageKey;
export const goalDescKey = (g: PackGoalId) => `workflows.packs.goal.${g}.desc` as MessageKey;

/** The packs for a goal, the ones it is mainly for first. */
export function packsForGoal(goal: PackGoalId): CatalogPack[] {
  return PACK_CATALOG.filter((p) => p.goals.includes(goal)).sort((a, b) => a.goals.indexOf(goal) - b.goals.indexOf(goal));
}

/** What the assistant is told about the catalog. */
export interface AgentPackInfo {
  id: string;
  name: string;
  goals: PackGoalId[];
  about: string;
  installed: boolean;
}

export function agentPacks(installed: { folder: string; url: string | null }[] | undefined): AgentPackInfo[] {
  return PACK_CATALOG.map((p) => ({
    id: p.id,
    name: packFolder(p.url),
    goals: p.goals,
    about: p.about,
    installed: !!installed?.some((i) => i.folder === packFolder(p.url) || i.url === p.url),
  }));
}
