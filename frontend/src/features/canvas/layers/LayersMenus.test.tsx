// @vitest-environment jsdom
// The right-click menu of a layer row and the layers panel header: arranging, converting, copying, saving, adding
// and clearing layers, and what another host (a comic page) lets the panel offer.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas, type EntityType } from '@/state/canvas';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useParams } from '@/state/params';
import { ContextMenu, ContextMenuTrigger, TooltipProvider } from '@/ui';
import { ADD_LABEL } from '../names';
import { EntityContextMenu } from './EntityContextMenu';
import { LayersPanel } from './LayersPanel';

vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  copyEntityToClipboard: vi.fn(),
  saveEntityToGallery: vi.fn(),
  mergeVisible: vi.fn(),
}));
import { copyEntityToClipboard, mergeVisible, saveEntityToGallery } from '../actions';

const initial = { canvas: useCanvas.getState(), params: useParams.getState() };
const state = () => useCanvas.getState();
let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
  useCanvas.setState(initial.canvas, true);
  useParams.setState(initial.params, true);
  vi.mocked(copyEntityToClipboard).mockClear();
  vi.mocked(saveEntityToGallery).mockClear();
  vi.mocked(mergeVisible).mockClear();
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
});

/** Opens the context menu of the entity with the given id. */
async function openEntityMenu(id: string) {
  const entity = state().entities.find((e) => e.id === id)!;
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
  return within(await screen.findByRole('menu'));
}

async function openSub(menu: ReturnType<typeof within>, label: string) {
  fireEvent.keyDown(menu.getByRole('menuitem', { name: label }), { key: 'ArrowRight' });
  await screen.findAllByRole('menu');
}

const itemNamed = (name: string) => screen.getByRole('menuitem', { name });

describe('layer row menu', () => {
  it('duplicates, copies, saves and deletes the layer', async () => {
    const id = state().addEntity('raster');
    const menu = await openEntityMenu(id);
    fireEvent.click(menu.getByText(t('canvas.entityMenu.copyToClipboard')));
    expect(copyEntityToClipboard).toHaveBeenCalledWith(id, useCanvas);

    cleanup();
    fireEvent.click((await openEntityMenu(id)).getByText(t('canvas.entityMenu.saveToGallery')));
    expect(saveEntityToGallery).toHaveBeenCalledWith(id, useCanvas);

    cleanup();
    fireEvent.click((await openEntityMenu(id)).getByText(t('canvas.entityMenu.duplicate')));
    expect(state().entities.filter((e) => e.type === 'raster')).toHaveLength(2);

    cleanup();
    fireEvent.click((await openEntityMenu(id)).getByText(t('common.delete')));
    expect(state().entities.some((e) => e.id === id)).toBe(false);
  });

  it('moves a layer in its group and disables the moves that go nowhere', async () => {
    const bottom = state().addEntity('raster');
    const top = state().addEntity('raster');
    const menu = await openEntityMenu(bottom);
    await openSub(menu, t('canvas.entityMenu.arrange'));
    expect(itemNamed(t('canvas.entityMenu.moveToBottom')).getAttribute('aria-disabled')).toBe('true');
    expect(itemNamed(t('canvas.entityMenu.moveDown')).getAttribute('aria-disabled')).toBe('true');
    expect(itemNamed(t('canvas.entityMenu.moveToTop')).getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(itemNamed(t('canvas.entityMenu.moveToTop')));
    expect(state().entities.filter((e) => e.type === 'raster').map((e) => e.id)).toEqual([top, bottom]);

    cleanup();
    const again = await openEntityMenu(bottom);
    await openSub(again, t('canvas.entityMenu.arrange'));
    fireEvent.click(itemNamed(t('canvas.entityMenu.moveToBottom')));
    expect(state().entities.filter((e) => e.type === 'raster').map((e) => e.id)).toEqual([bottom, top]);
  });

  it('steps a layer up and down one place', async () => {
    const a = state().addEntity('raster');
    const b = state().addEntity('raster');
    const c = state().addEntity('raster');
    const order = () => state().entities.filter((e) => e.type === 'raster').map((e) => e.id);
    const menu = await openEntityMenu(b);
    await openSub(menu, t('canvas.entityMenu.arrange'));
    fireEvent.click(itemNamed(t('canvas.entityMenu.moveUp')));
    expect(order()).toEqual([a, c, b]);
    cleanup();
    await openSub(await openEntityMenu(b), t('canvas.entityMenu.arrange'));
    fireEvent.click(itemNamed(t('canvas.entityMenu.moveDown')));
    expect(order()).toEqual([a, b, c]);
  });

  it('offers only the arrange items for a slot', async () => {
    const below = state().addEntity('raster');
    const slot = state().addEntity('raster', { slot: 'panels' });
    const menu = await openEntityMenu(slot);
    for (const key of ['canvas.entityMenu.duplicate', 'canvas.entityMenu.flipHorizontal', 'canvas.entityMenu.rotateRight', 'canvas.entityMenu.convertTo', 'canvas.entityMenu.copyToClipboard', 'canvas.entityMenu.saveToGallery', 'canvas.entityMenu.exportToFile', 'common.delete'] as const) {
      expect(menu.queryByText(t(key))).toBeNull();
    }
    await openSub(menu, t('canvas.entityMenu.arrange'));
    fireEvent.click(itemNamed(t('canvas.entityMenu.moveToBottom')));
    expect(state().entities.map((e) => e.id)).toEqual([slot, below]);
  });

  it.each([    ['raster', 'control'],
    ['control', 'raster'],
    ['inpaint', 'regional'],
    ['regional', 'inpaint'],
  ] as [EntityType, EntityType][])('converts a %s layer to %s', async (from, to) => {
    const id = state().addEntity(from);
    const menu = await openEntityMenu(id);
    await openSub(menu, t('canvas.entityMenu.convertTo'));
    expect(screen.queryByRole('menuitem', { name: t(ADD_LABEL[from]) })).toBeNull();
    fireEvent.click(itemNamed(t(ADD_LABEL[to])));
    expect(state().entities.some((e) => e.type === to)).toBe(true);
  });
});

describe('layers panel', () => {
  const show = () =>
    render(
      <TooltipProvider>
        <LayersPanel />
      </TooltipProvider>,
    );

  it('starts empty with quick buttons that add a layer of each type', () => {
    show();
    expect(screen.getByText(t('canvas.layers.empty'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t(ADD_LABEL.inpaint) }));
    expect(state().entities.map((e) => e.type)).toEqual(['inpaint']);
    expect(screen.queryByText(t('canvas.layers.empty'))).toBeNull();
  });

  it('adds a layer of the chosen type from the Add menu', async () => {
    show();
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t(ADD_LABEL.control) }));
    expect(state().entities.map((e) => e.type)).toEqual(['control']);
  });

  it('disables the add items with the reason when the host says a limit is reached, and adds below it', async () => {
    const host = { addable: ['raster' as const], addBlocked: (entities: unknown[]) => (entities.length >= 2 ? 'Too many layers' : null) };
    state().addEntity('raster');
    const { rerender } = render(
      <TooltipProvider>
        <LayersPanel host={host} />
      </TooltipProvider>,
    );
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    expect(screen.queryByText('Too many layers')).toBeNull();
    fireEvent.click(await screen.findByRole('menuitem', { name: t(ADD_LABEL.raster) }));
    expect(state().entities).toHaveLength(2);
    rerender(
      <TooltipProvider>
        <LayersPanel host={host} />
      </TooltipProvider>,
    );
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    expect(await screen.findByText('Too many layers')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: t(ADD_LABEL.raster) }).getAttribute('aria-disabled')).toBe('true');
  });

  it('adds a global reference image and selects it', async () => {
    show();
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('canvas.add.globalRef') }));
    const refs = useParams.getState().refImages;
    expect(refs).toHaveLength(1);
    expect(state().selectedEntityId).toBe(refs[0]!.id);
  });

  it('opens the pose dialog from the Add menu', async () => {
    const open = vi.spyOn(usePoseDialog.getState(), 'open');
    usePoseDialog.setState({ open });
    show();
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('pose.menu') }));
    expect(open).toHaveBeenCalled();
  });

  it('merges the visible layers and deletes all layers from the more menu', async () => {
    act(() => {
      state().addEntity('raster');
    });
    show();
    fireEvent.keyDown(screen.getByRole('button', { name: t('canvas.layers.more') }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('canvas.actions.mergeVisible') }));
    expect(mergeVisible).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('button', { name: t('canvas.layers.more') }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('canvas.layers.deleteAll') }));
    await waitFor(() => expect(state().entities).toHaveLength(0));
  });

  it('disables deleting all when there is nothing to delete', async () => {
    show();
    fireEvent.keyDown(screen.getByRole('button', { name: t('canvas.layers.more') }), { key: 'Enter' });
    const item = await screen.findByRole('menuitem', { name: t('canvas.layers.deleteAll') });
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the groups instead of the empty state once a reference image exists', () => {
    useParams.getState().addRefImage();
    show();
    expect(screen.queryByText(t('canvas.layers.empty'))).toBeNull();
  });
});

describe('layers panel in another host', () => {
  const host = { addable: ['raster'] as EntityType[], hideGlobalRefs: true, slotLabels: { panels: 'Panels here' } };
  const show = () =>
    render(
      <TooltipProvider>
        <LayersPanel host={host} />
      </TooltipProvider>,
    );

  it('offers only the kinds the host allows, without global references or poses', async () => {
    show();
    const quick = within(document.querySelector('.canvas-layers__quick') as HTMLElement).getAllByRole('button');
    expect(quick.map((b) => b.textContent)).toEqual([t(ADD_LABEL.raster)]);
    fireEvent.keyDown(screen.getByTestId('canvas-add-layer'), { key: 'Enter' });
    await screen.findByRole('menuitem', { name: t(ADD_LABEL.raster) });
    for (const name of [t(ADD_LABEL.control), t(ADD_LABEL.inpaint), t(ADD_LABEL.regional), t('canvas.add.globalRef'), t('pose.menu')]) {
      expect(screen.queryByRole('menuitem', { name })).toBeNull();
    }
    fireEvent.click(screen.getByRole('menuitem', { name: t(ADD_LABEL.raster) }));
    expect(state().entities.map((e) => e.type)).toEqual(['raster']);
  });

  it('keeps a group of a kind it cannot add without its add button', () => {
    act(() => {
      state().addEntity('control');
      state().addEntity('raster');
    });
    show();
    expect(within(screen.getByTestId('canvas-group-control')).queryByRole('button', { name: t(ADD_LABEL.control) })).toBeNull();
    expect(within(screen.getByTestId('canvas-group-raster')).getByRole('button', { name: t(ADD_LABEL.raster) })).toBeTruthy();
  });

  it('hides the global reference images, so they alone do not fill the panel', () => {
    useParams.getState().addRefImage();
    show();
    expect(screen.getByText(t('canvas.layers.empty'))).toBeTruthy();
    expect(screen.queryByTestId('canvas-group-ref')).toBeNull();
  });

  it('labels a slot row as the host says and cannot delete all while only slots are there', async () => {
    act(() => {
      state().addEntity('raster', { slot: 'panels' });
    });
    show();
    expect(screen.getByText('Panels here')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: t('canvas.layers.more') }), { key: 'Enter' });
    const item = await screen.findByRole('menuitem', { name: t('canvas.layers.deleteAll') });
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });
});