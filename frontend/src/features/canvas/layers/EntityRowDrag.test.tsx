// @vitest-environment jsdom
// Dragging a layer row (reorder inside its group, drag to another target) and the group shell around the rows.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { DEFERRED_MIME } from '@/state/dnd';
import { TooltipProvider } from '@/ui';
import { ADD_LABEL, GROUP_TITLE } from '../names';
import { EntityGroup } from './EntityGroup';
import { LayersHostContext } from './layersHost';

const initial = useCanvas.getState();
const state = () => useCanvas.getState();
let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  canvases = installRecordingCanvases();
  useCanvas.setState(initial, true);
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
});

const show = (type: 'raster' | 'control' | 'inpaint', host = {}) =>
  render(
    <TooltipProvider>
      <LayersHostContext.Provider value={host}>
        <EntityGroup type={type} />
      </LayersHostContext.Provider>
    </TooltipProvider>,
  );
const rows = () => screen.getAllByTestId('canvas-entity').map((r) => r.querySelector('.canvas-entity__row') as HTMLElement);
const dt = () => {
  const data: Record<string, string> = {};
  return { data, effectAllowed: 'none', setData: (k: string, v: string) => (data[k] = v), getData: (k: string) => data[k] ?? '' };
};

describe('EntityRow dragging', () => {
  it('moves a layer onto another of the same type and marks the drop target while over it', () => {
    const a = state().addEntity('inpaint');
    const b = state().addEntity('inpaint');
    const c = state().addEntity('inpaint');
    show('inpaint');
    // Rows are listed top-most first: c, b, a.
    const [rc, , ra] = rows();
    fireEvent.dragStart(ra!, { dataTransfer: dt() });
    fireEvent.dragOver(rc!, { dataTransfer: dt() });
    expect(rc!.closest('.canvas-entity')!.classList.contains('is-drop-target')).toBe(true);
    fireEvent.dragLeave(rc!);
    expect(rc!.closest('.canvas-entity')!.classList.contains('is-drop-target')).toBe(false);
    fireEvent.dragOver(rc!, { dataTransfer: dt() });
    fireEvent.drop(rc!, { dataTransfer: dt() });
    const order = state().entities.map((e) => e.id);
    expect(order.indexOf(a)).toBeGreaterThan(order.indexOf(c));
    expect(order.sort()).toEqual([a, b, c].sort());
    expect(rc!.closest('.canvas-entity')!.classList.contains('is-drop-target')).toBe(false);
  });

  it('does not take a drop on itself, and a drop after the drag ended', () => {
    state().addEntity('inpaint');
    state().addEntity('inpaint');
    show('inpaint');
    const before = state().entities.map((e) => e.id);
    const [top, bottom] = rows();
    fireEvent.dragStart(top!, { dataTransfer: dt() });
    fireEvent.dragOver(top!, { dataTransfer: dt() });
    expect(top!.closest('.canvas-entity')!.classList.contains('is-drop-target')).toBe(false);
    fireEvent.drop(top!, { dataTransfer: dt() });
    fireEvent.dragEnd(top!);
    fireEvent.drop(bottom!, { dataTransfer: dt() });
    expect(state().entities.map((e) => e.id)).toEqual(before);
  });

  it('offers a raster layer to other targets as a deferred drag, and a mask only as a move', () => {
    state().addEntity('raster');
    const { unmount } = show('raster');
    const raster = dt();
    fireEvent.dragStart(rows()[0]!, { dataTransfer: raster });
    expect(JSON.parse(raster.data[DEFERRED_MIME]!)).toMatchObject({ kind: 'canvas-layer', id: state().entities[0]!.id });
    unmount();

    state().addEntity('inpaint');
    show('inpaint');
    const mask = dt();
    fireEvent.dragStart(rows()[0]!, { dataTransfer: mask });
    expect(mask.data[DEFERRED_MIME]).toBeUndefined();
    expect(mask.effectAllowed).toBe('move');
  });

  it('does not offer a slot row to other targets', () => {
    state().addEntity('raster', { slot: 'panels' });
    show('raster');
    const slot = dt();
    fireEvent.dragStart(rows()[0]!, { dataTransfer: slot });
    expect(slot.data[DEFERRED_MIME]).toBeUndefined();
    expect(slot.effectAllowed).toBe('move');
  });

  it('keeps layers of different types apart', () => {
    state().addEntity('control');
    show('control');
    const control = rows()[0]!;
    fireEvent.dragStart(control, { dataTransfer: dt() });
    cleanup();
    state().addEntity('inpaint');
    show('inpaint');
    const target = rows()[0]!;
    fireEvent.dragOver(target, { dataTransfer: dt() });
    expect(target.closest('.canvas-entity')!.classList.contains('is-drop-target')).toBe(false);
  });
});

describe('EntityGroup', () => {
  it('renders nothing for a type without layers', () => {
    const { container } = show('control');
    expect(container.firstChild).toBeNull();
  });

  it('collapses and expands, showing the count', () => {
    state().addEntity('inpaint');
    state().addEntity('inpaint');
    show('inpaint');
    const group = screen.getByTestId('canvas-group-inpaint');
    expect(within(group).getByText(t(GROUP_TITLE.inpaint))).toBeTruthy();
    expect(within(group).getByText('2')).toBeTruthy();
    const toggle = group.querySelector('.canvas-group__toggle') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByTestId('canvas-entity')).toHaveLength(0);
    fireEvent.click(toggle);
    expect(screen.getAllByTestId('canvas-entity')).toHaveLength(2);
  });

  it('hides and shows the whole group on the canvas', () => {
    state().addEntity('inpaint');
    show('inpaint');
    fireEvent.click(screen.getByRole('button', { name: t('canvas.groups.hide') }));
    expect(state().groupHidden.inpaint).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t('canvas.groups.show') }));
    expect(state().groupHidden.inpaint).toBe(false);
  });

  it('adds a layer of its type, unless the host does not allow the type', () => {
    state().addEntity('inpaint');
    const { unmount } = show('inpaint');
    fireEvent.click(screen.getByRole('button', { name: t(ADD_LABEL.inpaint) }));
    expect(state().entities.filter((e) => e.type === 'inpaint')).toHaveLength(2);
    unmount();
    show('inpaint', { addable: ['raster'] });
    expect(screen.queryByRole('button', { name: t(ADD_LABEL.inpaint) })).toBeNull();
  });
});
