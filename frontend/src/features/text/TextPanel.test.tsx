// @vitest-environment jsdom
// The Text tab's side panel: adding layers, the background, the layer list and the property controls of text and bubbles.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, type BubbleLayer, type TextLayer } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { TextPanel } from './TextPanel';

const initial = { editor: useTextEditor.getState(), gallery: useGallery.getState() };
const state = () => useTextEditor.getState();
const layers = () => state().scene.layers;
const text = () => layers()[0] as TextLayer;
const bubble = () => layers()[0] as BubbleLayer;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useTextEditor.setState({ ...initial.editor, scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] }, true);
  useGallery.setState({ ...initial.gallery, images: [], viewerImageName: null }, true);
  render(
    <TooltipProvider>
      <TextPanel />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The number box of a labelled control (a slider with a number box shares the label). */
const num = (label: string) => screen.getAllByLabelText(label).find((e) => e.tagName === 'INPUT' && (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  const input = num(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
};
const color = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'color') as HTMLInputElement;
const click = (label: string) => fireEvent.click(screen.getByText(label));
const check = (label: string) => fireEvent.click(screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'checkbox')!);

describe('adding layers', () => {
  it('adds text and each kind of bubble, selecting the new layer and showing its properties', () => {
    fireEvent.click(screen.getByTestId('text-add-text'));
    expect(layers()).toHaveLength(1);
    expect(state().selectedId).toBe(layers()[0]!.id);
    expect(screen.getByTestId('text-props')).toBeTruthy();
    expect(screen.queryByTestId('bubble-controls')).toBeNull();
    for (const shape of ['round', 'box', 'cloud', 'burst', 'whisper', 'narration']) fireEvent.click(screen.getByTestId(`text-add-${shape}`));
    expect(layers().map((l) => l.type)).toEqual(['text', 'bubble', 'bubble', 'bubble', 'bubble', 'bubble', 'bubble']);
    expect(screen.getByTestId('bubble-controls')).toBeTruthy();
  });
});

describe('background', () => {
  it('switches between a colour, transparent and a picture from the viewer', () => {
    click(t('text.bg.color'));
    expect(state().scene.background).toEqual({ kind: 'color', color: '#ffffff' });
    fireEvent.change(color(t('text.color')), { target: { value: '#336699' } });
    expect(state().scene.background).toEqual({ kind: 'color', color: '#336699' });
    click(t('text.bg.transparent'));
    expect(state().scene.background).toEqual({ kind: 'color', color: null });
    // No picture in the viewer: the image button is off and nothing is offered.
    expect((screen.getByText(t('text.bg.image')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('text-use-viewer')).toBeNull();

  });

  it('uses the picture open in the viewer as the background and sizes the canvas to it', () => {
    act(() => useGallery.setState({ images: [{ name: 'v.png', url: 'u', width: 800, height: 600 } as never], viewerImageName: 'v.png' }));
    fireEvent.click(screen.getByTestId('text-use-viewer'));
    expect(state().scene).toMatchObject({ width: 800, height: 600, background: { kind: 'image', imageName: 'v.png' } });
    expect(screen.getByText(t('text.bg.imageNote', { name: 'v.png' }))).toBeTruthy();
    expect(screen.queryByTestId('text-use-viewer')).toBeNull();
    click(t('text.bg.color'));
    click(t('text.bg.image'));
    expect(state().scene.background.kind).toBe('image');
  });

  it('resizes the canvas from the number boxes', () => {
    setNum(t('text.bg.width'), 640);
    setNum(t('text.bg.height'), 480);
    expect(state().scene).toMatchObject({ width: 640, height: 480 });
  });
});

describe('the layer list', () => {
  it('selects, hides, locks, reorders, duplicates and deletes layers, and clears them all', () => {
    expect(screen.getByText(t('text.layers.empty'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('text-add-text'));
    fireEvent.click(screen.getByTestId('text-add-round'));
    const [first, second] = layers();
    fireEvent.click(screen.getByTestId(`text-layer-${first!.id}`));
    expect(state().selectedId).toBe(first!.id);

    const row = () => screen.getByTestId(`text-layer-${first!.id}`).closest('li')!;
    fireEvent.click(within(row()).getByLabelText(t('text.layer.hide')));
    expect(layers()[0]!.visible).toBe(false);
    fireEvent.click(within(row()).getByLabelText(t('text.layer.show')));
    fireEvent.click(within(row()).getByLabelText(t('text.layer.lock')));
    expect(layers()[0]!.locked).toBe(true);
    fireEvent.click(within(row()).getByLabelText(t('text.layer.unlock')));
    fireEvent.click(within(row()).getByLabelText(t('text.layer.up')));
    expect(layers().map((l) => l.id)).toEqual([second!.id, first!.id]);
    fireEvent.click(within(row()).getByLabelText(t('text.layer.down')));
    expect(layers().map((l) => l.id)).toEqual([first!.id, second!.id]);
    fireEvent.click(within(row()).getByLabelText(t('text.layer.duplicate')));
    expect(layers()).toHaveLength(3);
    fireEvent.click(within(row()).getByLabelText(t('text.layer.delete')));
    expect(layers()).toHaveLength(2);
    fireEvent.click(screen.getByText(t('text.layers.clear')));
    expect(layers()).toHaveLength(0);
  });
});

describe('text properties', () => {
  beforeEach(() => fireEvent.click(screen.getByTestId('text-add-text')));

  it('edits the wording, position, rotation and opacity', () => {
    fireEvent.change(screen.getByTestId('text-content'), { target: { value: 'New\nlines' } });
    expect(text().text).toBe('New\nlines');
    setNum(t('text.position.x'), 100);
    setNum(t('text.position.y'), 200);
    setNum(t('text.rotation'), 15);
    setNum(t('text.opacity'), 50);
    expect(text()).toMatchObject({ x: 100, y: 200, rotation: 15, opacity: 0.5 });
  });

  it('edits the size, spacing, line height and bend', () => {
    setNum(t('text.size'), 80);
    setNum(t('text.letterSpacing'), 4);
    setNum(t('text.lineHeight'), 1.5);
    setNum(t('text.bend'), 40);
    expect(text().style).toMatchObject({ fontSize: 80, letterSpacing: 4, lineHeight: 1.5 });
    expect(text().bend).toBe(40);
  });

  it('switches between a solid and a gradient fill and edits the colours', () => {
    fireEvent.change(color(t('text.color')), { target: { value: '#ff0000' } });
    expect(text().style.fill).toEqual({ kind: 'solid', color: '#ff0000' });
    fireEvent.click(within(screen.getByRole('group', { name: t('text.fill') })).getByText(t('text.fill.gradient')));
    expect(text().style.fill).toMatchObject({ kind: 'gradient', top: '#ff0000' });
    fireEvent.change(color(t('text.fill.top')), { target: { value: '#00ff00' } });
    fireEvent.change(color(t('text.fill.bottom')), { target: { value: '#0000ff' } });
    expect(text().style.fill).toEqual({ kind: 'gradient', top: '#00ff00', bottom: '#0000ff' });
    fireEvent.click(within(screen.getByRole('group', { name: t('text.fill') })).getByText(t('text.fill.solid')));
    expect(text().style.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });

  it('turns the inner outline, the outer outline and the shadow on, edits and off again', () => {
    // The new text starts with an inner outline.
    expect(text().style.stroke).not.toBeNull();
    check(t('text.stroke'));
    expect(text().style.stroke).toBeNull();
    check(t('text.stroke'));
    fireEvent.change(color(t('text.stroke')), { target: { value: '#123456' } });
    setNum(t('text.stroke'), 9);
    expect(text().style.stroke).toEqual({ color: '#123456', width: 9 });

    check(t('text.outline'));
    expect(text().style.outline).toMatchObject({ color: '#ffffff' });
    fireEvent.change(color(t('text.outline')), { target: { value: '#abcdef' } });
    expect(text().style.outline!.color).toBe('#abcdef');
    check(t('text.outline'));
    expect(text().style.outline).toBeNull();

    check(t('text.shadow'));
    expect(text().style.shadow).not.toBeNull();
    setNum(t('text.shadow.blur'), 12);
    setNum(t('text.shadow.offsetX'), 3);
    setNum(t('text.shadow.offsetY'), -4);
    expect(text().style.shadow).toMatchObject({ blur: 12, offsetX: 3, offsetY: -4 });
    fireEvent.change(color(t('text.shadow.color')), { target: { value: '#222222' } });
    expect(text().style.shadow!.color).toMatch(/#222222|rgba\(34, 34, 34/);
    check(t('text.shadow'));
    expect(text().style.shadow).toBeNull();
  });

  it('sets the alignment and the writing direction', () => {
    const align = () => screen.getByRole('group', { name: t('text.align') });
    fireEvent.click(within(align()).getByText(t('text.align.left')));
    expect(text().style.align).toBe('left');
    fireEvent.click(within(align()).getByText(t('text.align.right')));
    expect(text().style.align).toBe('right');
    check(t('text.vertical'));
    expect(text().style.vertical).toBe(true);
    expect(within(align()).getByText(t('text.align.top'))).toBeTruthy();
    expect(within(align()).getByText(t('text.align.bottom'))).toBeTruthy();
  });
});

describe('bubble properties', () => {
  beforeEach(() => fireEvent.click(screen.getByTestId('text-add-burst')));

  it('edits the size, colours and border', () => {
    // The background size boxes may share these labels, so look inside the bubble controls.
    const box = within(screen.getByTestId('bubble-controls'));
    for (const [label, value] of [[t('text.bubble.width'), 300], [t('text.bubble.height'), 260]] as const) {
      const input = box.getByLabelText(label) as HTMLInputElement;
      fireEvent.change(input, { target: { value: String(value) } });
      fireEvent.blur(input);
    }
    fireEvent.change(color(t('text.bubble.fill')), { target: { value: '#eeeeee' } });
    fireEvent.change(color(t('text.bubble.border')), { target: { value: '#101010' } });
    setNum(t('text.thickness'), 6);
    expect(bubble()).toMatchObject({ width: 300, height: 260, fill: '#eeeeee', border: { color: '#101010', width: 6 } });
  });

  it('edits the pointer, shuffles a burst and toggles auto-fit', () => {
    expect(bubble().tail.enabled).toBe(true);
    setNum(t('text.bubble.tail.curve'), 50);
    setNum(t('text.bubble.tail.width'), 120);
    expect(bubble().tail).toMatchObject({ curve: 0.5, width: 120 });
    const seed = bubble().seed;
    vi.spyOn(Math, 'random').mockReturnValue(0.123);
    click(t('text.bubble.shuffle'));
    expect(bubble().seed).toBe(12300);
    expect(bubble().seed).not.toBe(seed);
    check(t('text.bubble.tail'));
    expect(bubble().tail.enabled).toBe(false);
    expect(screen.queryByText(t('text.bubble.tail.hint'))).toBeNull();
    check(t('text.bubble.autoFit'));
    expect(bubble().autoFit).toBe(false);
    vi.restoreAllMocks();
  });

  it('hides the pointer controls for a narration box', () => {
    fireEvent.click(screen.getByTestId('text-add-narration'));
    expect(screen.queryByLabelText(t('text.bubble.tail'))).toBeNull();
    expect(screen.queryByText(t('text.bubble.shuffle'))).toBeNull();
  });
});
