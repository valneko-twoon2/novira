// Node definitions of ComfyUI's own nodes as it reports them (tooltips left out): the ones the video and music templates
// use, one deprecated node and one cloud API node, so the mock runs those templates and the editor leaves out what it
// should. Read from ComfyUI 0.38.0 (`novira-data/work/verify-wf/make-core-defs.mjs` writes the JSON); the model lists hold the pack files.
import type { ComfyNodeDefs } from '../types';
import defs from './comfyCoreDefs.json';

export const CORE_NODE_DEFS = defs as unknown as ComfyNodeDefs;
