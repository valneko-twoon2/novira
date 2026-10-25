// ComfyUI's own words for its nodes in the app's language (see `state/comfy/comfyUiLocale`), each with the English
// name to fall back on. Components that show them subscribe with `useComfyWords` so they change when the words arrive.
import { useComfyUiLocale } from '@/state/comfy/comfyUiLocale';

const words = () => useComfyUiLocale.getState().words;

/** Re-renders the caller when ComfyUI's words arrive or change. */
export const useComfyWords = () => useComfyUiLocale((s) => s.words);

/** ComfyUI's name of one part of a node category (`model` → `modèle` in French); the part itself when it has none. */
export const comfyCategoryLabel = (part: string) => words()?.categories[part] || part;

/** The headings of the node library's sections, when ComfyUI has them. */
export const comfyHeadings = () => ({ core: words()?.comfyNodesHeading ?? null, extensions: words()?.extensionsHeading ?? null });

const node = (comfyClass: string | undefined) => (comfyClass ? words()?.nodes[comfyClass] : undefined);

export const comfyNodeName = (comfyClass: string | undefined) => node(comfyClass)?.name ?? null;
export const comfyNodeDescription = (comfyClass: string | undefined) => node(comfyClass)?.description ?? null;
export const comfyInputName = (comfyClass: string | undefined, input: string) => node(comfyClass)?.inputs[input]?.name ?? null;
export const comfyInputTooltip = (comfyClass: string | undefined, input: string) => node(comfyClass)?.inputs[input]?.tooltip ?? null;
export const comfyOutputName = (comfyClass: string | undefined, index: number) => node(comfyClass)?.outputs[String(index)]?.name ?? null;
