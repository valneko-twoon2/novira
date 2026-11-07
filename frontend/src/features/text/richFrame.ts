// The frame of a "finish with AI" run: the box around the letters, and the size of the picture the model draws it in.

export interface RichFrame {
  /** The box around the layer's centre, in image pixels at the layer's font size: the letters, a margin and the aspect limit. */
  boxWidth: number;
  boxHeight: number;
  /** The picture the model gets, each side a multiple of 16. */
  width: number;
  height: number;
  /** Picture pixels per image pixel. */
  scale: number;
}

/** The margin on each side, as a share of the font size: room for the look to spill, and the models draw better off the edge. */
export const FRAME_MARGIN = 0.5;
/** The longest side may be this many times the shortest. */
const MAX_ASPECT = 3;
const SIDE_MIN = 512;
const SIDE_MAX = 2048;
const STEP = 16;

const toStep = (v: number) => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(v / STEP) * STEP));

/**
 * `half` is the half size of the letters (without their outline), `fontSize` the layer's, `area` the picture area the model
 * draws best (its own default size, in pixels). The picture keeps the box's aspect, clamped to 1:3 .. 3:1 by growing the short
 * side; one scale maps the box onto it, so a letter is never stretched.
 */
export function richFrame(half: { hw: number; hh: number }, fontSize: number, area: number): RichFrame {
  const margin = fontSize * FRAME_MARGIN;
  let boxW = half.hw * 2 + margin * 2;
  let boxH = half.hh * 2 + margin * 2;
  if (boxW > boxH * MAX_ASPECT) boxH = boxW / MAX_ASPECT;
  else if (boxH > boxW * MAX_ASPECT) boxW = boxH / MAX_ASPECT;
  const fit = Math.sqrt(area / (boxW * boxH));
  const width = toStep(boxW * fit);
  const height = toStep(boxH * fit);
  // One scale for both sides: the letters must fit, so the tighter side decides and the other gains room.
  const scale = Math.min(width / boxW, height / boxH);
  return { boxWidth: width / scale, boxHeight: height / scale, width, height, scale };
}
