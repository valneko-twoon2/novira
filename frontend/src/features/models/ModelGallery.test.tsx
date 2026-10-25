// @vitest-environment jsdom
// The model detail's pictures and original page: paging through the pictures, the link to the page.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { ModelDetail } from './ModelDetail';

const model: ModelConfig = {
  key: 'm1',
  name: 'Sunny XL',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: 'models/sunny.safetensors',
  size: 1,
  source: 'civitai:1/2-3',
  coverImageUrl: 'https://image.civitai.com/a.jpeg',
  coverImageUrls: ['https://image.civitai.com/a.jpeg', 'https://image.civitai.com/b.jpeg', 'https://image.civitai.com/c.jpeg'],
  pageUrl: 'https://civitai.com/models/1?modelVersionId=2',
};
const show = (m: ModelConfig = model) =>
  render(
    <TooltipProvider>
      <ModelDetail model={m} />
    </TooltipProvider>,
  );
const src = () => document.querySelector('.mm-gallery img')?.getAttribute('src');

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the model pictures', () => {
  it('pages forward and back around the ends, with a counter', () => {
    show();
    expect(src()).toBe('https://image.civitai.com/a.jpeg');
    expect(screen.getByTestId('mm-gallery-count').textContent).toBe(t('models.detail.imageCount', { index: 1, count: 3 }));
    fireEvent.click(screen.getByTestId('mm-gallery-next'));
    expect(src()).toBe('https://image.civitai.com/b.jpeg');
    fireEvent.click(screen.getByTestId('mm-gallery-prev'));
    fireEvent.click(screen.getByTestId('mm-gallery-prev'));
    expect(src()).toBe('https://image.civitai.com/c.jpeg');
    fireEvent.click(screen.getByTestId('mm-gallery-next'));
    expect(src()).toBe('https://image.civitai.com/a.jpeg');
  });

  it('shows no arrows for a model with one picture', () => {
    show({ ...model, coverImageUrls: undefined });
    expect(src()).toBe('https://image.civitai.com/a.jpeg');
    expect(screen.queryByTestId('mm-gallery-next')).toBeNull();
    expect(screen.queryByTestId('mm-gallery-count')).toBeNull();
  });

  it('starts at the first picture again for another model', () => {
    const { rerender } = show();
    fireEvent.click(screen.getByTestId('mm-gallery-next'));
    rerender(
      <TooltipProvider>
        <ModelDetail model={{ ...model, key: 'm2' }} />
      </TooltipProvider>,
    );
    expect(src()).toBe('https://image.civitai.com/a.jpeg');
  });
});

describe('the original page', () => {
  it('lists the address and opens it through the backend', () => {
    const open = vi.spyOn(backend, 'openSourcePage').mockResolvedValue(undefined);
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as never);
    show();
    const link = screen.getByTestId('mm-page-link');
    expect(link.textContent).toBe(model.pageUrl);
    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith(model.pageUrl);
  });

  it('falls back to a page built from the source, and shows no link for a local file', () => {
    show({ ...model, pageUrl: undefined, source: 'https://huggingface.co/a/b' });
    expect(screen.getByTestId('mm-page-link').textContent).toBe('https://huggingface.co/a/b');
    cleanup();
    show({ ...model, pageUrl: undefined, source: 'civitai:827184/1-2' });
    expect(screen.getByTestId('mm-page-link').textContent).toBe('https://civitai.com/models/827184');
    cleanup();
    show({ ...model, pageUrl: undefined, source: 'owner/repo::a/b.safetensors' });
    expect(screen.getByTestId('mm-page-link').textContent).toBe('https://huggingface.co/owner/repo');
    cleanup();
    show({ ...model, pageUrl: undefined, source: 'C:/models/x.safetensors' });
    expect(screen.queryByTestId('mm-page-link')).toBeNull();
  });
});
