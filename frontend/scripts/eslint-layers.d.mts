// Types for eslint-layers.mjs, so tests/structure.test.ts can read the exception list.
import type { Rule } from 'eslint';

export declare const LAYER_EXCEPTIONS: ReadonlyArray<readonly [from: string, to: string]>;
export declare const layerBoundaries: Rule.RuleModule;
