// The picture a ComfyUI prompt reads, for the mock's jobs that work on a picture (erase, cut-out, caption).
import type { ComfyGraph } from '../types';

/** The name of the picture the prompt's first LoadImage node reads. */
export function sourceOf(graph: ComfyGraph): string | null {
  const load = Object.values(graph.prompt).find((n) => n.class_type === 'LoadImage');
  const image = load?.inputs.image as { $image?: string } | undefined;
  return image?.$image ?? null;
}
