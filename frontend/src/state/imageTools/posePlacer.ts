// Where the poses read from a picture go: the canvas registers how it puts them on a control layer (features do not
// import each other), and the tool band calls it.
import type { ExtractedPoses } from '../comfy/poseExtract';

/** Puts the people on the canvas (replacing the layer's poses unless `add`) and shows it; false when nothing was placed. */
export type PosePlacer = (found: ExtractedPoses, add: boolean) => boolean;

let placer: PosePlacer | null = null;

export function registerPosePlacer(fn: PosePlacer): void {
  placer = fn;
}

export function placePoses(found: ExtractedPoses, add: boolean): boolean {
  return placer?.(found, add) ?? false;
}
