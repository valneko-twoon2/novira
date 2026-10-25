// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCanvasStore, useCanvas } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { useParams } from '@/state/params';
import { CanvasHotkeys, nudgeSelected, pastedImage, type CanvasHotkeysProps } from './CanvasHotkeys';

const initial = useCanvas.getState();
beforeEach(() => useCanvas.setState(initial, true));

const only = () => useCanvas.getState().entities[0]!;

describe('nudgeSelected', () => {
  it('moves the selected layer by 1 px, or 10 px with Shift, with the move tool', () => {
    const s = useCanvas.getState();
    s.addEntity('raster');
    s.setTool('move');
    expect(nudgeSelected('ArrowRight', false)).toBe(true);
    expect(nudgeSelected('ArrowDown', true)).toBe(true);
    expect([only().x, only().y]).toEqual([1, 10]);
  });

  it('leaves the layer alone for other tools, locked layers, other keys and an empty canvas', () => {
    expect(nudgeSelected('ArrowLeft', false)).toBe(false);
    const s = useCanvas.getState();
    const id = s.addEntity('raster');
    s.setTool('brush');
    expect(nudgeSelected('ArrowLeft', false)).toBe(false);
    s.setTool('move');
    expect(nudgeSelected('Enter', false)).toBe(false);
    s.updateEntity(id, { isLocked: true });
    expect(nudgeSelected('ArrowLeft', false)).toBe(false);
    expect([only().x, only().y]).toEqual([0, 0]);
  });

  it('leaves a slot where the host put it', () => {
    const s = useCanvas.getState();
    s.addEntity('raster', { slot: 'panels' });
    s.setTool('move');
    expect(nudgeSelected('ArrowRight', true)).toBe(false);
    expect([only().x, only().y]).toEqual([0, 0]);
  });
});

describe('pastedImage', () => {
  const event = (target: EventTarget | null, items: { kind: string; type: string }[]) =>
    ({ target, clipboardData: { items: items.map((i) => ({ ...i, getAsFile: () => new File(['x'], 'p.png', { type: i.type }) })) } }) as unknown as ClipboardEvent;

  it('takes the first picture on the clipboard', () => {
    const file = pastedImage(event(document.body, [{ kind: 'string', type: 'text/plain' }, { kind: 'file', type: 'image/png' }]));
    expect(file?.type).toBe('image/png');
  });

  it('ignores clipboards without a picture and pastes into text fields', () => {
    expect(pastedImage(event(document.body, [{ kind: 'string', type: 'text/plain' }]))).toBeNull();
    expect(pastedImage(event(document.createElement('textarea'), [{ kind: 'file', type: 'image/png' }]))).toBeNull();
  });
});

describe('the keys on a host that narrows them', () => {
  const params = useParams.getState();
  afterEach(() => {
    cleanup();
    useParams.setState(params, true);
  });
  const press = (key: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  const mount = (props: CanvasHotkeysProps) => {
    const store = createCanvasStore({ syncParams: false });
    const Keys = () => CanvasHotkeys(props);
    render(createElement(CanvasStoreProvider, { store }, createElement(Keys)));
    return store;
  };

  it('chooses only the tools the host offers', () => {
    const store = mount({ tools: ['brush', 'eraser'] });
    press('e');
    expect(store.getState().tool).toBe('eraser');
    press('c');
    press('h');
    press('o');
    expect(store.getState().tool).toBe('eraser');
  });

  it('leaves the view alone without view keys', () => {
    const zoom = (store: ReturnType<typeof mount>) => {
      const view = store.getState().viewport;
      press('+');
      press('0', { ctrlKey: true });
      press('R', { shiftKey: true });
      return store.getState().viewport !== view;
    };
    expect(zoom(mount({ viewKeys: false }))).toBe(false);
    cleanup();
    expect(zoom(mount({}))).toBe(true);
  });

  it('does not delete a chosen global reference image where they are not shown', () => {
    const store = mount({ refImages: false });
    const ref = useParams.getState().addRefImage();
    store.getState().select(ref);
    press('Delete');
    expect(useParams.getState().refImages.map((r) => r.id)).toContain(ref);
  });

  it('acts on the given store: undo of the page, not of the Image tab', () => {
    const store = mount({});
    store.getState().addEntity('raster');
    useCanvas.getState().addEntity('raster');
    press('z', { ctrlKey: true });
    expect(store.getState().entities).toEqual([]);
    expect(useCanvas.getState().entities).toHaveLength(1);
  });
});
