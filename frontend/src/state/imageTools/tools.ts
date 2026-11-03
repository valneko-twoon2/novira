// The picture tools of the viewer's tool band (fix the faces, remove the background, describe as a prompt, read the
// poses): their ids, the settings each one keeps between runs and what a run used. The settings are stored by
// `settings.ts`; `request.ts` turns them into a queue job.
import type { CaptionStyle } from '../comfy/caption';

export const IMAGE_TOOLS = ['facefix', 'cutout', 'caption', 'pose'] as const;
export type ImageToolId = (typeof IMAGE_TOOLS)[number];

export interface FaceFixSettings {
  /** A detector file of `faceDetectors`; null takes the first face detector ComfyUI lists. */
  detector: string | null;
  strength: number;
  sensitivity: number;
}

export interface CutoutSettings {
  /** A model of `cutoutModels`; null takes the best one the pack offers. */
  model: string | null;
  sensitivity: number;
  edge: number;
  background: 'alpha' | 'white';
}

export interface CaptionSettings {
  style: CaptionStyle;
}

/** Reading the poses has nothing to choose. */
export type PoseSettings = Record<never, never>;

export interface ToolSettings {
  facefix: FaceFixSettings;
  cutout: CutoutSettings;
  caption: CaptionSettings;
  pose: PoseSettings;
}

/** What the face fix takes from the picture unless the band says otherwise: its model and its prompt (null: the picture's). */
export interface FaceOverrides {
  modelKey: string | null;
  prompt: string | null;
}

export const NO_FACE_OVERRIDES: FaceOverrides = { modelKey: null, prompt: null };

/** The ranges the band offers; the defaults are in `DEFAULT_TOOL_SETTINGS`. */
export const TOOL_RANGES = {
  faceStrength: { min: 0.1, max: 0.8, step: 0.05 },
  faceSensitivity: { min: 0.1, max: 0.9, step: 0.05 },
  cutoutSensitivity: { min: 0.1, max: 1, step: 0.05 },
  cutoutEdge: { min: -10, max: 10, step: 1 },
} as const;

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  facefix: { detector: null, strength: 0.4, sensitivity: 0.5 },
  cutout: { model: null, sensitivity: 1, edge: 0, background: 'alpha' },
  caption: { style: 'tags' },
  pose: {},
};

/** The settings a finished or running job used, with what was taken from the picture resolved, to show beside its result. */
export type UsedSettings =
  | { tool: 'facefix'; modelName: string; detector: string; strength: number; sensitivity: number }
  | { tool: 'cutout'; model: string; sensitivity: number; edge: number; background: 'alpha' | 'white' }
  | { tool: 'caption'; style: CaptionStyle }
  | { tool: 'pose' };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** A number held to its range, or the default when it is not a number. */
function inRange(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;
}

const nameOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Stored settings read back: anything missing or of the wrong kind keeps its default, and each number its range. */
export function restoreToolSettings(stored: unknown): ToolSettings {
  const d = DEFAULT_TOOL_SETTINGS;
  const s = isObject(stored) ? stored : {};
  const face = isObject(s.facefix) ? s.facefix : {};
  const cut = isObject(s.cutout) ? s.cutout : {};
  const cap = isObject(s.caption) ? s.caption : {};
  return {
    facefix: {
      detector: nameOrNull(face.detector),
      strength: inRange(face.strength, TOOL_RANGES.faceStrength, d.facefix.strength),
      sensitivity: inRange(face.sensitivity, TOOL_RANGES.faceSensitivity, d.facefix.sensitivity),
    },
    cutout: {
      model: nameOrNull(cut.model),
      sensitivity: inRange(cut.sensitivity, TOOL_RANGES.cutoutSensitivity, d.cutout.sensitivity),
      edge: Math.round(inRange(cut.edge, TOOL_RANGES.cutoutEdge, d.cutout.edge)),
      background: cut.background === 'white' ? 'white' : 'alpha',
    },
    caption: { style: cap.style === 'sentence' ? 'sentence' : 'tags' },
    pose: {},
  };
}
