// Node definitions of real custom node packs as their ComfyUI reports them (tooltips left out), so the mock
// runs the pack templates. Read from ComfyUI with the packs installed (node_packs_live.rs).
import type { ComfyNodeDefs } from '../types';
import defs from './comfyPackDefs.json';

export const PACK_NODE_DEFS = defs as unknown as ComfyNodeDefs;
