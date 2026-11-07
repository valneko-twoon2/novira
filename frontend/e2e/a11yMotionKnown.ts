// The motion that still runs under "reduce motion" on a screen (a11yMotion.spec.ts). Fix the style (a
// `@media (prefers-reduced-motion: reduce)` rule), then delete its entry; never add one to make a new fault pass.
export const KNOWN_MOTION: Record<string, string[]> = {
  // The dashed line of an animated graph edge runs for ever (workflows.css wf-dash); no reduced-motion rule covers it.
  workflows: ['path infinite animation wf-dash'],
};
