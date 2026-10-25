// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { MOCK_PICTURES } from '@/backend/mock/mockPictures';
import { CoverImage } from './CoverImage';

// The desktop app has no stand-in pictures; `standIn.on = false` turns the browser mock's off for a test.
const standIn = vi.hoisted(() => ({ on: true }));
vi.mock('@/backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/backend')>();
  return { ...real, standInCover: (key: string | number) => (standIn.on ? real.standInCover(key) : undefined) };
});

const model = (patch: Partial<ModelConfig> = {}) => ({ key: 'm1', name: 'Model One', type: 'main', ...patch }) as ModelConfig;

afterEach(() => {
  cleanup();
  standIn.on = true;
});

describe('model cover', () => {
  it('shows the model picture when it has one', () => {
    const { container } = render(<CoverImage model={model({ coverImageUrl: 'blob:real' })} />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('blob:real');
  });

  it('shows the picture of a diffusion model (an Anima file kept on its own) and the icon of an encoder', () => {
    const { container } = render(<CoverImage model={model({ type: 'diffusion_model', coverImageUrl: 'blob:anima' })} />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('blob:anima');
    cleanup();
    const encoder = render(<CoverImage model={model({ type: 'text_encoder', coverImageUrl: 'blob:enc' })} />);
    expect(encoder.container.querySelector('img')).toBeNull();
  });

  it('stands a mock picture in for a model without one in the browser mock', () => {
    const { container } = render(<CoverImage model={model({ key: 'drawn-1' })} />);
    expect(MOCK_PICTURES).toContain(container.querySelector('img')!.getAttribute('src'));
  });

  it('shows the icon, not a picture, for a model without one where there is no stand-in (the desktop app)', () => {
    standIn.on = false;
    const { container } = render(<CoverImage model={model()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
