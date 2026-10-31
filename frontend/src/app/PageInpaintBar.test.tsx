// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { PageInpaintBar } from './PageInpaintBar';

const queuePageInpaint = vi.hoisted(() => vi.fn());
vi.mock('./pageInpaint', () => ({ queuePageInpaint }));
vi.mock('@/features/canvas/overlays/StagingToolbar', () => ({ StagingToolbar: ({ inline }: { inline?: boolean }) => <div data-testid="staging" data-inline={String(inline)} /> }));

const run = () => screen.getByTestId('comic-inpaint-run') as HTMLButtonElement;

beforeEach(() => queuePageInpaint.mockReset());
afterEach(() => cleanup());

const mount = (pageId = 'p1') =>
  render(
    <TooltipProvider>
      <PageInpaintBar pageId={pageId} />
    </TooltipProvider>,
  );

describe('PageInpaintBar', () => {
  it('queues the inpaint of its page, and is disabled until that settles', async () => {
    let finish!: (v: boolean) => void;
    queuePageInpaint.mockReturnValue(new Promise<boolean>((r) => (finish = r)));
    mount('page-7');
    expect(run().getAttribute('aria-label')).toBe(t('comic.inpaint.run'));
    fireEvent.click(run());
    expect(queuePageInpaint).toHaveBeenCalledWith('page-7');
    expect(run().disabled).toBe(true);
    await act(async () => finish(true));
    expect(run().disabled).toBe(false);
  });

  it('is usable again when the queue found nothing to do', async () => {
    queuePageInpaint.mockResolvedValue(false);
    mount();
    await act(async () => {
      fireEvent.click(run());
    });
    expect(queuePageInpaint).toHaveBeenCalledTimes(1);
    expect(run().disabled).toBe(false);
  });

  it('puts the staging bar inline next to the button', () => {
    queuePageInpaint.mockResolvedValue(true);
    mount();
    expect(screen.getByTestId('staging').getAttribute('data-inline')).toBe('true');
  });
});
