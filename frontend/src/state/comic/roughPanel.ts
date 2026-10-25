// Puts a 3D rough into its panel: the set is baked at the panel's picture size into the people as the camera sees them
// and a depth map (roughBake.ts), the OpenPose picture is drawn from the people, both pictures are stored in the gallery
// as control pictures, and the panel takes the rough, the people and the two pictures in one undo step.
import { backend } from '@/backend';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { drawPose, poseLineWidth } from '@/state/pose/pose';
import { POSE_JOINT_COUNT, type ComicPanel, type ComicPoint } from './document';
import { trackPose } from './posePreset';
import { newRough, type ComicRough } from './rough';
import { depthBuffer, depthPixels, seenPeople, type SeenPerson } from './roughBake';
import { liftPoses } from './roughView';
import { findPanel, useComic } from './store';

/** The people as the panel keeps them: each joint as a fraction of the panel. */
export function roughPoses(people: SeenPerson[], width: number, height: number): ComicPoint[][] {
  return people.map((p) => Array.from({ length: POSE_JOINT_COUNT }, (_, i) => ({ x: (p.points[i * 2] as number) / width, y: (p.points[i * 2 + 1] as number) / height })));
}

/**
 * The rough a panel's editor starts from. The panel's own rough while its depth map is current; once the pose was changed
 * another way (the depth map is gone), its camera and props with the people of the panel's pose stood up in front of the
 * camera, so the change is not lost; a panel with no rough starts from its pose, or from one standing person.
 */
export function roughFor(panel: Pick<ComicPanel, 'rough' | 'depthImageName' | 'poses'>, aspect: number): ComicRough {
  if (panel.rough && panel.depthImageName) return panel.rough;
  const base = panel.rough ?? newRough();
  if (!panel.rough && !panel.poses.length) return base;
  return { ...base, people: liftPoses(panel.poses, base.camera, aspect) };
}

function blank(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  return { canvas, ctx };
}

const pngOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));

/** Draws the people's OpenPose figures as the camera sees them, on black, without the joints something hides. */
export function drawSeenPeople(ctx: CanvasRenderingContext2D, people: SeenPerson[], width: number, height: number) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  const line = poseLineWidth({ x: 0, y: 0, width, height });
  for (const p of people) drawPose(ctx, { kind: 'pose', id: 'rough', points: p.points, hidden: p.hidden, width: line }, false);
}

/** Draws the depth map into a picture of its size. */
export function drawDepth(ctx: CanvasRenderingContext2D, pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number) {
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
}

/** The pictures a rough bakes into at the given size, and the people as fractions of the picture. */
export async function bakeRough(rough: ComicRough, width: number, height: number): Promise<{ pose: Blob; depth: Blob; poses: ComicPoint[][] }> {
  const buffer = depthBuffer(rough, width, height);
  const people = seenPeople(rough, buffer);
  const pose = blank(width, height);
  drawSeenPeople(pose.ctx, people, width, height);
  const depth = blank(width, height);
  drawDepth(depth.ctx, depthPixels(buffer), width, height);
  const [poseBlob, depthBlob] = await Promise.all([pngOf(pose.canvas), pngOf(depth.canvas)]);
  return { pose: poseBlob, depth: depthBlob, poses: roughPoses(people, width, height) };
}

/** The panel's pose as it is now, to tell whether it changed while a rough was baked and stored. */
const poseNow = (panelId: string) => findPanel(useComic.getState().projects, panelId)?.panel.poses ?? null;

/**
 * Bakes and stores the rough, then gives it to the panel unless the panel's pose changed meanwhile (the assistant or a
 * ready-made pose put one in) or the panel is gone: that later pose wins, and the rough's pictures stay in the gallery.
 */
async function putRough(panelId: string, rough: ComicRough, width: number, height: number): Promise<boolean> {
  const before = poseNow(panelId);
  const baked = await bakeRough(rough, width, height);
  const store = (picture: Blob) => backend.uploadImage(picture, { boardId: autoAddBoardId(), category: 'control' });
  const [pose, depth] = await Promise.all([store(baked.pose), store(baked.depth)]);
  useGallery.getState().addImage(pose);
  useGallery.getState().addImage(depth);
  if (before === null || poseNow(panelId) !== before) return false;
  useComic.getState().setPanelRough(panelId, rough, baked.poses, pose.name, depth.name);
  return true;
}

/**
 * Bakes a rough into a panel of the given picture size (in pixels). Drawing waits for it (posesReady), so a panel drawn
 * right after it gets its pictures. False when the panel's pose changed meanwhile, or the panel is gone, and kept it.
 */
export function applyRough(panelId: string, rough: ComicRough, width: number, height: number): Promise<boolean> {
  return trackPose(putRough(panelId, rough, width, height));
}
