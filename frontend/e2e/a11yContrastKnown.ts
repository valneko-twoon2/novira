// The screens whose text on a solid background still has too little contrast (a11yContrast.spec.ts), keyed by `<screen> (<theme>)`
// with the most elements that may fail. Fix the colour in src/theme/tokens.css, then lower or delete the entry; never raise one.
// The faint text token (--text-faint) is below 4.5:1 on the panel colours in both themes, which accounts for most of them; the
// worst are the board meta line (3.1:1 dark), the light theme's "React Flow" attribution (2.3:1), the node badge "output"
// (2.6:1) and the queue badge "processing" (2.6:1).
export const KNOWN_CONTRAST: Record<string, number> = {
  'generate (dark)': 9,
  'generate (light)': 9,
  'comic (dark)': 6,
  'comic (light)': 5,
  'canvas (dark)': 11,
  'canvas (light)': 10,
  'upscaling (dark)': 9,
  'upscaling (light)': 9,
  'workflows (dark)': 6,
  'workflows (light)': 8,
  'models (dark)': 2,
  'models (light)': 3,
  'browse (dark)': 1,
  'browse (light)': 2,
  'queue (dark)': 2,
  'queue (light)': 3,
  'settings dialog (light)': 1,
};
