// The mock's answer to a DWPose estimator job (`DWPreprocessor` into "Preview as Text"): one standing person, in the
// OpenPose JSON the real node reports (pixels of the picture, 18 `x, y, score` triplets; the sample is a real answer).
import type { ComfyGraph } from '../types';

const BODY = [
  [169.8, 284.7], [163.6, 295.4], [170.5, 295.2], [175.1, 309.2], [177.0, 321.3], [156.7, 295.6], [152.1, 310.1], [150.9, 322.2], [169.1, 322.0],
  [168.1, 345.5], [167.0, 367.8], [158.2, 322.7], [160.2, 346.1], [160.2, 369.2], [169.5, 282.9], [165.9, 283.1], [168.9, 284.0], [158.6, 284.0],
];

/** Whether a graph job asks the DWPose estimator for the joints of a picture. */
export function isPoseExtractGraph(graph: ComfyGraph | null | undefined): boolean {
  return !!graph && Object.values(graph.prompt).some((n) => n.class_type === 'DWPreprocessor');
}

/** The JSON text of one person standing in a 384 px picture. */
export function mockPoseExtract(): string {
  const pose_keypoints_2d = BODY.flatMap(([x, y]) => [x, y, 1]);
  return JSON.stringify([{ people: [{ pose_keypoints_2d }], canvas_height: 384, canvas_width: 384 }], null, 4);
}
