// @vitest-environment jsdom
// The compare toolbar: the mode switch, swapping the two pictures and leaving compare mode.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { CompareToolbar } from './CompareToolbar';

const initial = useGallery.getState();
const img = (name: string) => ({ name }) as ImageDTO;
const show = () =>
  render(
    <TooltipProvider>
      <CompareToolbar first={img('a.png')} second={img('b.png')} />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ ...initial, viewerImageName: 'a.png', compareImageName: 'b.png', compareMode: 'slider' }, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CompareToolbar', () => {
  it('marks the mode in use and switches between the three modes', () => {
    show();
    const radio = (key: Parameters<typeof t>[0]) => screen.getByRole('radio', { name: t(key) });
    expect(radio('gallery.compare.slider').getAttribute('aria-checked')).toBe('true');
    expect(radio('gallery.compare.sideBySide').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(radio('gallery.compare.sideBySide'));
    expect(useGallery.getState().compareMode).toBe('side-by-side');
    expect(radio('gallery.compare.sideBySide').getAttribute('aria-checked')).toBe('true');
    expect(radio('gallery.compare.slider').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(radio('gallery.compare.hover'));
    expect(useGallery.getState().compareMode).toBe('hover');
  });

  it('swaps the two pictures', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: t('gallery.compare.swap') }));
    expect(useGallery.getState().viewerImageName).toBe('b.png');
    expect(useGallery.getState().compareImageName).toBe('a.png');
  });

  it('leaves compare mode and keeps the viewer picture', () => {
    show();
    fireEvent.click(screen.getByTestId('compare-exit'));
    expect(useGallery.getState().compareImageName).toBeNull();
    expect(useGallery.getState().viewerImageName).toBe('a.png');
  });
});
