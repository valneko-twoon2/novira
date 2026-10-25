// Runs a segmentation prompt through the queue and waits for the mask picture.
import type { ImageDTO } from '@/backend';
import { graphRequest } from '@/state/comfy/graphJob';
import { runJob } from '@/state/comfy/runGraph';
import { buildSegmentGraph, type Point } from './segmentGraph';

/** The mask picture for the points on a gallery picture; see `runJob` for how it ends. */
export function runSegmentation(imageName: string, points: Point[], signal?: AbortSignal): Promise<ImageDTO> {
  return runJob(graphRequest(buildSegmentGraph(imageName, points), 'intermediate'), signal);
}

export { runJob };
