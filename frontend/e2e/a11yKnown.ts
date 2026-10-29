// The axe rules that still fail on a tab, with the most nodes each may report (a11y.spec.ts). Fix a violation, then lower
// or delete its entry; never raise one.
const SIDE_AND_BUTTONS = { 'aria-required-children': 1, 'label-content-name-mismatch': 5 };
export const KNOWN: Record<string, Record<string, number>> = {
  generate: { 'aria-required-children': 2, 'label-content-name-mismatch': 5 },
  comic: SIDE_AND_BUTTONS,
  canvas: { 'aria-required-children': 2, 'label-content-name-mismatch': 6 },
  upscaling: { 'aria-required-children': 2, 'label-content-name-mismatch': 4 },
  workflows: { 'aria-required-children': 2, 'label-content-name-mismatch': 5 },
  models: { 'aria-required-children': 1, 'label-content-name-mismatch': 15, 'nested-interactive': 27 },
  browse: { 'aria-required-children': 1, 'label-content-name-mismatch': 2 },
  queue: { 'aria-required-children': 2, 'aria-required-parent': 1, 'label-content-name-mismatch': 2 },
};
