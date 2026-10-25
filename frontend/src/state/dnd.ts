// Drag and drop of images onto targets (reference images, layers, upscale input, boards, workflow fields).
// A drag carries gallery image names directly, or a "deferred" source (for example a canvas layer) that only becomes a
// gallery image when it is dropped; drop targets call `resolveDropImages` and get names either way.
import type { DragEvent } from 'react';

export const IMAGE_MIME = 'application/x-novira-images';
export const DEFERRED_MIME = 'application/x-novira-deferred';

type Resolver = (id: string) => Promise<string | null>;
const resolvers = new Map<string, Resolver>();

/** Registers how a deferred drag source of `kind` turns into a gallery image name (null when it is empty). */
export function registerDragSource(kind: string, resolve: Resolver): () => void {
  resolvers.set(kind, resolve);
  return () => {
    if (resolvers.get(kind) === resolve) resolvers.delete(kind);
  };
}

export function setDragImages(e: DragEvent, names: string[]) {
  e.dataTransfer.setData(IMAGE_MIME, JSON.stringify(names));
  e.dataTransfer.effectAllowed = 'copyMove';
}

/** Starts a drag of something that is saved to the gallery only when it is dropped. */
export function setDeferredDrag(e: DragEvent, kind: string, id: string) {
  e.dataTransfer.setData(DEFERRED_MIME, JSON.stringify({ kind, id }));
  e.dataTransfer.effectAllowed = 'copy';
}

export function getDragImages(e: DragEvent): string[] {
  const raw = e.dataTransfer.getData(IMAGE_MIME);
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function getDeferred(e: DragEvent): { kind: string; id: string } | null {
  const raw = e.dataTransfer.getData(DEFERRED_MIME);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { kind?: unknown; id?: unknown };
    return typeof v.kind === 'string' && typeof v.id === 'string' ? { kind: v.kind, id: v.id } : null;
  } catch {
    return null;
  }
}

/**
 * Gallery image names of a drop: the dragged names, or the deferred source saved to the gallery first.
 * The drag data is read before the first await, while the browser still exposes it.
 */
export async function resolveDropImages(e: DragEvent): Promise<string[]> {
  const names = getDragImages(e);
  if (names.length) return names;
  const deferred = getDeferred(e);
  const resolve = deferred && resolvers.get(deferred.kind);
  if (!deferred || !resolve) return [];
  const name = await resolve(deferred.id);
  return name ? [name] : [];
}

export function hasDragImages(types: readonly string[]): boolean {
  return types.includes(IMAGE_MIME) || types.includes(DEFERRED_MIME) || types.includes('Files');
}

export function isImageDrag(e: DragEvent): boolean {
  return hasDragImages(e.dataTransfer.types);
}
