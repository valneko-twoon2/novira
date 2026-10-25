// @vitest-environment jsdom
// Compare mode shares one zoom / pan between both images, in every layout.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { CompareView } from './CompareView';

function image(name: string, width: number, height: number): ImageDTO {
  return {
    name,
    url: `blob:${name}`,
    thumbnailUrl: `blob:${name}-thumb`,
    width,
    height,
    createdAt: 0,
    boardId: null,
    starred: false,
    isIntermediate: false,
    category: 'general',
    metadata: null,
    workflow: null,
  };
}

const A = image('a.png', 1000, 1000);
const B = image('b.png', 1000, 1000);

function show() {
  render(
    <TooltipProvider>
      <CompareView first={A} second={B} />
    </TooltipProvider>,
  );
}

const frames = () => Array.from(document.querySelectorAll<HTMLElement>('.vzoom__frame'));
const percent = () => screen.getByTestId('viewer-zoom').textContent;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(432);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(332);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 432, 332));
  // jsdom has no pointer capture.
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useGallery.getState().setCompareMode('slider');
});

describe('CompareView zoom', () => {
  it('zooms and pans both side-by-side images together', () => {
    useGallery.getState().setCompareMode('side-by-side');
    show();
    const halves = screen.getAllByTestId('compare-half');
    expect(percent()).toBe('30%');
    fireEvent.wheel(halves[1] as HTMLElement, { deltaY: -600, clientX: 200, clientY: 150 });
    expect(percent()).not.toBe('30%');
    const [a, b] = frames();
    expect(a?.style.transform).toBe(b?.style.transform);
    expect(a?.style.width).toBe(b?.style.width);

    const before = a?.style.transform;
    fireEvent.pointerDown(halves[0] as HTMLElement, { pointerId: 1, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(halves[0] as HTMLElement, { pointerId: 1, clientX: 180, clientY: 140 });
    fireEvent.pointerUp(halves[0] as HTMLElement, { pointerId: 1 });
    const [a2, b2] = frames();
    expect(a2?.style.transform).not.toBe(before);
    expect(a2?.style.transform).toBe(b2?.style.transform);
  });

  it('keeps the slider drag for the divider and zooms both layers with the wheel', () => {
    useGallery.getState().setCompareMode('slider');
    show();
    const slider = screen.getByTestId('compare-slider');
    fireEvent.wheel(slider, { deltaY: -600, clientX: 200, clientY: 150 });
    const [a, b] = frames();
    expect(a?.style.transform).toBe(b?.style.transform);
    const zoomed = a?.style.transform;

    const divider = () => slider.querySelector<HTMLElement>('.vslider__divider')?.style.left;
    expect(divider()).toBe('50%');
    fireEvent.pointerDown(slider, { pointerId: 1, button: 0, clientX: 216, clientY: 150 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 108, clientY: 150 });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    // A left drag moves the divider but never pans.
    expect(divider()).toBe('25%');
    expect(frames()[0]?.style.transform).toBe(zoomed);
    expect(frames()[1]?.style.clipPath).toMatch(/^inset\(0 0 0 [\d.]+%\)$/);
  });

  it('starts fitted again after switching the layout', () => {
    useGallery.getState().setCompareMode('hover');
    show();
    fireEvent.wheel(screen.getByTestId('compare-hover'), { deltaY: -600, clientX: 200, clientY: 150 });
    expect(percent()).not.toBe('30%');
    fireEvent.click(screen.getByRole('radio', { name: t('gallery.compare.sideBySide') }));
    expect(screen.getAllByTestId('compare-half')).toHaveLength(2);
    expect(percent()).toBe('30%');
  });
});
