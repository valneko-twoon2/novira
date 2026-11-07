// What the zoom checks (a11yZoom.spec.ts) still find at a zoom level: `problems` are exact messages, `most` the most controls
// that may report an `overflow` or `offscreen` fault of the layout scan. Fix the layout, then lower or delete the entry; never
// raise one to make a new fault pass.
export const KNOWN_ZOOM: Record<string, { problems?: string[]; most?: { overflow?: number; offscreen?: number } }> = {};
