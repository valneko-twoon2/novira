import { describe, expect, it } from 'vitest';
import { MOCK_PICTURES } from './mockPictures';

describe('mock pictures', () => {
  it('ships 108 pictures, each one of the files in public/mock-images', () => {
    expect(MOCK_PICTURES).toHaveLength(108);
    expect(new Set(MOCK_PICTURES).size).toBe(108);
    expect(MOCK_PICTURES.every((p) => /^\/mock-images\/(illust|photo)\/\d{2}\.webp$/.test(p))).toBe(true);
  });
});
