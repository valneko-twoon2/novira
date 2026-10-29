// @vitest-environment jsdom
// The handles of the selected picture over the page: corners resize, the top handle turns, and a movable picture is dragged
// by its body, unless a balloon lies under the hand or the press carries the panel of a free page.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { DEFAULT_IMAGE_VIEW, type ComicImageView } from '@/state/comic/document';
import { PictureGhost, PictureHandles } from './PictureHandles';

const box = { x: 0, y: 0, width: 1, height: 1 };
const view: ComicImageView = { ...DEFAULT_IMAGE_VIEW };

/** A page 1000 x 1000 px at the window's origin, holding the handles. */
function show(props: Partial<React.ComponentProps<typeof PictureHandles>> = {}) {
  const onView = vi.fn();
  render(
    <div className="comic-page" data-testid="page">
      <PictureHandles url="novira://a.png" view={view} box={box} aspect={1} onView={onView} {...props} />
    </div>,
  );
  const page = screen.getByTestId('page');
  page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0 }) as DOMRect;
  const outline = screen.getByTestId('comic-picture-handles');
  // The picture fills the page, so its centre is at (500, 500).
  outline.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0 }) as DOMRect;
  return { onView, outline };
}

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});
beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLocale('ja');
});

describe('the faint ghost of a picture', () => {
  it('is an unreadable, undraggable image of the whole picture, mirrored as the picture is', () => {
    const { container } = render(<PictureGhost url="novira://a.png" view={{ ...view, flipX: true, rotation: 30 }} box={box} aspect={1} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('novira://a.png');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.style.transform).toContain('rotate(30deg)');
    expect(img.style.transform).toContain('scale(-1, 1)');
  });
});

describe('the corner and turning handles', () => {
  it('has four corners and a turning handle', () => {
    show();
    expect(screen.getAllByTestId('comic-picture-corner')).toHaveLength(4);
    expect(screen.getByTestId('comic-picture-rotate')).toBeTruthy();
  });

  it('resizes about the centre as a corner is dragged outward, and stops when it is let go', () => {
    const { onView } = show();
    const corner = screen.getAllByTestId('comic-picture-corner')[1]!;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 600, clientY: 500, button: 0 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 700, clientY: 500 });
    expect(onView).toHaveBeenCalledOnce();
    expect(onView.mock.calls[0]![0].scale).toBeCloseTo(2);
    fireEvent.pointerUp(corner, { pointerId: 1 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 800, clientY: 500 });
    expect(onView).toHaveBeenCalledOnce();
  });

  it('ignores moves of another pointer, and presses of another button', () => {
    const { onView } = show();
    const corner = screen.getAllByTestId('comic-picture-corner')[0]!;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 600, clientY: 500, button: 2 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 700, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 600, clientY: 500, button: 0 });
    fireEvent.pointerMove(corner, { pointerId: 2, clientX: 700, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerCancel(corner, { pointerId: 1 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 700, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
  });

  it('turns about the centre, in steps with Shift', () => {
    const { onView } = show();
    const handle = screen.getByTestId('comic-picture-rotate');
    // From straight right of the centre to straight below it: a quarter turn.
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600, clientY: 500, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500, clientY: 600 });
    expect(onView.mock.calls[0]![0].rotation).toBeCloseTo(90);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500, clientY: 600 + 1, shiftKey: true });
    expect(onView.mock.calls[1]![0].rotation % 15).toBeCloseTo(0);
  });

  it('keeps a click on a handle from reaching what lies under it', () => {
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <PictureHandles url="novira://a.png" view={view} box={box} aspect={1} onView={() => {}} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('comic-picture-rotate'));
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('dragging the picture itself', () => {
  it('is not movable unless asked to', () => {
    const { onView, outline } = show();
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 500, button: 0 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
    expect(outline.className).not.toContain('is-movable');
  });

  it('follows the pointer by how far the page is on screen, and stops on release', () => {
    const { onView, outline } = show({ movable: true });
    expect(outline.className).toContain('is-movable');
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 500, button: 0 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 450 });
    expect(onView.mock.calls[0]![0].cx).toBeCloseTo(0.6);
    expect(onView.mock.calls[0]![0].cy).toBeCloseTo(0.45);
    fireEvent.pointerUp(outline, { pointerId: 1 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 700, clientY: 450 });
    expect(onView).toHaveBeenCalledOnce();
  });

  it('ignores another pointer and another button', () => {
    const { onView, outline } = show({ movable: true });
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 500, button: 2 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 500, button: 0 });
    fireEvent.pointerMove(outline, { pointerId: 9, clientX: 600, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerCancel(outline, { pointerId: 1 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 500 });
    expect(onView).not.toHaveBeenCalled();
  });

  it('hands a press to the balloon that lies under the hand instead of moving the picture', () => {
    const { onView, outline } = show({ movable: true });
    const balloon = document.createElement('div');
    balloon.className = 'comic-bubble';
    const got = vi.fn();
    balloon.addEventListener('pointerdown', got);
    document.body.appendChild(balloon);
    (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [document.body, balloon];
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 500, clientY: 500, button: 0 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 600, clientY: 500 });
    expect(got).toHaveBeenCalledOnce();
    expect(onView).not.toHaveBeenCalled();
    delete (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    balloon.remove();
  });
});

describe('a picture of a panel of a free page', () => {
  const shape = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 0, y: 0.5 },
  ];
  const handlers = () => ({ onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() });

  it('carries the panel when the press is inside its shape, and moves the picture outside it or with Alt', () => {
    const h = handlers();
    const { onView, outline } = show({ movable: true, carry: { shape, handlers: h } });
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    expect(h.onPointerDown).toHaveBeenCalledOnce();
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 150, clientY: 100 });
    expect(h.onPointerMove).toHaveBeenCalledOnce();
    expect(onView).not.toHaveBeenCalled();
    fireEvent.pointerUp(outline, { pointerId: 1 });
    expect(h.onPointerUp).toHaveBeenCalledOnce();
    // Outside the shape the picture itself moves.
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 800, clientY: 800, button: 0 });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 900, clientY: 800 });
    expect(h.onPointerDown).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledOnce();
    fireEvent.pointerUp(outline, { pointerId: 1 });
    // With Alt, inside the shape too.
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 100, clientY: 100, button: 0, altKey: true });
    fireEvent.pointerMove(outline, { pointerId: 1, clientX: 150, clientY: 100 });
    expect(h.onPointerDown).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledTimes(2);
  });

  it('tells the panel when a carrying press is cancelled', () => {
    const h = handlers();
    const { outline } = show({ movable: true, carry: { shape, handlers: h } });
    fireEvent.pointerDown(outline, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerCancel(outline, { pointerId: 1 });
    expect(h.onPointerCancel).toHaveBeenCalledOnce();
    // Nothing is carried any more.
    fireEvent.pointerCancel(outline, { pointerId: 1 });
    expect(h.onPointerCancel).toHaveBeenCalledOnce();
  });
});
