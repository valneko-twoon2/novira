// Which picture shows a draft candidate: the finished image once it exists, else the draft.
import type { ImageDTO } from '@/backend';
import type { DraftCandidate } from '@/state/drafts';

export function pictureOf(c: DraftCandidate, images: ImageDTO[]): { image: ImageDTO | undefined; finished: boolean } {
  const final = c.finalImageName ? images.find((i) => i.name === c.finalImageName) : undefined;
  if (final) return { image: final, finished: true };
  return { image: c.imageName ? images.find((i) => i.name === c.imageName) : undefined, finished: false };
}
