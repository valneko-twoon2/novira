// The manga finish on a picture that already exists: the picture goes through the pack's Manga Finish node and comes back as a
// colourless page. A try is a hidden (intermediate) picture; saving runs the same graph again into the gallery as a new picture.
import type { ComfyGraph, ImageDTO, MangaScreen } from '@/backend';
import { graphRequest } from '@/state/comfy/graphJob';
import { runJob } from '@/state/comfy/runGraph';

/** The node the finish runs on. */
export const MANGA_NODE = 'MangaFinish';

/** Picture in, the picture finished as a manga page out. */
export function buildMangaGraph(imageName: string, m: MangaScreen): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      finish: {
        class_type: MANGA_NODE,
        inputs: {
          image: ['source', 0],
          screen_lines: m.screenLines,
          white_point: m.whitePoint,
          black_point: m.blackPoint,
          light_tone: 0.18,
          dark_tone: 0.42,
          gradation: m.gradation,
          pen_threshold: 0.3,
          white_lines: m.whiteLines,
        },
      },
      save: { class_type: 'SaveImage', inputs: { images: ['finish', 0], filename_prefix: 'novira-manga' } },
    },
    outputs: ['save'],
  };
}

/** Runs a try and returns the finished picture (kept out of the gallery's lists). */
export function runMangaPreview(imageName: string, m: MangaScreen, signal?: AbortSignal): Promise<ImageDTO> {
  return runJob(graphRequest(buildMangaGraph(imageName, m), 'intermediate'), signal);
}

/**
 * Saves the finished page as a new gallery picture on the original's board; the original is not touched. It keeps the
 * original's prompts, model and seed in its metadata so the picture can still be read, and is named after the finish.
 */
export function saveMangaPage(source: ImageDTO, m: MangaScreen, workflowName: string, signal?: AbortSignal): Promise<ImageDTO> {
  const stored = source.metadata;
  return runJob(
    graphRequest(buildMangaGraph(source.name, m), 'gallery', source.boardId, {
      width: source.width,
      height: source.height,
      workflowName,
      ...(stored ? { positivePrompt: stored.positivePrompt, negativePrompt: stored.negativePrompt, modelKey: stored.modelKey, modelName: stored.modelName, seed: stored.seed } : {}),
    }),
    signal,
  );
}
