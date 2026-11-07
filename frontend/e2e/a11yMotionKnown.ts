// The motion that still runs under "reduce motion" on a screen (a11yMotion.spec.ts). Fix the style (a
// `@media (prefers-reduced-motion: reduce)` rule), then delete its entry; never add one to make a new fault pass.
export const KNOWN_MOTION: Record<string, string[]> = {};
