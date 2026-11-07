// The screens whose text on a solid background still has too little contrast (a11yContrast.spec.ts), keyed by `<screen> (<theme>)`
// with the most elements that may fail. Fix the colour in src/theme/tokens.css, then lower or delete the entry; never raise one.
export const KNOWN_CONTRAST: Record<string, number> = {};
