// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { MOCK_PICTURES } from '@/backend/mock/mockPictures';
import { t } from '@/i18n';
import { CoverImage } from './CoverImage';

const model = (patch: Partial<ModelConfig> = {}) => ({ key: 'm1', name: 'Model One', ...patch }) as ModelConfig;
const cover = (container: HTMLElement) => container.querySelector('img');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CoverImage', () => {
  it('shows the model picture when it has one', () => {
    const { container } = render(<CoverImage model={model({ coverImageUrl: 'blob:real' })} />);
    expect(cover(container)!.getAttribute('src')).toBe('blob:real');
  });

  it('stands a mock picture in for a model without one, the same for the same key', () => {
    const first = render(<CoverImage model={model({ key: 'drawn-1' })} />);
    const src = cover(first.container)!.getAttribute('src')!;
    expect(MOCK_PICTURES).toContain(src);
    cleanup();
    const again = render(<CoverImage model={model({ key: 'drawn-1' })} />);
    expect(cover(again.container)!.getAttribute('src')).toBe(src);
  });

  it('keeps the placeholder icon when there is no model', () => {
    const none = render(<CoverImage model={undefined} />);
    expect(cover(none.container)).toBeNull();
    expect(none.container.querySelector('svg')).not.toBeNull();
  });

  it('opens an enlarged view on click when zoomable, and not otherwise', async () => {
    const plain = render(<CoverImage model={model({ coverImageUrl: 'blob:real' })} />);
    fireEvent.click(plain.container.querySelector('.pp-cover')!);
    expect(screen.queryByAltText('Model One')).toBeNull();
    cleanup();
    const { container } = render(<CoverImage model={model({ key: 'zoom-1' })} zoomable className="thumb" />);
    const thumb = container.querySelector('.thumb')!;
    expect(thumb.getAttribute('title')).toBe(t('params.model.zoomHint'));
    fireEvent.click(thumb);
    expect((await screen.findByAltText('Model One')).getAttribute('src')).toBe(cover(container)!.getAttribute('src'));
  });

  it('goes through all the pictures of the enlarged view, around both ends, and starts from the first each time', async () => {
    const urls = ['blob:a', 'blob:b', 'blob:c'];
    const { container } = render(<CoverImage model={model({ coverImageUrl: 'blob:a', coverImageUrls: urls })} zoomable className="thumb" />);
    fireEvent.click(container.querySelector('.thumb')!);
    const shown = () => screen.getByAltText('Model One').getAttribute('src');
    expect(shown()).toBe('blob:a');
    expect(screen.getByTestId('cover-zoom-count').textContent).toBe(t('models.detail.imageCount', { index: 1, count: 3 }));
    fireEvent.click(screen.getByTestId('cover-zoom-next'));
    expect(shown()).toBe('blob:b');
    fireEvent.click(screen.getByTestId('cover-zoom-prev'));
    fireEvent.click(screen.getByTestId('cover-zoom-prev'));
    expect(shown()).toBe('blob:c');
    fireEvent.keyDown(screen.getByTestId('cover-zoom'), { key: 'ArrowRight' });
    expect(shown()).toBe('blob:a');
    // Closed and opened again, it starts from the first.
    fireEvent.click(screen.getByTestId('cover-zoom-next'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(container.querySelector('.thumb')!);
    expect(shown()).toBe('blob:a');
  });

  it('shows no arrows for a model with one picture', async () => {
    const { container } = render(<CoverImage model={model({ coverImageUrl: 'blob:a', coverImageUrls: ['blob:a'] })} zoomable className="thumb" />);
    fireEvent.click(container.querySelector('.thumb')!);
    expect(screen.queryByTestId('cover-zoom-next')).toBeNull();
    expect(screen.queryByTestId('cover-zoom-count')).toBeNull();
  });
});
