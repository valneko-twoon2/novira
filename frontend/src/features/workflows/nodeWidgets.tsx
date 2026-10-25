// Screens a custom node pack's node gets inside the editor, by ComfyUI node class. A node without an entry shows its
// fields only; adding a pack's editor is adding a line here (and its route to the backend's allowed pack routes).
import type { ComponentType } from 'react';
import { FaceRigNodeWidget } from './faceRig/FaceRigNodeWidget';

const WIDGETS: Record<string, ComponentType<{ nodeId: string }>> = {
  NKDFaceRig: FaceRigNodeWidget,
};

export function nodeWidget(comfyClass: string | undefined): ComponentType<{ nodeId: string }> | undefined {
  return comfyClass ? WIDGETS[comfyClass] : undefined;
}
