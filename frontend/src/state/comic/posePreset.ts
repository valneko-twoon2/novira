// A ready-made pose from the canvas's list put into a panel: its people become the panel's poses, and the OpenPose picture
// the ControlNet reads is drawn at the panel's picture size, on black, as a control picture is.
import { backend } from '@/backend';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { placePreset, POSE_PRESETS, type PosePreset } from '@/state/pose/posePresets';
import { readPoseSpec, type PoseSpec } from '@/state/pose/poseSpec';
import { drawPose, poseLineWidth } from '@/state/pose/pose';
import type { PoseObject } from '@/state/canvas';
import { POSE_JOINT_COUNT, type ComicPoint } from './document';
import { useComic } from './store';

/** The ready-made pose with this id, if it is in the list. */
export const findPosePreset = (presetId: string) => POSE_PRESETS.find((p) => p.id === presetId) ?? null;

/** The joints of each person as fractions of the panel, so the pose editor and the picture agree on where they are. */
function fractions(objects: PoseObject[], width: number, height: number): ComicPoint[][] {
  return objects.map((o) => {
    const joints: ComicPoint[] = [];
    for (let i = 0; i < POSE_JOINT_COUNT; i++) joints.push({ x: (o.points[i * 2] ?? 0) / width, y: (o.points[i * 2 + 1] ?? 0) / height });
    return joints;
  });
}

/** The OpenPose picture of the people: their bones and joints in colour on black, at the given size. */
async function controlPicture(objects: PoseObject[], width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  for (const o of objects) drawPose(ctx, o, false);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
}

/** The poses being drawn and uploaded: a panel drawn before they are done would miss its control picture. */
const drawing = new Set<Promise<unknown>>();

/** Resolves when every pose put into a panel so far has its control picture (a failure is reported by whoever put it in). */
export async function posesReady(): Promise<void> {
  while (drawing.size) await Promise.allSettled([...drawing]);
}

/** Keeps a pose being drawn and uploaded in the list `posesReady` waits for, until it is done. */
export function trackPose<T>(job: Promise<T>): Promise<T> {
  drawing.add(job);
  const done = () => void drawing.delete(job);
  job.then(done, done);
  return job;
}

/** Draws the people of a preset in a panel of the given size and makes them the panel's poses, with their control picture. */
function putPose(panelId: string, preset: PosePreset, width: number, height: number): Promise<boolean> {
  return trackPose(makePose(panelId, preset, width, height));
}

async function makePose(panelId: string, preset: PosePreset, width: number, height: number): Promise<boolean> {
  const area = { x: 0, y: 0, width, height };
  const objects = placePreset(preset, area, poseLineWidth(area), []);
  if (!objects.length) return false;
  // The people are in the panel at once, so what follows (a balloon aimed at a speaker) can use where they stand; the
  // control picture, which takes a moment to draw and upload, replaces the old one when it is ready.
  useComic.getState().setPanelPose(panelId, fractions(objects, width, height), null);
  const picture = await controlPicture(objects, width, height);
  const image = await backend.uploadImage(picture, { boardId: autoAddBoardId(), category: 'control' });
  useGallery.getState().addImage(image);
  useComic.getState().setPanelPose(panelId, fractions(objects, width, height), image.name);
  return true;
}

/**
 * Puts a ready-made pose into a panel of the given picture size (in pixels). The people replace the panel's poses; the
 * picture is uploaded to the gallery as a control picture, like the pose editor's.
 */
export async function putPosePreset(panelId: string, presetId: string, width: number, height: number): Promise<boolean> {
  const preset = findPosePreset(presetId);
  return preset ? putPose(panelId, preset, width, height) : false;
}

/**
 * Puts people described by angles (the assistant's pose format, see poseSpec) into a panel, each standing where its own
 * x, y and size say. False when none of them can be read.
 */
export async function putPosePeople(panelId: string, people: unknown[], width: number, height: number): Promise<boolean> {
  const specs = people.map(readPoseSpec).filter((p): p is PoseSpec => p !== null);
  if (!specs.length) return false;
  return putPose(panelId, { id: 'assistant', label: 'comic.panel.pose', people: specs, composed: true }, width, height);
}
