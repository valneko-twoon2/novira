// The axe rules that still fail on a surface, with the most nodes each may report (a11y.spec.ts). Fix a violation, then
// lower or delete its entry; never raise one.
export const KNOWN: Record<string, Record<string, number>> = {
  // While a Radix menu is open it marks the rest of the page aria-hidden but leaves what is in it focusable by script
  // (the focus itself is held inside the menu): a behaviour of the library, not of a screen of ours.
  'settings menu': { 'aria-hidden-focus': 1 },
  'picture menu': { 'aria-hidden-focus': 1 },
};
