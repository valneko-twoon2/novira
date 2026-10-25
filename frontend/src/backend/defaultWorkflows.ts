// The built-in workflows: editor graphs the frontend owns (the backend stores only the user's). The desktop app and the
// mock both start with them.
import type { SavedWorkflow } from './types';

export const DEFAULT_WORKFLOWS: SavedWorkflow[] = [
  { id: 'default-t2i-sd15', name: 'Text to Image - SD1.5', description: 'Sample text to image workflow for Stable Diffusion 1.5/2', author: 'novira', tags: ['text2image', 'SD1.5', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-t2i-sdxl', name: 'Text to Image - SDXL', description: 'Sample text to image workflow for SDXL', author: 'novira', tags: ['text2image', 'SDXL', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-i2i-sdxl', name: 'Image to Image - SDXL', description: 'Sample image to image workflow for SDXL', author: 'novira', tags: ['image2image', 'SDXL', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-video-t2v', name: 'Text to Video - Wan 2.2', description: 'Make a short video from a prompt', author: 'novira', tags: ['video', 'text2video', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-video-i2v', name: 'Image to Video - Wan 2.2', description: 'Animate a reference image', author: 'novira', tags: ['video', 'image2video', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-multidiffusion', name: 'MultiDiffusion SDXL', description: 'Upscale with tiled multidiffusion', author: 'novira', tags: ['upscale', 'SDXL', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
  { id: 'default-face-detailer', name: 'Face Detailer with IP-Adapter & Canny', description: 'Detects faces and re-renders them with IP-Adapter and Canny', author: 'novira', tags: ['face', 'controlnet', 'ip-adapter', 'default'], category: 'default', updatedAt: 1759000000000, graph: null },
];
