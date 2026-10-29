// @vitest-environment jsdom
// A still image in the viewer: zoom controls, pixelated rendering when magnified, reset when the image changes.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { ZoomableImage } from './ZoomableImage';

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

const view = (img: ImageDTO) => (
  <TooltipProvider>
    <ZoomableImage image={img} />
  </TooltipProvider>
);
const percent = () => screen.getByTestId('viewer-zoom').textContent;

beforeEach(() => {
  // A 432×332 stage: fitting a 1000×1000 image (16 px padding) gives exactly 30%.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(432);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(332);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ZoomableImage', () => {
  it('shows the fitted image and its zoom percentage', () => {
    render(view(image('a.png', 1000, 1000)));
    expect(percent()).toBe('30%');
    const frame = screen.getByTestId('viewer-image').parentElement as HTMLElement;
    expect(frame.style.width).toBe('300px');
    expect(frame.style.transform).toBe('translate(66px, 16px)');
  });

  it('zooms with the controls and draws pixels sharp from 200%', () => {
    render(view(image('a.png', 1000, 1000)));
    fireEvent.click(screen.getByRole('button', { name: `1:1 ${t('common.zoomActualSize')}` }));
    expect(percent()).toBe('100%');
    expect(screen.getByTestId('viewer-image').className).not.toContain('is-pixelated');
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    expect(percent()).toBe('125%');
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    expect(percent()).toBe('200%');
    expect(screen.getByTestId('viewer-image').className).toContain('is-pixelated');
    expect(screen.getByTestId('viewer-zoom-surface').className).toContain('is-grab');
    fireEvent.click(screen.getByRole('button', { name: `${t('gallery.viewer.zoomFit')} (Ctrl+0)` }));
    expect(percent()).toBe('30%');
  });

  it('returns to fit when another image is shown', () => {
    const { rerender } = render(view(image('a.png', 1000, 1000)));
    fireEvent.click(screen.getByRole('button', { name: `1:1 ${t('common.zoomActualSize')}` }));
    expect(percent()).toBe('100%');
    rerender(view(image('b.png', 2000, 1000)));
    expect(percent()).toBe('20%');
    expect(screen.getByTestId('viewer-image').getAttribute('src')).toBe('blob:b.png');
  });
});
