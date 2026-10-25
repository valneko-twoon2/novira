import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_VIEW, IMAGE_SCALE_RANGE } from './document';
import { clampScale, coverSize, fitImage, moveImage, pictureBox, placePicture, resizeImage, rotateImage, zoomImageAt } from './imageView';

const box = { width: 200, height: 100 };

describe('the size of a picture that covers its panel', () => {
  it('keeps the picture shape and covers the box: a square picture in a wide box is as wide as the box', () => {
    expect(coverSize({ width: 50, height: 50 }, box)).toEqual({ width: 200, height: 200 });
  });

  it('makes a wide picture as tall as a square box', () => {
    expect(coverSize({ width: 400, height: 100 }, { width: 100, height: 100 })).toEqual({ width: 400, height: 100 });
  });

  it('takes the box shape while the picture size is not known', () => {
    expect(coverSize(null, box)).toEqual(box);
    expect(coverSize({ width: 0, height: 0 }, box)).toEqual(box);
  });
});

describe('where a picture sits in its panel', () => {
  it('covers the panel from its middle at the default view', () => {
    expect(pictureBox(DEFAULT_IMAGE_VIEW, { width: 50, height: 50 }, box)).toEqual({ cx: 100, cy: 50, width: 200, height: 200 });
  });

  it('is half as large at scale 0.5, centred where its view says', () => {
    expect(pictureBox({ ...DEFAULT_IMAGE_VIEW, cx: 0, cy: 1, scale: 0.5 }, { width: 50, height: 50 }, box)).toEqual({ cx: 0, cy: 100, width: 100, height: 100 });
  });

  it('gives the same place as fractions of the panel and of the page', () => {
    // A panel in the right half of a page twice as tall as it is wide.
    const { panel, page } = placePicture({ ...DEFAULT_IMAGE_VIEW, cx: 0.25 }, null, { x: 0.5, y: 0, width: 0.5, height: 0.5 }, 2);
    expect(panel).toEqual({ cx: 0.25, cy: 0.5, width: 1, height: 1 });
    expect(page).toEqual({ cx: 0.625, cy: 0.25, width: 0.5, height: 0.5 });
  });
});

describe('the handles of a picture', () => {
  it('moves the picture with the pointer, as a share of the panel', () => {
    expect(moveImage(DEFAULT_IMAGE_VIEW, 50, -25, box)).toMatchObject({ cx: 0.75, cy: 0.25 });
  });

  it('lets a picture go partly out of its panel, but keeps its centre within reach', () => {
    expect(moveImage(DEFAULT_IMAGE_VIEW, 160, 0, box).cx).toBeCloseTo(1.3);
    expect(moveImage(DEFAULT_IMAGE_VIEW, 100000, -100000, box)).toMatchObject({ cx: 2, cy: -1 });
  });

  it('does not move a picture in a panel with no size', () => {
    expect(moveImage(DEFAULT_IMAGE_VIEW, 50, 50, { width: 0, height: 0 })).toEqual(DEFAULT_IMAGE_VIEW);
  });

  it('resizes about the centre by how much farther the pointer is from it', () => {
    const centre = { x: 0, y: 0 };
    expect(resizeImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 20, y: 0 }).scale).toBeCloseTo(2);
    expect(resizeImage(DEFAULT_IMAGE_VIEW, centre, { x: 0, y: 10 }, { x: 0, y: 5 }).scale).toBeCloseTo(0.5);
  });

  it('keeps the size within its range, and ignores a press on the centre', () => {
    const centre = { x: 0, y: 0 };
    expect(resizeImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 10000, y: 0 }).scale).toBe(IMAGE_SCALE_RANGE.max);
    expect(resizeImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 0, y: 0 }).scale).toBe(IMAGE_SCALE_RANGE.min);
    expect(resizeImage(DEFAULT_IMAGE_VIEW, centre, { x: 0, y: 0 }, { x: 50, y: 0 })).toEqual(DEFAULT_IMAGE_VIEW);
  });

  it('turns by the angle the pointer goes round the centre, and snaps with Shift', () => {
    const centre = { x: 0, y: 0 };
    // From the right of the centre to below it is a quarter turn clockwise on the screen (y goes down).
    expect(rotateImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 0, y: 10 }).rotation).toBeCloseTo(90);
    expect(rotateImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 10, y: 1 }, true).rotation).toBe(0);
    expect(rotateImage(DEFAULT_IMAGE_VIEW, centre, { x: 10, y: 0 }, { x: 10, y: 3 }, true).rotation).toBe(15);
  });

  it('keeps the angle within -180 to 180', () => {
    const turned = rotateImage({ ...DEFAULT_IMAGE_VIEW, rotation: 170 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 });
    expect(turned.rotation).toBeCloseTo(-100);
  });
});

describe('fitting a picture to its panel', () => {
  const moved = { ...DEFAULT_IMAGE_VIEW, cx: 0.1, cy: 0.9, scale: 3, rotation: 45, flipX: true };

  it('fills the panel: back in the middle, unturned, at scale 1, still mirrored', () => {
    expect(fitImage('cover', moved, { width: 50, height: 50 }, box)).toEqual({ ...DEFAULT_IMAGE_VIEW, flipX: true });
  });

  it('shows the whole picture: a square picture in a box twice as wide is half the cover size', () => {
    expect(fitImage('contain', moved, { width: 50, height: 50 }, box).scale).toBeCloseTo(0.5);
  });

  it('fills the panel when the picture size is not known', () => {
    expect(fitImage('contain', moved, null, box).scale).toBe(1);
  });
});

describe('scaling a picture about a point (Alt and the mouse wheel)', () => {
  it('keeps the point under the pointer where it is', () => {
    const view = { ...DEFAULT_IMAGE_VIEW, cx: 0.4, cy: 0.6 };
    const at = { x: 0.1, y: 0.9 };
    const zoomed = zoomImageAt(view, 2, at);
    expect(zoomed.scale).toBe(2);
    // The point under the pointer is the same share of the picture before and after.
    expect((at.x - zoomed.cx) / zoomed.scale).toBeCloseTo((at.x - view.cx) / view.scale);
    expect((at.y - zoomed.cy) / zoomed.scale).toBeCloseTo((at.y - view.cy) / view.scale);
  });

  it('stops at the ends of the scale range without moving the picture', () => {
    const view = { ...DEFAULT_IMAGE_VIEW, scale: IMAGE_SCALE_RANGE.max };
    expect(zoomImageAt(view, 2, { x: 0, y: 0 })).toEqual(view);
  });
});

describe('the scale range', () => {
  it('clamps a scale, and an unknown scale to 1', () => {
    expect(clampScale(0.01)).toBe(IMAGE_SCALE_RANGE.min);
    expect(clampScale(99)).toBe(IMAGE_SCALE_RANGE.max);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});
