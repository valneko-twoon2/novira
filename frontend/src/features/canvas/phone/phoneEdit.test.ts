// What the phone's canvas editor does to the canvas store: opening a picture alone with an empty mask and the mosaic in
// hand, the left form's size left alone until the editor closes, each phone tool picking its tool and layer, and taking
// a result wiping the mask.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useCanvas } from '@/state/canvas';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { acceptOnPhone, closePhoneEdit, openForPhoneEdit, phoneMask, phoneToolOf, takePhoneTool } from './phoneEdit';

vi.mock('@/state/toasts', async (original) => ({ ...(await original<typeof import('@/state/toasts')>()), toast: vi.fn() }));

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), params: useParams.getState() };
const c = () => useCanvas.getState();
const picture = (name: string, width = 1024, height = 768) => ({ name, url: `blob:${name}`, thumbnailUrl: 'blob:t', width, height, isIntermediate: false }) as ImageDTO;
const stroke = { kind: 'stroke' as const, id: 's', tool: 'brush' as const, color: { r: 1, g: 1, b: 1, a: 1 }, width: 10, points: [0, 0, 5, 5], clip: null };

beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState(initial.gallery, true);
  useParams.setState({ ...initial.params, width: 832, height: 1216 });
});

describe('the phone canvas editor', { tags: [] }, () => {
  it('opens a picture alone with an empty mask and the mosaic in hand, leaving the form size and undo empty', { tags: ['scenario'] }, () => {
    c().addEntity('raster');
    c().addStagedImage('old.png');
    openForPhoneEdit(picture('a.png'));
    expect(c().entities.map((e) => e.type)).toEqual(['raster', 'inpaint']);
    expect(c().entities[0]?.objects[0]).toMatchObject({ kind: 'image', imageName: 'a.png', x: 0, y: 0, width: 1024, height: 768 });
    expect(c().bbox).toEqual({ x: 0, y: 0, width: 1024, height: 768 });
    expect(c().stagedImageNames).toEqual([]);
    expect(c().tool).toBe('mosaic');
    expect(c().selectedEntityId).toBe(c().entities[0]?.id);
    expect(c().past).toEqual([]);
    expect(useParams.getState()).toMatchObject({ width: 832, height: 1216 });
  });

  it('keeps the form size through undo, and lets the box and the form follow each other again after closing', { tags: ['state-transition'] }, () => {
    openForPhoneEdit(picture('a.png'));
    c().addObject(c().entities[0]!.id, stroke);
    c().undo();
    c().redo();
    expect(useParams.getState()).toMatchObject({ width: 832, height: 1216 });
    expect(c().sizeSync).toBe(false);
    closePhoneEdit();
    expect(c().sizeSync).toBe(true);
    c().undo();
    expect(useParams.getState()).toMatchObject({ width: 1024, height: 768 });
  });

  it('puts each phone tool in hand with its layer, making a mask when there is none', { tags: ['decision-table'] }, () => {
    openForPhoneEdit(picture('a.png'));
    const [raster, mask] = c().entities;
    takePhoneTool('mask');
    expect([c().tool, c().selectedEntityId]).toEqual(['brush', mask?.id]);
    takePhoneTool('unmask');
    expect([c().tool, c().selectedEntityId]).toEqual(['eraser', mask?.id]);
    takePhoneTool('mosaic');
    expect([c().tool, c().selectedEntityId]).toEqual(['mosaic', raster?.id]);
    c().removeEntity(mask!.id);
    takePhoneTool('mask');
    expect(phoneMask(c().entities)).toBeDefined();
    expect(phoneToolOf('brush')).toBe('mask');
    expect(phoneToolOf('lasso')).toBeNull();
  });

  it('takes a result as a layer over the picture, wipes the mask and goes on with the tool in hand', { tags: ['scenario', 'state-transition'] }, () => {
    openForPhoneEdit(picture('a.png'));
    useGallery.setState({ images: [picture('result.png')] });
    takePhoneTool('mask');
    c().addObject(phoneMask(c().entities)!.id, stroke);
    c().addStagedImage('result.png');
    acceptOnPhone();
    const rasters = () => c().entities.filter((e) => e.type === 'raster');
    expect(rasters()).toHaveLength(2);
    expect(rasters()[1]?.objects[0]).toMatchObject({ imageName: 'result.png' });
    expect(phoneMask(c().entities)?.objects).toEqual([]);
    expect(c().stagedImageNames).toEqual([]);
    expect([c().tool, c().selectedEntityId]).toEqual(['brush', phoneMask(c().entities)?.id]);
    // The mosaic then works on the result, the picture on top.
    takePhoneTool('mosaic');
    expect(c().selectedEntityId).toBe(rasters()[1]?.id);
    // One undo brings back the painted mask and takes the result away.
    c().undo();
    expect(c().entities.map((e) => e.type)).toEqual(['raster', 'inpaint']);
    expect(phoneMask(c().entities)?.objects).toHaveLength(1);
  });
});
