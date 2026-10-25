// Pictures the mock shows in place of generated ones: gallery images and model covers.
// 54 illustrations and 54 photographs, square 384 px WebP, served from public/mock-images/.
import { hashString } from './random';

const PER_SET = 54;

function pictureSet(folder: string): string[] {
  return Array.from({ length: PER_SET }, (_, i) => `/mock-images/${folder}/${String(i + 1).padStart(2, '0')}.webp`);
}

export const MOCK_PICTURES: readonly string[] = [...pictureSet('illust'), ...pictureSet('photo')];

/** The picture that stands for `key` (a seed, a model key, ...); the same key always gets the same picture. */
export function mockPicture(key: string | number): string {
  return MOCK_PICTURES[hashString(String(key)) % MOCK_PICTURES.length]!;
}
