// How a panel's picture sits in its panel: the rectangle it takes on the screen and on the saved page image, and the
// changes the picture's handles make (move, resize, turn, fit). Both the screen and the page image use these functions,
// so the page image shows what the screen showed.
import { clampImageView, DEFAULT_IMAGE_VIEW, IMAGE_SCALE_RANGE, normalizeRotation, type ComicImageView } from './document';

/** A width and a height in pixels. */
export interface Size {
  width: number;
  height: number;
}

/** A picture's place in pixels of its panel box: its centre and its size before it is turned. */
export interface PictureBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** The parts of a picture's view that can be put back to their defaults one by one. */
export const VIEW_PARTS = ['rotation', 'scale', 'position', 'flip'] as const;
export type ViewPart = (typeof VIEW_PARTS)[number];

/** The view with the given parts back at their defaults (the others are kept). */
export function resetView(view: ComicImageView, parts: readonly ViewPart[]): ComicImageView {
  const d = DEFAULT_IMAGE_VIEW;
  return {
    cx: parts.includes('position') ? d.cx : view.cx,
    cy: parts.includes('position') ? d.cy : view.cy,
    scale: parts.includes('scale') ? d.scale : view.scale,
    rotation: parts.includes('rotation') ? d.rotation : view.rotation,
    flipX: parts.includes('flip') ? d.flipX : view.flipX,
    flipY: parts.includes('flip') ? d.flipY : view.flipY,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A scale within the range a picture may be shrunk or enlarged to. */
export function clampScale(scale: number): number {
  return clamp(Number.isFinite(scale) ? scale : DEFAULT_IMAGE_VIEW.scale, IMAGE_SCALE_RANGE.min, IMAGE_SCALE_RANGE.max);
}

/**
 * The size of a picture that just covers a box, keeping the picture's shape. A picture whose size is not known yet
 * takes the box's shape.
 */
export function coverSize(image: Size | null, box: Size): Size {
  if (!image || !image.width || !image.height || !box.width || !box.height) return { width: box.width, height: box.height };
  const ratio = Math.max(box.width / image.width, box.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}

/** The picture's centre and size in pixels of a panel box of the given size. */
export function pictureBox(view: ComicImageView, image: Size | null, box: Size): PictureBox {
  const cover = coverSize(image, box);
  const scale = clampScale(view.scale);
  return { cx: view.cx * box.width, cy: view.cy * box.height, width: cover.width * scale, height: cover.height * scale };
}

/** The view after dragging the picture by `dx`, `dy` pixels in a panel box of the given size: the picture follows the pointer. */
export function moveImage(start: ComicImageView, dx: number, dy: number, box: Size): ComicImageView {
  if (!box.width || !box.height) return { ...start };
  return clampImageView({ ...start, cx: start.cx + dx / box.width, cy: start.cy + dy / box.height });
}

/**
 * The view after a corner of the picture is dragged: the picture grows or shrinks about its centre by how much farther
 * from the centre the pointer is than where it was pressed.
 */
export function resizeImage(start: ComicImageView, centre: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }): ComicImageView {
  const before = Math.hypot(from.x - centre.x, from.y - centre.y);
  const after = Math.hypot(to.x - centre.x, to.y - centre.y);
  if (before < 1) return { ...start };
  return clampImageView({ ...start, scale: clampScale(start.scale * (after / before)) });
}

/**
 * The view after the picture is scaled by `factor` about a point of its box (fractions of the box's width and height, as
 * the centre is): the point of the picture under it stays there, as a wheel zoom keeps the point under the pointer.
 */
export function zoomImageAt(start: ComicImageView, factor: number, at: { x: number; y: number }): ComicImageView {
  const scale = clampScale(start.scale * factor);
  const k = scale / clampScale(start.scale);
  return clampImageView({ ...start, scale, cx: at.x + (start.cx - at.x) * k, cy: at.y + (start.cy - at.y) * k });
}

/** How many degrees a turn snaps to while Shift is held. */
export const ROTATION_SNAP = 15;

/**
 * The view after the turning handle is dragged: the picture turns by the angle the pointer went round its centre. With
 * `snap` the angle is a multiple of ROTATION_SNAP.
 */
export function rotateImage(
  start: ComicImageView,
  centre: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
  snap = false,
): ComicImageView {
  const angle = (p: { x: number; y: number }) => (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI;
  let rotation = start.rotation + angle(to) - angle(from);
  if (snap) rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
  return { ...start, rotation: normalizeRotation(rotation) };
}

/**
 * The view that fits the picture to its panel, unturned and centred: `cover` fills the panel (the edges of a picture of
 * another shape are cut), `contain` shows the whole picture (the panel may have empty bands).
 */
export function fitImage(mode: 'cover' | 'contain', view: ComicImageView, image: Size | null, box: Size): ComicImageView {
  let scale = 1;
  if (mode === 'contain' && image && image.width && image.height && box.width && box.height) {
    const cover = Math.max(box.width / image.width, box.height / image.height);
    const contain = Math.min(box.width / image.width, box.height / image.height);
    scale = contain / cover;
  }
  return { ...view, cx: 0.5, cy: 0.5, rotation: 0, scale: clampScale(scale) };
}

/** A rectangle of a picture centred at (cx, cy), as fractions of what holds it. */
export interface Placement {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Where a panel's picture sits, as fractions of its panel box (`panel`, for the picture inside the panel) and of the page
 * (`page`, for its handles over the page). `box` is the panel's box in fractions of the page, and `aspect` the page's
 * height over its width.
 */
export function placePicture(
  view: ComicImageView,
  image: Size | null,
  box: { x: number; y: number; width: number; height: number },
  aspect: number,
): { panel: Placement; page: Placement } {
  const panelSize = { width: box.width, height: box.height * aspect };
  const picture = pictureBox(view, image, panelSize);
  const width = panelSize.width ? picture.width / panelSize.width : 0;
  const height = panelSize.height ? picture.height / panelSize.height : 0;
  return {
    panel: { cx: view.cx, cy: view.cy, width, height },
    page: { cx: box.x + view.cx * box.width, cy: box.y + view.cy * box.height, width: width * box.width, height: height * box.height },
  };
}
