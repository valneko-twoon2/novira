import { describe, expect, it } from 'vitest';
import { acceptsDrag, autoConnection, createNode, makeEdge, nodeAcceptsDrag } from './graph';
import { getTemplate } from './templates';

const node = (type: string, id: string) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id });
const nodes = [node('sdxl_model_loader', 'model'), node('denoise_latents', 'denoise'), node('l2i', 'decode'), node('save_image', 'save')];

describe('drag assist', () => {
  it('accepts only handles of the opposite side with a compatible type', () => {
    const fromUnet = { nodeId: 'model', handle: 'unet', side: 'source' as const };
    expect(acceptsDrag(nodes, [], fromUnet, { nodeId: 'denoise', handle: 'unet', side: 'target' })).toBe(true);
    expect(acceptsDrag(nodes, [], fromUnet, { nodeId: 'denoise', handle: 'latents', side: 'target' })).toBe(false);
    expect(acceptsDrag(nodes, [], fromUnet, { nodeId: 'denoise', handle: 'latents', side: 'source' })).toBe(false);
    expect(acceptsDrag(nodes, [], fromUnet, { nodeId: 'model', handle: 'vae', side: 'target' })).toBe(false);
  });

  it('refuses a connection that would close a cycle', () => {
    const edges = [makeEdge('denoise', 'latents', 'decode', 'latents')];
    const fromDecode = { nodeId: 'decode', handle: 'image', side: 'source' as const };
    expect(acceptsDrag(nodes, edges, fromDecode, { nodeId: 'save', handle: 'image', side: 'target' })).toBe(true);
    // Dragging an output backwards into a node that already feeds it would loop.
    const fromDenoise = { nodeId: 'denoise', handle: 'latents', side: 'source' as const };
    expect(acceptsDrag(nodes, [makeEdge('decode', 'image', 'denoise', 'latents')], fromDenoise, { nodeId: 'decode', handle: 'latents', side: 'target' })).toBe(false);
  });

  it('dims a node that has nothing to take the drag', () => {
    const fromImage = { nodeId: 'decode', handle: 'image', side: 'source' as const };
    expect(nodeAcceptsDrag(nodes, [], fromImage, 'save', getTemplate('save_image')!)).toBe(true);
    expect(nodeAcceptsDrag(nodes, [], fromImage, 'model', getTemplate('sdxl_model_loader')!)).toBe(false);
  });

  it('connects a drop on a node body to the first fitting handle, a free one first', () => {
    const fromUnet = { nodeId: 'model', handle: 'unet', side: 'source' as const };
    expect(autoConnection(nodes, [], fromUnet, 'denoise')).toMatchObject({ source: 'model', sourceHandle: 'unet', target: 'denoise', targetHandle: 'unet' });
    expect(autoConnection(nodes, [], fromUnet, 'save')).toBeNull();
    const fromDecode = { nodeId: 'decode', handle: 'image', side: 'source' as const };
    expect(autoConnection(nodes, [], fromDecode, 'save')).toMatchObject({ target: 'save', targetHandle: 'image' });
    // Dragging an input handle onto a node picks one of its outputs.
    const fromSaveImage = { nodeId: 'save', handle: 'image', side: 'target' as const };
    expect(autoConnection(nodes, [], fromSaveImage, 'decode')).toMatchObject({ source: 'decode', sourceHandle: 'image', target: 'save' });
  });
});
