// @vitest-environment jsdom
// The quick bar over the selected layer: which controls it has for a text layer (solid or gradient fill, with or without an
// outline) and for a bubble, that they change the layer, and duplicate and delete.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer, type BubbleLayer, type Layer, type TextLayer } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { TextFloatingBar } from './TextFloatingBar';

const state = () => useTextEditor.getState();
const SHEET = { width: 600, height: 400 };

function show(layer: Layer) {
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [layer] }, selectedId: layer.id, past: [], future: [] });
  return render(
    <TooltipProvider>
      <TextFloatingBar layer={layer} half={{ hw: 100, hh: 40 }} scale={0.5} sheet={SHEET} />
    </TooltipProvider>,
  );
}
const colorInput = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'color') as HTMLInputElement;
const baseText = (): TextLayer => newTextLayer({ width: 1024, height: 1024 }, 'Hi');
const baseBubble = (): BubbleLayer => newBubbleLayer({ width: 1024, height: 1024 }, 'round', 'Hi');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TextFloatingBar for a text layer', () => {
  it('sets the size and the fill color', { tags: ['scenario'] }, () => {
    const layer = baseText();
    show(layer);
    const size = screen.getByLabelText(t('text.size')) as HTMLInputElement;
    fireEvent.change(size, { target: { value: '200' } });
    fireEvent.blur(size);
    fireEvent.change(colorInput(t('text.color')), { target: { value: '#ff0000' } });
    const now = state().scene.layers[0] as TextLayer;
    expect(now.style.fontSize).toBe(200);
    expect(now.style.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('offers both colors of a gradient fill, and changes each on its own', { tags: ['scenario'] }, () => {
    const layer = baseText();
    layer.style = { ...layer.style, fill: { kind: 'gradient', top: '#111111', bottom: '#222222' } };
    show(layer);
    expect(screen.queryByLabelText(t('text.color'))).toBeNull();
    fireEvent.change(colorInput(t('text.fill.top')), { target: { value: '#aa0000' } });
    fireEvent.change(colorInput(t('text.fill.bottom')), { target: { value: '#00aa00' } });
    expect((state().scene.layers[0] as TextLayer).style.fill).toEqual({ kind: 'gradient', top: '#aa0000', bottom: '#00aa00' });
  });

  it('shows the outline color only while the text has an outline', { tags: ['condition'] }, () => {
    const layer = baseText();
    layer.style = { ...layer.style, stroke: null };
    const { unmount } = show(layer);
    expect(screen.queryByLabelText(t('text.stroke'))).toBeNull();
    unmount();
    const outlined = baseText();
    outlined.style = { ...outlined.style, stroke: { color: '#101010', width: 6 } };
    show(outlined);
    fireEvent.change(colorInput(t('text.stroke')), { target: { value: '#ffffff' } });
    expect((state().scene.layers[0] as TextLayer).style.stroke).toEqual({ color: '#ffffff', width: 6 });
  });

  it('joins a run of edits of one control into one undo step', { tags: ['state-transition'] }, () => {
    const layer = baseText();
    show(layer);
    for (const c of ['#ff0000', '#00ff00', '#0000ff']) fireEvent.change(colorInput(t('text.color')), { target: { value: c } });
    expect(state().past).toHaveLength(1);
  });
});

describe('TextFloatingBar for a bubble', () => {
  it('has the fill and the border color and no font or size', { tags: ['condition'] }, () => {
    show(baseBubble());
    expect(screen.queryByLabelText(t('text.size'))).toBeNull();
    expect(screen.queryByTestId('text-bar-font')).toBeNull();
    fireEvent.change(colorInput(t('text.bubble.fill')), { target: { value: '#eeeeee' } });
    fireEvent.change(colorInput(t('text.bubble.border')), { target: { value: '#101010' } });
    expect(state().scene.layers[0]).toMatchObject({ fill: '#eeeeee', border: { color: '#101010' } });
  });
});

describe('TextFloatingBar actions', () => {
  it('duplicates and deletes the layer', { tags: ['scenario'] }, () => {
    show(baseText());
    fireEvent.click(screen.getByLabelText(t('text.layer.duplicate')));
    expect(state().scene.layers).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(t('text.layer.delete')));
    expect(state().scene.layers).toHaveLength(1);
  });

  it('is a toolbar with a name', { tags: ['scenario'] }, () => {
    show(baseText());
    // Hidden until its size is measured, so the name is read from the attributes.
    const bar = screen.getByTestId('text-bar');
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe(t('text.bar'));
  });
});
