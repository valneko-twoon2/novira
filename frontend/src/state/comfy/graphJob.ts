// The queue request that runs a ComfyUI prompt the app wrote itself (a graph job). The prompt may hold the backend's
// placeholders (`{"$model": key}`, `{"$image": name}`, `{"$seed": true}`); `describe` fills what the gallery shows.
import type { ComfyGraph, EnqueueRequest, GenerationMetadata, QueueDestination } from '@/backend';

/** A queue request for the prompt, first in line. `intermediate` keeps the picture hidden; `gallery` shows it on a board. */
export function graphRequest(graph: ComfyGraph, destination: QueueDestination, boardId: string | null = null, describe: Partial<GenerationMetadata> = {}): EnqueueRequest {
  return {
    origin: 'workflows',
    destination,
    params: {
      generationMode: 'graph',
      positivePrompt: '',
      negativePrompt: '',
      modelKey: '',
      modelName: '',
      vaeKey: null,
      seed: 0,
      steps: 1,
      cfgScale: 0,
      cfgRescale: 0,
      scheduler: 'euler',
      width: 0,
      height: 0,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      ...describe,
    },
    iterations: 1,
    randomizeSeed: false,
    prepend: true,
    boardId,
    comfyGraph: graph,
  };
}
