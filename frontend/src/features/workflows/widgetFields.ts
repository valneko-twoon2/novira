// Fields of a custom node that its own editor screen controls (see nodeWidgets.tsx). The assistant must not write them:
// their text is a format only the editor produces.
const OWNED: Record<string, string[]> = {
  NKDFaceRig: ['rig'],
};

export function widgetOwnedFields(nodeType: string): string[] {
  return OWNED[nodeType.replace(/^comfy:/, '')] ?? [];
}
