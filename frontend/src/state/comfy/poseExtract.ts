// The ComfyUI prompt that finds the people in a picture and the parsing of its answer: the DWPose estimator of the
// ControlNet preprocessors pack (catalog id `controlnetAux`) reports each person's 18 body joints, and ComfyUI's
// "Preview as Text" node brings them back as the text of an OpenPose JSON (`runTextJob`). Checked on a real ComfyUI.
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The node that finds the joints; also how the app knows the pack is loaded. */
export const POSE_EXTRACT_NODE = 'DWPreprocessor';
/** The catalog id of the pack. */
export const POSE_EXTRACT_PACK = 'controlnetAux';

/** Fewest joints a detection needs to count as a person (the rest are noise: a hand, a shadow). */
const MIN_JOINTS = 5;
/** Most people taken from one picture; the biggest figures win. */
export const MAX_EXTRACTED_PEOPLE = 4;

/** One person: 18 joints as `x, y` pairs in 0 to 1 of the picture's width and height, and the joints that were not found. */
export interface ExtractedPerson {
  points: number[];
  hidden: number[];
}

/** The people found in a picture, and the shape of that picture (its width over its height). */
export interface ExtractedPoses {
  people: ExtractedPerson[];
  aspect: number;
}

/** Whether the pack's node is loaded in ComfyUI. */
export function poseExtractReady(defs: ComfyNodeDefs | null): boolean {
  return !!defs?.[POSE_EXTRACT_NODE];
}

/** The estimator files the node offers, best first: the 384 px network on the CPU-friendly runtime when present. */
function choice(defs: ComfyNodeDefs | null, field: string, wanted: readonly string[]): string | undefined {
  const spec = defs?.[POSE_EXTRACT_NODE]?.input.optional?.[field];
  const options = Array.isArray(spec) && Array.isArray(spec[0]) ? spec[0].map(String) : [];
  return wanted.find((w) => options.includes(w)) ?? options.find((o) => o !== 'None');
}

/** Picture in, the body joints of its people out as text (no picture is saved). Hands and faces are not asked for. */
export function buildPoseExtractGraph(imageName: string, defs: ComfyNodeDefs | null): ComfyGraph {
  const detector = choice(defs, 'bbox_detector', ['yolox_l.onnx']);
  const estimator = choice(defs, 'pose_estimator', ['dw-ll_ucoco_384.onnx']);
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      pose: {
        class_type: POSE_EXTRACT_NODE,
        inputs: {
          image: ['source', 0],
          detect_hand: 'disable',
          detect_body: 'enable',
          detect_face: 'disable',
          resolution: 512,
          ...(detector ? { bbox_detector: detector } : {}),
          ...(estimator ? { pose_estimator: estimator } : {}),
        },
      },
      // DWPreprocessor's outputs are the drawn picture and the keypoints: the keypoints are slot 1.
      show: { class_type: 'PreviewAny', inputs: { source: ['pose', 1] } },
    },
    outputs: ['show'],
  };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The people in the node's JSON answer (`[{ people: [{ pose_keypoints_2d: [x, y, score, ...] }], canvas_width,
 * canvas_height }]`, pixels). A joint with no score, a non-positive position or no number is "not found". People with
 * too few joints are dropped, and the biggest {@link MAX_EXTRACTED_PEOPLE} stay, left to right. Null when the answer is
 * not that JSON.
 */
export function parsePoseExtract(text: string): ExtractedPoses | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const frame: unknown = Array.isArray(data) ? data[0] : data;
  if (typeof frame !== 'object' || frame === null) return null;
  const { people, canvas_width: w, canvas_height: h } = frame as { people?: unknown; canvas_width?: unknown; canvas_height?: unknown };
  if (!Array.isArray(people) || !finite(w) || !finite(h) || w <= 0 || h <= 0) return null;
  const found: ExtractedPerson[] = [];
  for (const raw of people) {
    const flat = typeof raw === 'object' && raw !== null ? (raw as { pose_keypoints_2d?: unknown }).pose_keypoints_2d : undefined;
    if (!Array.isArray(flat) || flat.length < 54) continue;
    const points: number[] = [];
    const hidden: number[] = [];
    for (let j = 0; j < 18; j++) {
      const [x, y, score] = [flat[j * 3], flat[j * 3 + 1], flat[j * 3 + 2]];
      const ok = finite(x) && finite(y) && finite(score) && score > 0 && x > 0 && y > 0;
      if (!ok) hidden.push(j);
      points.push(ok ? Math.min(1, x / w) : 0, ok ? Math.min(1, y / h) : 0);
    }
    if (18 - hidden.length >= MIN_JOINTS) found.push({ points, hidden });
  }
  const height = (p: ExtractedPerson) => {
    const ys = p.points.filter((_, i) => i % 2 === 1 && !p.hidden.includes((i - 1) / 2));
    return Math.max(...ys) - Math.min(...ys);
  };
  const left = (p: ExtractedPerson) => p.points.filter((_, i) => i % 2 === 0 && !p.hidden.includes(i / 2)).reduce((a, b) => a + b, 0) / (18 - p.hidden.length);
  const biggest = found.sort((a, b) => height(b) - height(a)).slice(0, MAX_EXTRACTED_PEOPLE);
  return { people: biggest.sort((a, b) => left(a) - left(b)), aspect: w / h };
}
