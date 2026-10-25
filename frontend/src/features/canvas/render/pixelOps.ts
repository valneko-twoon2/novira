// Pixel operations on raster layers, free of any canvas so they are tested on plain arrays: the bucket's flood fill and
// the one-pixel growth of its region. Pixels are RGBA bytes in rows from the top left, as `ImageData` holds them.

export interface PixelRegion {
  /** One byte a pixel: 1 inside the region. */
  mask: Uint8Array;
  /** The smallest box holding the region, in pixels of the image. */
  bounds: { x: number; y: number; width: number; height: number };
}

/** Whether two pixels differ by no more than `tolerance` in every channel (two fully clear pixels are always alike). */
function alike(data: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number, tolerance: number): boolean {
  const pa = data[i + 3] as number;
  if (pa === 0 && a === 0) return true;
  return (
    Math.abs(pa - a) <= tolerance &&
    Math.abs((data[i] as number) - r) <= tolerance &&
    Math.abs((data[i + 1] as number) - g) <= tolerance &&
    Math.abs((data[i + 2] as number) - b) <= tolerance
  );
}

/**
 * The connected region (four ways) around the pixel (`sx`, `sy`) whose colours are within `tolerance` (0 to 255, each
 * channel, alpha included) of that pixel's. Null when the pixel is outside the image.
 */
export function floodFillRegion(data: Uint8ClampedArray, width: number, height: number, sx: number, sy: number, tolerance: number): PixelRegion | null {
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  const start = (sy * width + sx) * 4;
  const r = data[start] as number;
  const g = data[start + 1] as number;
  const b = data[start + 2] as number;
  const a = data[start + 3] as number;
  const mask = new Uint8Array(width * height);
  const match = (x: number, y: number) => mask[y * width + x] === 0 && alike(data, (y * width + x) * 4, r, g, b, a, tolerance);
  let minX = sx;
  let maxX = sx;
  let minY = sy;
  let maxY = sy;
  // Scanlines: each run is filled across, then the rows above and below are searched for runs that touch it.
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop() as number;
    const x0 = stack.pop() as number;
    if (!match(x0, y)) continue;
    let left = x0;
    while (left > 0 && match(left - 1, y)) left--;
    let right = x0;
    while (right < width - 1 && match(right + 1, y)) right++;
    for (let x = left; x <= right; x++) mask[y * width + x] = 1;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= height) continue;
      let inRun = false;
      for (let x = left; x <= right; x++) {
        const ok = match(x, ny);
        if (ok && !inRun) stack.push(x, ny);
        inRun = ok;
      }
    }
  }
  return { mask, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

/** The region with every pixel next to it (four ways) added, so a fill reaches under the soft edge of a line. */
export function growRegion(region: PixelRegion, width: number, height: number): PixelRegion {
  const mask = new Uint8Array(region.mask);
  const { x: bx, y: by, width: bw, height: bh } = region.bounds;
  const x0 = Math.max(0, bx - 1);
  const y0 = Math.max(0, by - 1);
  const x1 = Math.min(width - 1, bx + bw);
  const y1 = Math.min(height - 1, by + bh);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (region.mask[i]) continue;
      if ((x > 0 && region.mask[i - 1]) || (x < width - 1 && region.mask[i + 1]) || (y > 0 && region.mask[i - width]) || (y < height - 1 && region.mask[i + width])) mask[i] = 1;
    }
  }
  return { mask, bounds: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}

/** The pixels of a region painted in one colour (alpha 0 to 1), over a box as large as the region's bounds. */
export function regionPixels(region: PixelRegion, width: number, color: { r: number; g: number; b: number; a: number }): Uint8ClampedArray {
  const { x: bx, y: by, width: bw, height: bh } = region.bounds;
  const out = new Uint8ClampedArray(bw * bh * 4);
  const alpha = Math.round(color.a * 255);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!region.mask[(by + y) * width + bx + x]) continue;
      const o = (y * bw + x) * 4;
      out[o] = color.r;
      out[o + 1] = color.g;
      out[o + 2] = color.b;
      out[o + 3] = alpha;
    }
  }
  return out;
}
