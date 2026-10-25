// Ready-made graphs offered in the sidebar. Each is a compact spec; building one makes real nodes and edges
// (fresh ids every time, so a template can be added to a graph more than once).
import { EMPTY_META, type EditorGraph, type WorkflowEdge, type WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge, newId } from './graph';
import { getTemplate } from './templates';

type NodeSpec = [key: string, type: string, x: number, y: number, inputs?: Record<string, unknown>];
type EdgeSpec = [from: string, output: string, to: string, input: string];

export interface GraphTemplate {
  id: string;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  /** Custom node packs (catalog ids) the graph needs. */
  packs?: string[];
}

const PROMPT = 'a cute puppy sitting in a sunny meadow, detailed fur, soft light';
const NEGATIVE = 'blurry, low quality, watermark';

/** Model loader, two prompts, noise, denoise and decode; the starting point of most graphs. */
function text2image(): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  return {
    nodes: [
      ['model', 'sdxl_model_loader', 0, 120],
      ['pos', 'sdxl_compel_prompt', 380, -260, { prompt: PROMPT }],
      ['neg', 'sdxl_compel_prompt', 380, 120, { prompt: NEGATIVE }],
      ['seed', 'rand_int', 0, 420],
      ['noise', 'noise', 380, 520, { width: 1024, height: 1024 }],
      ['denoise', 'denoise_latents', 760, 0, { steps: 30, cfg_scale: 6, scheduler: 'dpmpp_2m_k' }],
      ['decode', 'l2i', 1140, 120],
    ],
    edges: [
      ['model', 'clip', 'pos', 'clip'],
      ['model', 'clip2', 'pos', 'clip2'],
      ['model', 'clip', 'neg', 'clip'],
      ['model', 'clip2', 'neg', 'clip2'],
      ['model', 'unet', 'denoise', 'unet'],
      ['model', 'vae', 'decode', 'vae'],
      ['pos', 'conditioning', 'denoise', 'positive_conditioning'],
      ['neg', 'conditioning', 'denoise', 'negative_conditioning'],
      ['seed', 'value', 'noise', 'seed'],
      ['noise', 'noise', 'denoise', 'noise'],
      ['denoise', 'latents', 'decode', 'latents'],
    ],
  };
}

const withBase = (extraNodes: NodeSpec[], extraEdges: EdgeSpec[], drop: (e: EdgeSpec) => boolean = () => false) => {
  const base = text2image();
  return { nodes: [...base.nodes, ...extraNodes], edges: [...base.edges.filter((e) => !drop(e)), ...extraEdges] };
};

/**
 * The base graph with a character as the reference (the picture on a plain white background, so its background colour
 * does not leak, through the plain IP-Adapter at weight 0.6) and the lower CFG scale such references need.
 */
const withCharacter = (extraNodes: NodeSpec[], extraEdges: EdgeSpec[]) => {
  const base = withBase(
    [
      ['character', 'image', 0, 800],
      ['cut', 'comfy:RMBG', 380, 900, { model: 'INSPYRENET', background: 'Color', background_color: '#FFFFFF' }],
      ['ipaLoader', 'comfy:IPAdapterUnifiedLoader', 380, 700, { preset: 'STANDARD (medium strength)' }],
      ['ipa', 'comfy:IPAdapter', 760, 800, { weight: 0.6, weight_type: 'standard' }],
      ...extraNodes,
    ],
    [
      ['model', 'unet', 'ipaLoader', 'model'],
      ['ipaLoader', 'model', 'ipa', 'model'],
      ['ipaLoader', 'ipadapter', 'ipa', 'ipadapter'],
      ['character', 'image', 'cut', 'image'],
      ['cut', 'IMAGE', 'ipa', 'image'],
      ['ipa', 'MODEL', 'denoise', 'unet'],
      ...extraEdges,
    ],
    (e) => e[1] === 'unet' && e[2] === 'denoise',
  );
  return { ...base, nodes: base.nodes.map((n): NodeSpec => (n[0] === 'denoise' ? [n[0], n[1], n[2], n[3], { ...n[4], cfg_scale: 4.5 }] : n)) };
};

/** Prompts of the sound and video graphs: ComfyUI's own nodes, which the editor offers once ComfyUI is running. */
const SONG_TAGS = 'city pop, warm, female vocals, 110 bpm, nostalgic';
const SPEECH = 'Hello! This is a short message read aloud by the voice engine.';
const SONG_LYRICS = '[Verse]\nSummer night, the city lights\nWalking home, the radio on\n\n[Chorus]\nOh, take me back, take me back tonight';
const CLIP_PROMPT = 'a cute puppy running through a sunny meadow, soft light, gentle camera motion';
const CLIP_NEGATIVE = 'blurry, low quality, distorted, static, watermark, text';

/** Wan 2.2 5B video: the loaders, two prompts, the latent of the clip, the sampler, and the video nodes. `image` adds a start picture. */
function wanVideo(image: boolean): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  return {
    nodes: [
      ['unet', 'comfy:UNETLoader', 0, 0, { unet_name: 'wan2.2_ti2v_5B_fp16.safetensors', weight_dtype: 'default' }],
      ['shift', 'comfy:ModelSamplingSD3', 380, 0, { shift: 8 }],
      ['clip', 'comfy:CLIPLoader', 0, 220, { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan', device: 'default' }],
      ['vae', 'comfy:VAELoader', 0, 460, { vae_name: 'wan2.2_vae.safetensors' }],
      ['pos', 'comfy:CLIPTextEncode', 380, 220, { text: CLIP_PROMPT }],
      ['neg', 'comfy:CLIPTextEncode', 380, 560, { text: CLIP_NEGATIVE }],
      ['latent', 'comfy:Wan22ImageToVideoLatent', 760, 460, { width: 832, height: 480, length: 49, batch_size: 1 }],
      ['seed', 'rand_int', 760, 800],
      ['sampler', 'comfy:KSampler', 1140, 0, { steps: 20, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1 }],
      ['decode', 'comfy:VAEDecode', 1520, 0],
      ['video', 'comfy:CreateVideo', 1520, 240, { fps: 24 }],
      ['save', 'comfy:SaveVideo', 1900, 0, { filename_prefix: 'video/novira', format: 'mp4' }],
      ...(image ? ([['source', 'image', 380, 800]] as NodeSpec[]) : []),
    ],
    edges: [
      ['unet', 'MODEL', 'shift', 'model'],
      ['clip', 'CLIP', 'pos', 'clip'],
      ['clip', 'CLIP', 'neg', 'clip'],
      ['vae', 'VAE', 'latent', 'vae'],
      ['shift', 'MODEL', 'sampler', 'model'],
      ['pos', 'CONDITIONING', 'sampler', 'positive'],
      ['neg', 'CONDITIONING', 'sampler', 'negative'],
      ['latent', 'LATENT', 'sampler', 'latent_image'],
      ['seed', 'value', 'sampler', 'seed'],
      ['sampler', 'LATENT', 'decode', 'samples'],
      ['vae', 'VAE', 'decode', 'vae'],
      ['decode', 'IMAGE', 'video', 'images'],
      ['video', 'VIDEO', 'save', 'video'],
      ...(image ? ([['source', 'image', 'latent', 'start_image']] as EdgeSpec[]) : []),
    ],
  };
}

export const GRAPH_TEMPLATES: GraphTemplate[] = [
  {
    id: 'text2image',
    ...withBase([['save', 'save_image', 1520, 120]], [['decode', 'image', 'save', 'image']]),
  },
  {
    id: 'text2imageUpscale',
    ...withBase(
      [
        ['resize', 'img_resize', 1520, 120, { width: 2048, height: 2048 }],
        ['save', 'save_image', 1900, 120],
      ],
      [
        ['decode', 'image', 'resize', 'image'],
        ['resize', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'loraStack',
    ...withBase(
      [
        ['lora1', 'lora_loader', 380, 700, { weight: 0.8 }],
        ['lora2', 'lora_loader', 760, 700, { weight: 0.6 }],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['model', 'unet', 'lora1', 'unet'],
        ['model', 'clip', 'lora1', 'clip'],
        ['lora1', 'unet', 'lora2', 'unet'],
        ['lora1', 'clip', 'lora2', 'clip'],
        ['lora2', 'unet', 'denoise', 'unet'],
        ['lora2', 'clip', 'pos', 'clip'],
        ['lora2', 'clip', 'neg', 'clip'],
        ['decode', 'image', 'save', 'image'],
      ],
      (e) => (e[1] === 'unet' && e[2] === 'denoise') || (e[1] === 'clip' && (e[2] === 'pos' || e[2] === 'neg')),
    ),
  },
  {
    id: 'image2image',
    nodes: [
      ['model', 'sdxl_model_loader', 0, 120],
      ['source', 'image', 0, 520],
      ['encode', 'i2l', 380, 520],
      ['pos', 'sdxl_compel_prompt', 380, -260, { prompt: PROMPT }],
      ['neg', 'sdxl_compel_prompt', 380, 120, { prompt: NEGATIVE }],
      ['seed', 'rand_int', 380, 800],
      ['noise', 'noise', 760, 640],
      ['denoise', 'denoise_latents', 760, 0, { steps: 30, cfg_scale: 6, denoising_start: 0.5, scheduler: 'dpmpp_2m_k' }],
      ['decode', 'l2i', 1140, 120],
      ['save', 'save_image', 1520, 120],
    ],
    edges: [
      ['model', 'clip', 'pos', 'clip'],
      ['model', 'clip2', 'pos', 'clip2'],
      ['model', 'clip', 'neg', 'clip'],
      ['model', 'clip2', 'neg', 'clip2'],
      ['model', 'unet', 'denoise', 'unet'],
      ['model', 'vae', 'encode', 'vae'],
      ['model', 'vae', 'decode', 'vae'],
      ['source', 'image', 'encode', 'image'],
      ['encode', 'latents', 'denoise', 'latents'],
      ['encode', 'width', 'noise', 'width'],
      ['encode', 'height', 'noise', 'height'],
      ['seed', 'value', 'noise', 'seed'],
      ['noise', 'noise', 'denoise', 'noise'],
      ['pos', 'conditioning', 'denoise', 'positive_conditioning'],
      ['neg', 'conditioning', 'denoise', 'negative_conditioning'],
      ['denoise', 'latents', 'decode', 'latents'],
      ['decode', 'image', 'save', 'image'],
    ],
  },
  {
    id: 'upscale',
    nodes: [
      ['source', 'image', 0, 0],
      ['upscale', 'spandrel_image_to_image', 380, 0],
      ['save', 'save_image', 760, 0],
    ],
    edges: [
      ['source', 'image', 'upscale', 'image'],
      ['upscale', 'image', 'save', 'image'],
    ],
  },
  {
    id: 'controlnetCanny',
    ...withBase(
      [
        ['source', 'image', 0, 800],
        ['canny', 'canny_edge_detection', 380, 800],
        ['control', 'controlnet', 760, 800],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['source', 'image', 'canny', 'image'],
        ['canny', 'image', 'control', 'image'],
        ['control', 'control', 'denoise', 'control'],
        ['decode', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'filmGrain',
    packs: ['nkd'],
    ...withBase(
      [
        ['grain', 'comfy:NKDFilmGrain', 1520, 120, { amount: 30, size: 25, roughness: 50, color: 0, animate: false }],
        ['save', 'save_image', 1900, 120],
      ],
      [
        ['decode', 'image', 'grain', 'image'],
        ['grain', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'faceRig',
    packs: ['nkd'],
    nodes: [
      ['source', 'image', 0, 0],
      ['rig', 'comfy:NKDFaceRig', 380, 0],
      ['save', 'save_image', 760, 0],
    ],
    edges: [
      ['source', 'image', 'rig', 'image'],
      ['rig', 'image', 'save', 'image'],
    ],
  },
  {
    id: 'tiledUpscale',
    packs: ['ultimateUpscale'],
    nodes: [
      ['model', 'sdxl_model_loader', 0, 120],
      ['pos', 'sdxl_compel_prompt', 380, -260, { prompt: 'highly detailed, sharp focus' }],
      ['neg', 'sdxl_compel_prompt', 380, 120, { prompt: NEGATIVE }],
      ['source', 'image', 0, 520],
      ['resize', 'img_resize', 380, 520, { width: 2048, height: 2048, resample_mode: 'lanczos' }],
      ['tiles', 'comfy:UltimateSDUpscaleNoUpscale', 760, 0, { steps: 20, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.3, tile_width: 1024, tile_height: 1024 }],
      ['save', 'save_image', 1140, 120],
    ],
    edges: [
      ['model', 'clip', 'pos', 'clip'],
      ['model', 'clip2', 'pos', 'clip2'],
      ['model', 'clip', 'neg', 'clip'],
      ['model', 'clip2', 'neg', 'clip2'],
      ['source', 'image', 'resize', 'image'],
      ['resize', 'image', 'tiles', 'upscaled_image'],
      ['model', 'unet', 'tiles', 'model'],
      ['model', 'vae', 'tiles', 'vae'],
      ['pos', 'conditioning', 'tiles', 'positive'],
      ['neg', 'conditioning', 'tiles', 'negative'],
      ['tiles', 'IMAGE', 'save', 'image'],
    ],
  },
  {
    id: 'styleReference',
    packs: ['ipadapter'],
    ...withBase(
      [
        ['style', 'image', 0, 800],
        ['ipaLoader', 'comfy:IPAdapterUnifiedLoader', 380, 700, { preset: 'PLUS (high strength)' }],
        ['ipa', 'comfy:IPAdapter', 760, 700, { weight: 0.8, weight_type: 'style transfer' }],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['model', 'unet', 'ipaLoader', 'model'],
        ['ipaLoader', 'model', 'ipa', 'model'],
        ['ipaLoader', 'ipadapter', 'ipa', 'ipadapter'],
        ['style', 'image', 'ipa', 'image'],
        ['ipa', 'MODEL', 'denoise', 'unet'],
        ['decode', 'image', 'save', 'image'],
      ],
      (e) => e[1] === 'unet' && e[2] === 'denoise',
    ),
  },
  {
    id: 'faceDetailer',
    packs: ['impact', 'impactSubpack'],
    ...withBase(
      [
        ['detector', 'comfy:UltralyticsDetectorProvider', 760, 420, { model_name: 'bbox/face_yolov8m.pt' }],
        ['face', 'comfy:FaceDetailer', 1140, 120, { steps: 20, cfg: 6, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.4 }],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['decode', 'image', 'face', 'image'],
        ['model', 'unet', 'face', 'model'],
        ['model', 'clip', 'face', 'clip'],
        ['model', 'vae', 'face', 'vae'],
        ['pos', 'conditioning', 'face', 'positive'],
        ['neg', 'conditioning', 'face', 'negative'],
        ['detector', 'BBOX_DETECTOR', 'face', 'bbox_detector'],
        ['face', 'image', 'save', 'image'],
      ],
      (e) => e[0] === 'decode' && e[2] === 'save',
    ),
  },
  {
    id: 'removeBackground',
    packs: ['rmbg'],
    nodes: [
      ['source', 'image', 0, 0],
      ['cut', 'comfy:RMBG', 380, 0, { model: 'INSPYRENET', background: 'Alpha' }],
      ['save', 'save_image', 760, 0],
    ],
    edges: [
      ['source', 'image', 'cut', 'image'],
      ['cut', 'IMAGE', 'save', 'image'],
    ],
  },
  {
    id: 'poseControl',
    packs: ['controlnetAux'],
    ...withBase(
      [
        ['source', 'image', 0, 800],
        ['pose', 'comfy:OpenposePreprocessor', 380, 800],
        ['control', 'controlnet', 760, 800],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['source', 'image', 'pose', 'image'],
        ['pose', 'IMAGE', 'control', 'image'],
        ['control', 'control', 'denoise', 'control'],
        ['decode', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'captionToImage',
    packs: ['florence2'],
    ...withBase(
      [
        ['source', 'image', 0, 800],
        ['florence', 'comfy:DownloadAndLoadFlorence2Model', 380, 700, { model: 'microsoft/Florence-2-base', precision: 'fp16' }],
        ['caption', 'comfy:Florence2Run', 760, 700, { task: 'detailed_caption' }],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['source', 'image', 'caption', 'image'],
        ['florence', 'florence2_model', 'caption', 'florence2_model'],
        ['caption', 'caption', 'pos', 'prompt'],
        ['decode', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'whiteBackground',
    packs: ['rmbg'],
    nodes: [
      ['source', 'image', 0, 0],
      ['cut', 'comfy:RMBG', 380, 0, { model: 'INSPYRENET', background: 'Color', background_color: '#FFFFFF' }],
      ['save', 'save_image', 760, 0],
    ],
    edges: [
      ['source', 'image', 'cut', 'image'],
      ['cut', 'IMAGE', 'save', 'image'],
    ],
  },
  {
    id: 'characterReference',
    packs: ['rmbg', 'ipadapter'],
    ...withCharacter([['save', 'save_image', 1520, 120]], [['decode', 'image', 'save', 'image']]),
  },
  {
    id: 'characterPose',
    packs: ['rmbg', 'ipadapter', 'controlnetAux'],
    ...withCharacter(
      [
        ['poseSource', 'image', 0, 1100],
        ['pose', 'comfy:OpenposePreprocessor', 380, 1100],
        ['control', 'controlnet', 760, 1100],
        ['save', 'save_image', 1520, 120],
      ],
      [
        ['poseSource', 'image', 'pose', 'image'],
        ['pose', 'IMAGE', 'control', 'image'],
        ['control', 'control', 'denoise', 'control'],
        ['decode', 'image', 'save', 'image'],
      ],
    ),
  },
  {
    id: 'imageToVideo',
    nodes: [
      ['source', 'image', 0, 0],
      ['video', 'video_generate', 380, 0, { prompt: 'the puppy wags its tail, gentle camera motion' }],
    ],
    edges: [['source', 'image', 'video', 'image']],
  },
  { id: 'videoWan22', ...wanVideo(false) },
  { id: 'videoWan22Image', ...wanVideo(true) },
  {
    id: 'musicAceStep',
    nodes: [
      ['ckpt', 'comfy:CheckpointLoaderSimple', 0, 0, { ckpt_name: 'ace_step_1.5_turbo_aio.safetensors' }],
      ['song', 'comfy:TextEncodeAceStepAudio1.5', 380, 0, { tags: SONG_TAGS, lyrics: SONG_LYRICS, bpm: 110, duration: 60, language: 'en', keyscale: 'C major', timesignature: '4' }],
      ['zero', 'comfy:ConditioningZeroOut', 760, 0],
      ['shift', 'comfy:ModelSamplingAuraFlow', 380, 520, { shift: 3 }],
      ['latent', 'comfy:EmptyAceStep1.5LatentAudio', 380, 760, { seconds: 60, batch_size: 1 }],
      ['seed', 'rand_int', 0, 400],
      ['sampler', 'comfy:KSampler', 1140, 0, { steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 }],
      ['decode', 'comfy:VAEDecodeAudio', 1520, 0],
      ['save', 'comfy:SaveAudioAdvanced', 1900, 0, { filename_prefix: 'audio/novira', format: 'flac' }],
    ],
    edges: [
      ['ckpt', 'CLIP', 'song', 'clip'],
      ['song', 'CONDITIONING', 'zero', 'conditioning'],
      ['ckpt', 'MODEL', 'shift', 'model'],
      ['shift', 'MODEL', 'sampler', 'model'],
      ['song', 'CONDITIONING', 'sampler', 'positive'],
      ['zero', 'CONDITIONING', 'sampler', 'negative'],
      ['latent', 'LATENT', 'sampler', 'latent_image'],
      ['seed', 'value', 'sampler', 'seed'],
      ['seed', 'value', 'song', 'seed'],
      ['sampler', 'LATENT', 'decode', 'samples'],
      ['ckpt', 'VAE', 'decode', 'vae'],
      ['decode', 'AUDIO', 'save', 'audio'],
    ],
  },
  {
    id: 'voiceRead',
    nodes: [
      ['say', 'voice_speak', 0, 0, { text: SPEECH, language: 'Auto', mode: 'preset', speaker: 'Ono_Anna' }],
      ['save', 'comfy:SaveAudioAdvanced', 380, 0, { filename_prefix: 'audio/novira', format: 'mp3', 'format.quality': '128k' }],
    ],
    edges: [['say', 'audio', 'save', 'audio']],
  },
  {
    id: 'videoNarration',
    nodes: [
      ['source', 'comfy:LoadVideo', 0, 0],
      ['parts', 'comfy:GetVideoComponents', 380, 0],
      ['say', 'voice_speak', 0, 340, { text: SPEECH, language: 'Auto', mode: 'preset', speaker: 'Ono_Anna' }],
      ['video', 'comfy:CreateVideo', 760, 0],
      ['save', 'comfy:SaveVideo', 1140, 0, { filename_prefix: 'video/novira', format: 'mp4' }],
    ],
    edges: [
      ['source', 'VIDEO', 'parts', 'video'],
      ['parts', 'images', 'video', 'images'],
      ['parts', 'fps', 'video', 'fps'],
      ['say', 'audio', 'video', 'audio'],
      ['video', 'VIDEO', 'save', 'video'],
    ],
  },
];

export interface BuiltTemplate {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/** Real nodes and edges of a template, with fresh ids, moved by `offset`. */
export function buildTemplate(template: GraphTemplate, offset = { x: 0, y: 0 }): BuiltTemplate {
  const ids = new Map<string, string>();
  const nodes = template.nodes.map(([key, type, x, y, inputs]) => {
    const spec = getTemplate(type);
    if (!spec) throw new Error(`unknown node type ${type}`);
    const id = newId(type);
    ids.set(key, id);
    return createNode(spec, { x: x + offset.x, y: y + offset.y }, { id, inputs });
  });
  const edges = template.edges.map(([from, output, to, input]) => makeEdge(ids.get(from) as string, output, ids.get(to) as string, input));
  return { nodes, edges };
}

/** The template as a graph that opens in the editor. */
export function templateGraph(template: GraphTemplate, name: string): EditorGraph {
  const { nodes, edges } = buildTemplate(template);
  return { nodes, edges, form: [], meta: { ...EMPTY_META, name } };
}
