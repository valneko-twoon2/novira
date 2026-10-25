// The turned pictures of version 1 picture layers (see migrateLayers.ts): a Canvas image object cannot turn, so the picture
// is drawn turned (and mirrored) into a new picture, stored as a hidden gallery image, and the layer's object takes it with
// the box the turned picture covers. This runs once the projects are read (persistence.ts); a project whose pictures could
// not all be turned is not written back during that run, so its version 1 document keeps the pictures as they were.
import { loadImage } from '@/backend';
import { storeHiddenPicture } from '../canvasDocument';
import type { ImageObject } from '../canvas';
import { findImage } from '../gallery';
import type { ProjectBake } from './document';
import type { RotationBake } from './migrateLayers';
import type { PageCanvas } from './pageCanvasDoc';
import { roundCoordinate } from './pageCanvasDoc';

/** The longest side of a turned picture, in pixels: a large picture is drawn smaller rather than not at all. */
const MAX_SIDE = 4096;

/** The box a picture `width` × `height` covers once turned by `rotation` degrees about its centre. */
export function turnedBox(width: number, height: number, rotation: number): { width: number; height: number } {
  const a = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

/** Draws the picture turned and mirrored as version 1 drew it, and returns a page-only address of the result. */
async function drawTurned(bake: RotationBake, url: string): Promise<string> {
  const image = await loadImage(url);
  // As many pixels per page pixel as the picture has, within MAX_SIDE.
  const turned = turnedBox(bake.width, bake.height, bake.rotation);
  const density = Math.min(image.naturalWidth / bake.width, MAX_SIDE / Math.max(turned.width, turned.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(turned.width * density));
  canvas.height = Math.max(1, Math.round(turned.height * density));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((bake.rotation * Math.PI) / 180);
  ctx.scale(bake.flipX ? -1 : 1, bake.flipY ? -1 : 1);
  const w = bake.width * density;
  const h = bake.height * density;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
  return URL.createObjectURL(blob);
}

/** The image object a baked picture takes: the turned picture over the box it covers, not mirrored (the picture is). */
export function bakedObject(bake: RotationBake, imageName: string): Pick<ImageObject, 'imageName' | 'url' | 'x' | 'y' | 'width' | 'height'> {
  const turned = turnedBox(bake.width, bake.height, bake.rotation);
  return {
    imageName,
    url: '',
    x: roundCoordinate(bake.cx - turned.width / 2),
    y: roundCoordinate(bake.cy - turned.height / 2),
    width: roundCoordinate(turned.width),
    height: roundCoordinate(turned.height),
  };
}

/** The page's layers with a baked picture in place of the unturned one; the same document when the object is gone. */
export function withBaked(doc: PageCanvas, bake: RotationBake, imageName: string): PageCanvas {
  let found = false;
  const entities = doc.entities.map((e) => {
    if (e.id !== bake.entityId) return e;
    return {
      ...e,
      objects: e.objects.map((o) => {
        if (o.id !== bake.objectId || o.kind !== 'image') return o;
        found = true;
        const { flipX: _x, flipY: _y, ...rest } = o;
        return { ...rest, ...bakedObject(bake, imageName) };
      }),
    };
  });
  return found ? { ...doc, entities } : doc;
}

/** Bakes one picture and returns the gallery name of the turned picture. */
export async function bakeOne(bake: RotationBake): Promise<string> {
  const source = findImage(bake.imageName);
  if (!source) throw new Error(`picture ${bake.imageName} is gone`);
  const url = await drawTurned(bake, source.url);
  try {
    return (await storeHiddenPicture(url)).name;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Bakes the pictures, project by project. `apply` puts a project's baked pictures in (all at once, so a project is never
 * half turned); the ids of the projects whose pictures could not all be baked are returned.
 */
export async function bakeRotations(bakes: ProjectBake[], apply: (projectId: string, baked: { bake: ProjectBake; imageName: string }[]) => void, bake = bakeOne): Promise<string[]> {
  const failed: string[] = [];
  const byProject = new Map<string, ProjectBake[]>();
  for (const b of bakes) byProject.set(b.projectId, [...(byProject.get(b.projectId) ?? []), b]);
  for (const [projectId, list] of byProject) {
    try {
      const baked: { bake: ProjectBake; imageName: string }[] = [];
      for (const b of list) baked.push({ bake: b, imageName: await bake(b) });
      apply(projectId, baked);
    } catch {
      failed.push(projectId);
    }
  }
  return failed;
}
