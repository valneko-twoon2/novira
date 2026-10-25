// Saved workflows, custom node packs and the Face Rig preview.
import type { ComfyUiLocale, FaceRigPreviewRequest, NodePacks, SavedWorkflow } from '../../types';
import type { WorkflowInput } from './helpers';

export const savedWorkflow = {
  id: 'wf-1',
  name: 'Mine',
  description: 'A workflow',
  author: 'me',
  tags: ['portrait'],
  category: 'user',
  updatedAt: 1700000000000,
  graph: { nodes: [], edges: [] },
} satisfies Required<SavedWorkflow>;

export const workflowInput = {
  id: 'wf-1',
  name: 'Mine',
  description: 'A workflow',
  author: 'me',
  tags: ['portrait'],
  graph: { nodes: [], edges: [] },
} satisfies Required<WorkflowInput>;

export const nodePacks = {
  available: true,
  installed: [
    { folder: 'ComfyUI-Impact-Pack', url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack', version: 'v8.1.0' },
    { folder: 'by-hand', url: null, version: null },
  ],
  comfyVersion: '0.3.50',
  restartNeeded: true,
} satisfies Required<NodePacks>;

export const faceRigPreviewRequest = {
  nodeKey: 'node-1',
  image: 'abc.png',
  rig: '{}',
  quality: 'final',
  cropFactor: 2.5,
  srcRatio: 1.5,
  faceIndex: 1,
} satisfies Required<FaceRigPreviewRequest>;

export const comfyUiLocale = {
  full: {
    categories: { model: 'Modèle', 'background removal': 'Fond' },
    comfyNodesHeading: 'Nœuds Comfy',
    extensionsHeading: 'Extensions',
    nodes: {
      KSampler: {
        name: 'Échantillonneur',
        description: 'Débruite',
        inputs: { seed: { name: 'Graine', tooltip: null } },
        outputs: { '0': { name: null, tooltip: 'Latent' } },
      },
    },
  },
  empty: { categories: {}, comfyNodesHeading: null, extensionsHeading: null, nodes: {} },
} satisfies Record<string, ComfyUiLocale>;
