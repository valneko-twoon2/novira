// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import * as derive from '@/state/derive';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useGallery } from '@/state/gallery';
import { TooltipProvider } from '@/ui';
import { DeriveDialog } from './DeriveDialog';

const picture: ImageDTO = {
  name: 'p.png',
  mediaType: 'image',
  url: 'blob:p',
  thumbnailUrl: 'blob:p',
  width: 200,
  height: 100,
  createdAt: 0,
  boardId: 'b1',
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
};

const mount = () =>
  render(
    <TooltipProvider>
      <DeriveDialog />
    </TooltipProvider>,
  );

describe('redo with a chosen strength', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([picture]);
    useDeriveDialog.setState({ imageName: null });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('stays closed until a picture is chosen, then redoes it at the strength on the slider', () => {
    const run = vi.spyOn(derive, 'deriveFrom').mockResolvedValue();
    mount();
    expect(screen.queryByTestId('derive-dialog')).toBeNull();
    useDeriveDialog.getState().open('p.png');
    // (open() is a store change outside act, so the dialog is found asynchronously)
    return screen.findByTestId('derive-dialog').then(() => {
      const input = screen.getAllByRole('spinbutton')[0]!;
      expect((input as HTMLInputElement).value).toBe(derive.SUBTLE_STRENGTH.toFixed(2));
      fireEvent.change(input, { target: { value: '0.8' } });
      fireEvent.blur(input);
      fireEvent.click(screen.getByTestId('derive-create'));
      expect(run).toHaveBeenCalledWith(picture, 'subtle', 1, 0.8);
      expect(useDeriveDialog.getState().imageName).toBeNull();
    });
  });

  it('shows nothing for a picture that is gone', () => {
    mount();
    useDeriveDialog.setState({ imageName: 'missing.png' });
    expect(screen.queryByTestId('derive-dialog')).toBeNull();
  });
});
