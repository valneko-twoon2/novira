// @vitest-environment jsdom
// The page's layer stack: a user's raster is drawn again only when its own drawing or its pictures' addresses change.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { ImageObject, RasterEntity } from '@/state/canvas';
import { emptyPage } from '@/state/comic/document';
import * as entityRender from '@/ui/canvasDraw/entityRender';
import { PageLayerStack } from './PageLayers';

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  canvases = installRecordingCanvases();
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.restoreAllMocks();
});

const picture: ImageObject = { kind: 'image', id: 'i', url: '', imageName: 'one.png', x: 0, y: 0, width: 40, height: 40 };
const layer: RasterEntity = { id: 'r', type: 'raster', seq: 3, name: 'r', isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [picture] };

function pageWith(entity: RasterEntity) {
  const page = emptyPage(1);
  return { ...page, canvas: { ...page.canvas, entities: [...page.canvas.entities, entity] } };
}

describe('PageLayerStack', () => {
  it('draws a layer again only when its pictures change, not when the gallery lookup is a new map', () => {
    const draw = vi.spyOn(entityRender, 'renderEntity');
    const page = pageWith(layer);
    const stack = (urls: Map<string, string>) => <PageLayerStack page={page} urls={urls} panels={null} balloons={null} />;
    const { rerender } = render(stack(new Map([['one.png', 'a.png']])));
    const first = draw.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    rerender(stack(new Map([['one.png', 'a.png'], ['other.png', 'b.png']])));
    expect(draw.mock.calls.length).toBe(first);
    rerender(stack(new Map([['one.png', 'c.png']])));
    expect(draw.mock.calls.length).toBeGreaterThan(first);
  });
});
