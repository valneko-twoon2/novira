// "By purpose" for the extension manager. The purposes and the filing of the ComfyUI Registry's packs under them were worked out
// once with an AI from each pack's name and description and are kept in `purposeAssignments.json` (the registry's own tags are
// almost always empty). A pack novira suggests keeps the purposes it was filed under by hand (`PACK_CATALOG`); a pack that is
// not in the assignments (new in the registry, or not from it) is filed by words in its name and description. A pack can belong
// to several purposes, or to none.
import type { MessageKey } from '@/i18n';

/** Every purpose, in the order the rail lists them. */
export const PURPOSES = [
  'face', 'background', 'partial', 'upscale', 'pose', 'style', 'video', 'color', 'caption', 'light', 'handy', 'audio', 'prompt',
  'model', 'three', 'api', 'files', 'mask', 'animation', 'image', 'text', 'workflow', 'performance', 'detect', 'control',
] as const;
export type PurposeId = (typeof PURPOSES)[number];

export const purposeKey = (id: PurposeId) => `workflows.packs.purpose.${id}` as MessageKey;

/** The AI's filing, kept in `purposeData/assignments/` (one file per first letter; `comfyui-*` packs, the most, per next letter). */
const files = import.meta.glob<Record<string, string>>('./purposeData/assignments/*.json', { eager: true, import: 'default' });
const ASSIGNED = new Map<string, string>(Object.values(files).flatMap((f) => Object.entries(f).map(([id, v]) => [id.toLowerCase(), v] as [string, string])));

/** The purposes the AI filed a registry pack under (empty when it fits none), or null when the pack is not in the assignments. */
export function assignedPurposes(registryId: string): PurposeId[] | null {
  const v = ASSIGNED.get(registryId.toLowerCase());
  return v === undefined ? null : v === '' ? [] : (v.split(',') as PurposeId[]);
}

/** Lower-case words (matched as parts of the text) that file a pack under a purpose, for packs the assignments do not know. */
const WORDS: Partial<Record<PurposeId, string[]>> = {
  face: ['face', 'adetailer', 'detailer', 'facerestore', 'faceswap', 'reactor', 'portrait'],
  background: ['background', 'rmbg', 'matting', 'remove bg', 'cutout', 'birefnet'],
  partial: ['inpaint', 'outpaint', 'mask', 'segment', 'sam2', 'sam ', 'crop'],
  upscale: ['upscal', 'super resolution', 'super-resolution', 'esrgan', 'supir', 'tile'],
  pose: ['pose', 'controlnet', 'openpose', 'depth', 'canny', 'lineart', 'preprocessor'],
  style: ['ipadapter', 'ip-adapter', 'style', 'lora', 'reference image'],
  video: ['video', 'animatediff', 'animate', 'wan ', 'wan2', 'ltx', 'frame interpolation', 'hunyuan', 'cogvideo'],
  color: ['color', 'colour', 'grading', 'lut', 'tone', 'film grain', 'filter'],
  caption: ['caption', 'tagger', 'florence', 'vlm', 'ocr', 'image to text', 'describe'],
  light: ['relight', 'lighting', 'illumination'],
  handy: ['utility', 'utilities', 'helper', 'tools', 'switch', 'logic', 'math', 'batch', 'loop', 'reroute', 'quality of life', 'workflow'],
  audio: ['audio', 'voice', 'speech', 'tts', 'music', 'sound', 'whisper', 'vocal'],
  prompt: ['prompt', 'llm', 'gpt', 'ollama', 'translate', 'wildcard', 'text generation', 'chat'],
  model: ['loader', 'gguf', 'quantiz', 'nunchaku', 'checkpoint', 'diffusers', 'safetensors', 'merge'],
  three: ['3d', 'mesh', 'gaussian', 'hunyuan3d', 'trellis', 'point cloud', 'obj '],
  api: [' api', 'openai', 'gemini', 'replicate', 'fal.ai', 'comfy.org', 'cloud', 'stability', 'midjourney', 'runway', 'kling'],
  mask: ['mask', 'segment', 'sam2', 'sam3', 'matting'],
  animation: ['animate', 'animation', 'motion', 'liveportrait'],
  image: ['image filter', 'blend', 'composite', 'resize'],
  text: ['string', 'json', 'csv', 'text'],
  workflow: ['workflow', 'queue', 'loop', 'switch', 'logic'],
  performance: ['vram', 'memory', 'cache', 'speed', 'offload', 'tensorrt', 'torch.compile'],
  detect: ['detect', 'yolo', 'nsfw'],
  control: ['controlnet', 'reference'],
  files: ['load image', 'save image', 'metadata', 'exif', 'png info', 'folder', 'file ', 'import', 'export', 'webp', 'gif'],
};

/** The purposes a pack that is not in the catalog falls under. */
export function purposesFromText(text: string): PurposeId[] {
  const hay = ` ${text.toLowerCase()} `;
  return PURPOSES.filter((id) => WORDS[id]?.some((w) => hay.includes(w)));
}
