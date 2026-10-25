// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { UpscalerChoice } from './UpscalerChoice';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const starter = (id: string, type: 'spandrel_image_to_image' | 'main') => ({ id, name: id, base: 'any' as const, type, description: `${id} description`, source: `src-${id}` });

describe('upscaler choice', () => {
  it('lists only the upscaling models, with the recommended one first', async () => {
    vi.spyOn(backend, 'listStarterModels').mockResolvedValue([starter('starter-realesrgan-x4', 'spandrel_image_to_image'), starter('starter-sdxl-base', 'main'), starter('starter-4x-ultrasharp', 'spandrel_image_to_image')]);
    render(
      <TooltipProvider>
        <UpscalerChoice />
      </TooltipProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('upscaler-choice')).toBeTruthy());
    const rows = screen.getByTestId('upscaler-choice').querySelectorAll('.mc__row');
    expect([...rows].map((r) => r.getAttribute('data-testid'))).toEqual(['upscaler-choice-starter-4x-ultrasharp', 'upscaler-choice-starter-realesrgan-x4']);
    expect(rows[0]!.textContent).toContain(t('media.choice.recommended'));
    expect(rows[1]!.textContent).not.toContain(t('media.choice.recommended'));
    expect(screen.queryByTestId('choice-gpu')).toBeNull();
  });

  it('shows nothing when there is no upscaling model to offer', async () => {
    vi.spyOn(backend, 'listStarterModels').mockResolvedValue([starter('starter-sdxl-base', 'main')]);
    render(<UpscalerChoice />);
    await waitFor(() => expect(backend.listStarterModels).toHaveBeenCalled());
    expect(screen.queryByTestId('upscaler-choice')).toBeNull();
  });
});
