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
});
