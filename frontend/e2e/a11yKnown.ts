// The axe rules that still fail on a tab, with the most nodes each may report (a11y.spec.ts). Fix a violation, then lower
// or delete its entry; never raise one.
export const KNOWN: Record<string, Record<string, number>> = {
  models: { 'label-content-name-mismatch': 13, 'nested-interactive': 27 },
};
