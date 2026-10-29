// @vitest-environment jsdom
// The right-click menu of a layer row, the items that call a canvas action: flip, turn, scale, invert, random pose, export.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useCanvas, type CanvasEntity, type EntityType } from '@/state/canvas';
import { ContextMenu, ContextMenuTrigger, TooltipProvider } from '@/ui';
import { EntityContextMenu } from './EntityContextMenu';

vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  transformEntity: vi.fn(),
  invertMask: vi.fn(),
  randomizePoses: vi.fn(),
  exportEntityToFile: vi.fn(),
}));
import { exportEntityToFile, invertMask, randomizePoses, transformEntity } from '../actions';

const initial = useCanvas.getState();
const state = () => useCanvas.getState();
const stroke = { kind: 'stroke', id: 's1', tool: 'brush', color: { r: 0, g: 0, b: 0, a: 1 }, width: 2, points: [10, 20, 110, 220], clip: null } as never;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useCanvas.setState(initial, true);
  vi.mocked(transformEntity).mockClear();
  vi.mocked(invertMask).mockClear();
  vi.mocked(randomizePoses).mockClear();
  vi.mocked(exportEntityToFile).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Adds a layer of the type, optionally with a stroke, and opens its menu. */
async function openMenu(type: EntityType, opts: { drawn?: boolean; locked?: boolean } = {}) {
  const id = state().addEntity(type);
  if (opts.drawn) state().addObject(id, stroke);
  if (opts.locked) state().updateEntity(id, { isLocked: true });
  const entity = state().entities.find((e) => e.id === id) as CanvasEntity;
  render(
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="row">row</div>
        </ContextMenuTrigger>
        <EntityContextMenu entity={entity} />
      </ContextMenu>
    </TooltipProvider>,
  );
  fireEvent.contextMenu(screen.getByTestId('row'));
  const menu = within(await screen.findByRole('menu'));
  return { id, menu };
}
const disabled = (menu: ReturnType<typeof within>, key: Parameters<typeof t>[0]) => menu.getByRole('menuitem', { name: t(key) }).getAttribute('aria-disabled') === 'true';

describe('layer menu actions', () => {
  it.each([
    ['rotateRight', 'canvas.entityMenu.rotateRight'],
    ['rotateLeft', 'canvas.entityMenu.rotateLeft'],
    ['scaleUp', 'canvas.entityMenu.scaleUp'],
    ['scaleDown', 'canvas.entityMenu.scaleDown'],
  ] as const)('runs %s on a drawn raster and control layer', async (op, key) => {
    for (const type of ['raster', 'control'] as const) {
      const { id, menu } = await openMenu(type, { drawn: true });
      expect(disabled(menu, key)).toBe(false);
      fireEvent.click(menu.getByRole('menuitem', { name: t(key) }));
      expect(transformEntity).toHaveBeenLastCalledWith(id, op, useCanvas);
      cleanup();
    }
  });

  it('disables turning and scaling for an empty layer, a locked layer and a mask', async () => {
    const empty = await openMenu('raster');
    expect(disabled(empty.menu, 'canvas.entityMenu.rotateRight')).toBe(true);
    expect(disabled(empty.menu, 'canvas.entityMenu.flipHorizontal')).toBe(true);
    expect(disabled(empty.menu, 'canvas.entityMenu.flipVertical')).toBe(true);
    cleanup();
    const locked = await openMenu('raster', { drawn: true, locked: true });
    expect(disabled(locked.menu, 'canvas.entityMenu.scaleUp')).toBe(true);
    expect(disabled(locked.menu, 'canvas.entityMenu.flipHorizontal')).toBe(false);
    cleanup();
    const mask = await openMenu('inpaint', { drawn: true });
    expect(disabled(mask.menu, 'canvas.entityMenu.scaleDown')).toBe(true);
    fireEvent.click(mask.menu.getByRole('menuitem', { name: t('canvas.entityMenu.scaleDown') }));
    expect(transformEntity).not.toHaveBeenCalled();
  });

  it('flips a drawn layer around the centre of its content', async () => {
    const first = await openMenu('raster', { drawn: true });
    fireEvent.click(first.menu.getByRole('menuitem', { name: t('canvas.entityMenu.flipHorizontal') }));
    const points = (id: string) => (state().entities.find((e) => e.id === id)!.objects[0] as { points: number[] }).points;
    // x mirrored around 60 (the middle of 10..110), y untouched.
    expect(points(first.id)).toEqual([110, 20, 10, 220]);
    cleanup();
    const second = await openMenu('raster', { drawn: true });
    fireEvent.click(second.menu.getByRole('menuitem', { name: t('canvas.entityMenu.flipVertical') }));
    expect(points(second.id)).toEqual([10, 220, 110, 20]);
  });

  it('offers invert only for masks, and disables it while locked', async () => {
    const raster = await openMenu('raster');
    expect(raster.menu.queryByRole('menuitem', { name: t('canvas.entityMenu.invertMask') })).toBeNull();
    cleanup();
    const inpaint = await openMenu('inpaint');
    fireEvent.click(inpaint.menu.getByRole('menuitem', { name: t('canvas.entityMenu.invertMask') }));
    expect(invertMask).toHaveBeenCalledWith(inpaint.id, useCanvas);
    cleanup();
    const regional = await openMenu('regional', { locked: true });
    expect(disabled(regional.menu, 'canvas.entityMenu.invertMask')).toBe(true);
    fireEvent.click(regional.menu.getByRole('menuitem', { name: t('canvas.entityMenu.invertMask') }));
    expect(invertMask).toHaveBeenCalledTimes(1);
  });

  it('offers a random pose only for control layers', async () => {
    const raster = await openMenu('raster');
    expect(raster.menu.queryByRole('menuitem', { name: t('canvas.pose.random') })).toBeNull();
    cleanup();
    const control = await openMenu('control');
    fireEvent.click(control.menu.getByRole('menuitem', { name: t('canvas.pose.random') }));
    expect(randomizePoses).toHaveBeenCalledWith(control.id, undefined, useCanvas);
    cleanup();
    const locked = await openMenu('control', { locked: true });
    expect(disabled(locked.menu, 'canvas.pose.random')).toBe(true);
  });

  it('exports the layer to a file', async () => {
    const { id, menu } = await openMenu('raster');
    fireEvent.click(menu.getByRole('menuitem', { name: t('canvas.entityMenu.exportToFile') }));
    expect(exportEntityToFile).toHaveBeenCalledWith(id, useCanvas);
  });
});
