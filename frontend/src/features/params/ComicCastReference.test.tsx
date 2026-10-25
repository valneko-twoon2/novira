// @vitest-environment jsdom
// The character references of a comic in its drawing settings: off unless turned on, then at a light strength.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { CAST_REFERENCE_DEFAULT, newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { ComicDrawExtras } from './ComicParams';

beforeEach(() => {
  // The settings around it measure themselves.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useComic.getState().setProjects([newProject('Refs')]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const comic = () => useComic.getState().projects[0]!;
const mount = () =>
  render(
    <TooltipProvider>
      <ComicDrawExtras />
    </TooltipProvider>,
  );

describe('the character references of the drawing settings', () => {
  it('starts off, turns on at the light strength with a slider, and off again', () => {
    mount();
    const section = screen.getByTestId('comic-cast-reference');
    const box = within(screen.getByTestId('comic-cast-reference-use')).getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(within(section).queryByLabelText(t('comic.draw.castReference.weight'))).toBeNull();
    fireEvent.click(box);
    expect(comic().castReference).toBe(CAST_REFERENCE_DEFAULT);
    expect(within(section).getAllByLabelText(t('comic.draw.castReference.weight')).length).toBeGreaterThan(0);
    fireEvent.click(box);
    expect(comic()).not.toHaveProperty('castReference');
  });
});
