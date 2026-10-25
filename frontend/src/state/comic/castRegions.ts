// A panel with several characters draws each in its own region: who stands where comes from the pose, and each
// character's words and reference picture act only inside the box around that person. Characters that are not placed (a
// monster, an animal without a pose) share the rest of the panel. The masks are drawn here and stored as intermediate
// pictures, so only their names go with the request.
import { backend } from '@/backend';
import { personBoxes, type Box } from './balloonPlace';
import type { ComicCharacter, ComicPanel, ComicProject } from './document';

/** One character of the panel and where it acts: a box in fractions of the panel, or null for the rest of the panel. */
export interface CastRegion {
  character: ComicCharacter;
  box: Box | null;
}

/** A character's region as stored pictures: the region of its words and of its reference picture (the same picture). */
export interface StoredRegion {
  character: ComicCharacter;
  imageUrl: string;
}

const clip = (b: Box): Box => {
  const x = Math.max(0, b.x);
  const y = Math.max(0, b.y);
  return { x, y, w: Math.max(0, Math.min(1, b.x + b.w) - x), h: Math.max(0, Math.min(1, b.y + b.h) - y) };
};

/** The character drawn as each person of the pose: by `poseCast`, else the human characters in the panel's order when they are as many as the people. */
function whoIsWho(characters: ComicCharacter[], panel: Pick<ComicPanel, 'poses' | 'poseCast'>): (ComicCharacter | null)[] {
  if (panel.poseCast?.some(Boolean)) return panel.poses.map((_, i) => characters.find((c) => c.id === panel.poseCast?.[i]) ?? null);
  const humans = characters.filter((c) => !c.nonHuman);
  return humans.length === panel.poses.length ? humans : [];
}

/**
 * Where each of the panel's characters acts, or null when the panel is drawn as a whole: fewer than two characters, no pose,
 * or nobody placed on a person.
 */
export function castRegions(project: Pick<ComicProject, 'cast'>, panel: Pick<ComicPanel, 'cast' | 'poses' | 'poseCast'>): CastRegion[] | null {
  const characters = panel.cast.flatMap((id) => project.cast.find((c) => c.id === id) ?? []);
  if (characters.length < 2 || !panel.poses.length) return null;
  const placed = new Map<string, Box>();
  whoIsWho(characters, panel).forEach((character, i) => {
    const box = personBoxes([panel.poses[i] ?? []])[0];
    if (character && box && !placed.has(character.id)) placed.set(character.id, clip(box));
  });
  if (!placed.size) return null;
  return characters.map((character) => ({ character, box: placed.get(character.id) ?? null }));
}

/** The region as a picture: white inside on black, at the panel's picture size. `null` is everything outside `others`. */
async function maskPicture(box: Box | null, others: Box[], width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const fill = (b: Box, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(b.x * width), Math.round(b.y * height), Math.round(b.w * width), Math.round(b.h * height));
  };
  ctx.fillStyle = box ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (box) fill(box, '#ffffff');
  else for (const b of others) fill(b, '#000000');
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
}

/** The masks already stored, by what they show: a panel drawn again (a retry, a repair) with the same people in the same places reuses them. */
const storedMasks = new Map<string, string>();
const STORED_MASKS_MAX = 200;

/** Draws and stores the region of each character (intermediate pictures), for a panel drawn at `width` × `height`. */
export async function storeCastRegions(regions: CastRegion[], width: number, height: number): Promise<StoredRegion[]> {
  const placed = regions.flatMap((r) => (r.box ? [r.box] : []));
  const stored: StoredRegion[] = [];
  for (const region of regions) {
    const key = JSON.stringify([width, height, region.box, region.box ? [] : placed]);
    let imageUrl = storedMasks.get(key);
    if (!imageUrl) {
      const picture = await maskPicture(region.box, placed, width, height);
      imageUrl = (await backend.uploadImage(picture, { boardId: null, isIntermediate: true, category: 'control' })).url;
      if (storedMasks.size >= STORED_MASKS_MAX) storedMasks.clear();
      storedMasks.set(key, imageUrl);
    }
    stored.push({ character: region.character, imageUrl });
  }
  return stored;
}
