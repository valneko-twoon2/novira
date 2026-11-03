import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useCanvas } from './canvas';
import { fixPartOnCanvas } from './partFix';

const initial = useCanvas.getState();
const image = { name: 'a.png', url: 'blob:a', width: 64, height: 48 } as ImageDTO;

beforeEach(() => useCanvas.setState(initial, true));

describe('fixPartOnCanvas', () => {
  it('opens the picture on a fresh canvas with an empty inpaint mask chosen and the brush in hand', () => {
    const importImage = vi.fn(() => {
      useCanvas.getState().clearCanvas();
      useCanvas.getState().addEntity('raster');
    });
    useCanvas.setState({ importImage, tool: 'move' });
    fixPartOnCanvas(image);
    expect(importImage).toHaveBeenCalledWith(image, 'newCanvasRaster');
    const s = useCanvas.getState();
    expect(s.entities.map((e) => e.type)).toEqual(['raster', 'inpaint']);
    expect(s.selectedEntityId).toBe(s.entities[1]!.id);
    expect(s.entities[1]!.objects).toEqual([]);
    expect(s.tool).toBe('brush');
  });
});
