// The axe rules that still fail on a tab, with the most nodes each may report (a11y.spec.ts). Fix a violation, then lower
// or delete its entry; never raise one.
export const KNOWN: Record<string, Record<string, number>> = {
  generate: { 'label-content-name-mismatch': 5 },
  comic: { 'label-content-name-mismatch': 5 },
  canvas: { 'label-content-name-mismatch': 6 },
  upscaling: { 'label-content-name-mismatch': 4 },
  workflows: { 'label-content-name-mismatch': 5 },
  models: { 'label-content-name-mismatch': 15, 'nested-interactive': 27 },
  browse: { 'label-content-name-mismatch': 2 },
  queue: { 'label-content-name-mismatch': 2 },
};
