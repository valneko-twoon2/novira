// @vitest-environment jsdom
// The queue's processor and bulk buttons: pause and resume, cancelling, pruning and clearing after confirmation.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { useQueue } from '@/state/queue';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { QueueControls } from './QueueControls';

const initial = { queue: useQueue.getState(), toasts: useToasts.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);
const status = (over: object = {}) => ({ isPaused: false, total: 3, pending: 1, completed: 1, failed: 1, canceled: 0, inProgress: 1, ...over }) as never;
const item = (id: number, state: string) => ({ id, status: state }) as never;
const button = (label: string) => screen.getByText(label).closest('button') as HTMLButtonElement;

beforeEach(() => {
  useQueue.setState({ ...initial.queue, status: status(), items: [item(1, 'in_progress'), item(2, 'pending'), item(3, 'pending'), item(4, 'completed')] }, true);
  useToasts.setState(initial.toasts, true);
  render(
    <TooltipProvider>
      <QueueControls />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QueueControls', () => {
  it('pauses the processor, and resumes it when paused', async () => {
    const pause = vi.spyOn(backend, 'pauseProcessor').mockResolvedValue(undefined as never);
    const resume = vi.spyOn(backend, 'resumeProcessor').mockResolvedValue(undefined as never);
    expect(screen.getByText(t('queue.processor.running'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('queue-pause'));
    expect(pause).toHaveBeenCalled();
    useQueue.setState({ status: status({ isPaused: true }) });
    expect(await screen.findByText(t('queue.processor.paused'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('queue-resume'));
    expect(resume).toHaveBeenCalled();
  });

  it('cancels the running item, and every pending item', async () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue(undefined as never);
    fireEvent.click(button(t('queue.action.cancelCurrent')));
    expect(cancel).toHaveBeenCalledWith(1);
    fireEvent.click(button(t('queue.action.cancelAllExceptCurrent')));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(3));
    expect(cancel.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    await waitFor(() => expect(lastToast()?.title).toBe(tCount('queue.toast.canceledPending', 2)));
  });

  it('prunes the finished items and says how many', async () => {
    const prune = vi.spyOn(backend, 'pruneQueue').mockResolvedValue(undefined as never);
    fireEvent.click(screen.getByTestId('queue-prune'));
    await waitFor(() => expect(prune).toHaveBeenCalled());
    await waitFor(() => expect(lastToast()?.title).toBe(tCount('queue.toast.pruned', 2)));
  });

  it('clears the queue only after confirmation', async () => {
    const clear = vi.spyOn(backend, 'clearQueue').mockResolvedValue(undefined as never);
    fireEvent.click(button(t('queue.action.clear')));
    fireEvent.click(screen.getByText(t('common.cancel')));
    expect(clear).not.toHaveBeenCalled();
    fireEvent.click(button(t('queue.action.clear')));
    fireEvent.click(await screen.findByTestId('queue-clear-confirm'));
    await waitFor(() => expect(clear).toHaveBeenCalled());
    await waitFor(() => expect(lastToast()?.title).toBe(t('queue.toast.cleared')));
  });

  it('turns off what has nothing to act on', () => {
    cleanup();
    useQueue.setState({ status: status({ total: 0, completed: 0, failed: 0 }), items: [] });
    render(
      <TooltipProvider>
        <QueueControls />
      </TooltipProvider>,
    );
    for (const label of ['queue.action.cancelCurrent', 'queue.action.cancelAllExceptCurrent', 'queue.action.prune', 'queue.action.clear'] as const) {
      expect(button(t(label)).disabled).toBe(true);
    }
  });
});
