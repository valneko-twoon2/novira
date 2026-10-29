// @vitest-environment jsdom
// The jobs shown above a media kind's results: waiting and running jobs with progress and cancel, and recent failures.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { TooltipProvider } from '@/ui';
import { MediaJobs } from './MediaJobs';

const initial = useQueue.getState();
const job = (id: number, status: string, mode = 'music', extra: object = {}) => ({ id, status, params: { generationMode: mode }, error: null, ...extra }) as unknown as QueueItem;
const show = (kind: 'music' | 'voice' = 'music') =>
  render(
    <TooltipProvider>
      <MediaJobs kind={kind} />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useQueue.setState(initial, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MediaJobs', () => {
  it('shows only the jobs of its own kind, running first as running and pending as waiting', () => {
    useQueue.setState({ items: [job(1, 'in_progress'), job(2, 'pending'), job(3, 'in_progress', 'voice'), job(4, 'completed')] });
    show('music');
    expect(screen.getAllByTestId('music-job')).toHaveLength(2);
    expect(screen.queryByTestId('voice-job')).toBeNull();
    expect(screen.getByText(t('media.job.running.music'))).toBeTruthy();
    expect(screen.getByText(t('media.job.waiting'))).toBeTruthy();
  });

  it('draws the progress of the running job only, and a waiting job as indeterminate', () => {
    useQueue.setState({
      items: [job(1, 'in_progress'), job(2, 'pending')],
      progress: { itemId: 1, step: 5, totalSteps: 20, progressImageUrl: null, message: '' },
    });
    show();
    const [running, waiting] = screen.getAllByTestId('music-job');
    const bar = (el: Element) => el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar(running!).getAttribute('aria-valuenow')).toBe('25');
    expect(bar(waiting!).getAttribute('aria-valuenow')).toBeNull();
  });

  it('shows no progress for a running job another item reports on', () => {
    useQueue.setState({
      items: [job(1, 'in_progress')],
      progress: { itemId: 99, step: 5, totalSteps: 20, progressImageUrl: null, message: '' },
    });
    show();
    const bar = screen.getByTestId('music-job').querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('cancels a job by its id', () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue(undefined as never);
    useQueue.setState({ items: [job(7, 'pending')] });
    show();
    fireEvent.click(screen.getByRole('button', { name: t('media.job.cancel') }));
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('lists the last three failures with their error, and the memory notice for an out of memory one', () => {
    useQueue.setState({
      items: [
        job(1, 'failed', 'music', { error: 'e1' }),
        job(2, 'failed', 'music', { error: 'e2' }),
        job(3, 'failed', 'music', { error: 'e3' }),
        job(4, 'failed', 'music', { error: 'e4', errorKind: 'out_of_memory' }),
        job(5, 'failed', 'voice', { error: 'other kind' }),
      ],
    });
    show();
    expect(screen.queryByText('e1')).toBeNull();
    expect(screen.getByText('e2')).toBeTruthy();
    expect(screen.getByText('e3')).toBeTruthy();
    expect(screen.queryByText('other kind')).toBeNull();
    expect(screen.getAllByText(t('media.job.failed.music'))).toHaveLength(2);
    expect(screen.getByTestId('oom-notice')).toBeTruthy();
  });
});
