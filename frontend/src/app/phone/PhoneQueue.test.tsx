// @vitest-environment jsdom
// The phone layout's Queue tab: the jobs newest first, the processor's state and controls, cancel and retry, opening a
// job's picture, and the count on the tab.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { PhoneShell } from './PhoneShell';
import { usePhone } from './phoneStore';

const initial = { gallery: useGallery.getState(), queue: useQueue.getState(), toasts: useToasts.getState() };
const job = (id: number, status: QueueItem['status'], over: Partial<QueueItem> = {}): QueueItem =>
  ({
    id,
    batchId: 'b',
    status,
    origin: 'generate',
    destination: 'gallery',
    params: { positivePrompt: `prompt ${id}`, modelName: 'Model X', width: 512, height: 768, seed: id },
    boardId: null,
    createdAt: id,
    startedAt: null,
    completedAt: null,
    imageName: null,
    error: null,
    ...over,
  }) as QueueItem;
const picture = (name: string): ImageDTO => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 512, height: 768, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null });
const status = (patch: Partial<ReturnType<typeof useQueue.getState>['status']>) => ({ ...initial.queue.status, ...patch });

const mount = () => {
  render(
    <TooltipProvider>
      <PhoneShell />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByTestId('phone-nav-queue'));
};
const cards = () => screen.getAllByTestId('phone-queue-item');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ ...initial.gallery, images: [picture('done.png')] }, true);
  useQueue.setState(initial.queue, true);
  useToasts.setState(initial.toasts, true);
  usePhone.setState({ tab: 'generate', view: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('phone Queue tab', () => {
  it('says the queue is empty', () => {
    mount();
    expect(screen.getByText(t('queue.empty.title'))).toBeTruthy();
  });

  it('lists the jobs newest first with their state, prompt, model and size', () => {
    useQueue.setState({ items: [job(1, 'completed', { imageName: 'done.png' }), job(3, 'pending'), job(2, 'in_progress')] });
    mount();
    expect(cards().map((c) => c.getAttribute('data-status'))).toEqual(['pending', 'in_progress', 'completed']);
    const first = cards()[2]!;
    expect(first.textContent).toContain(t('queue.status.completed'));
    expect(first.textContent).toContain('prompt 1');
    expect(first.textContent).toContain('Model X · 512×768');
    expect(first.querySelector('img')?.getAttribute('src')).toBe('blob:t-done.png');
  });

  it('cancels a waiting or running job and retries a failed or cancelled one', async () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    const retry = vi.spyOn(backend, 'retryQueueItem').mockResolvedValue(job(9, 'pending'));
    useQueue.setState({ items: [job(1, 'failed', { error: 'out of luck' }), job(2, 'pending'), job(3, 'canceled'), job(4, 'completed')] });
    mount();
    const [completed, canceled, pending, failed] = cards();
    fireEvent.click(within(pending!).getByTestId('phone-queue-cancel'));
    expect(cancel).toHaveBeenCalledWith(2);
    fireEvent.click(within(failed!).getByTestId('phone-queue-retry'));
    expect(retry).toHaveBeenCalledWith(1);
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('queue.toast.retried', { id: 1 })));
    expect(within(canceled!).getByTestId('phone-queue-retry')).toBeTruthy();
    expect(within(completed!).queryByTestId('phone-queue-cancel')).toBeNull();
    expect(within(completed!).queryByTestId('phone-queue-retry')).toBeNull();
    expect(failed!.textContent).toContain('out of luck');
  });

  it('opens the picture of a finished job and a job being drawn full screen, not one without a picture', () => {
    useQueue.setState({ items: [job(1, 'completed', { imageName: 'done.png' }), job(2, 'in_progress'), job(3, 'pending')] });
    mount();
    const [pending, running, done] = cards();
    expect((within(pending!).getAllByRole('button')[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(running!).getAllByRole('button')[0]!);
    expect(usePhone.getState().view).toEqual({ kind: 'live', itemId: 2 });
    fireEvent.click(within(done!).getAllByRole('button')[0]!);
    expect(usePhone.getState().view).toEqual({ kind: 'image', name: 'done.png' });
  });

  it('pauses and resumes the processor, and tidies the finished jobs', () => {
    const pause = vi.spyOn(backend, 'pauseProcessor').mockResolvedValue();
    const resume = vi.spyOn(backend, 'resumeProcessor').mockResolvedValue();
    const prune = vi.spyOn(backend, 'pruneQueue').mockResolvedValue();
    useQueue.setState({ items: [job(1, 'pending')], status: status({ pending: 1, total: 1 }) });
    mount();
    expect(screen.getByTestId('phone-queue-state').textContent).toBe(t('queue.processor.running'));
    expect((screen.getByTestId('phone-queue-prune') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('phone-queue-pause'));
    expect(pause).toHaveBeenCalled();
    cleanup();
    useQueue.setState({ items: [job(1, 'completed')], status: status({ completed: 1, total: 1, isPaused: true }) });
    mount();
    expect(screen.getByTestId('phone-queue-state').textContent).toBe(t('queue.processor.paused'));
    fireEvent.click(screen.getByTestId('phone-queue-resume'));
    expect(resume).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('phone-queue-prune'));
    expect(prune).toHaveBeenCalled();
  });

  it('counts the waiting and running jobs on its tab', () => {
    useQueue.setState({ items: [], status: status({ pending: 2, inProgress: 1 }) });
    mount();
    expect(screen.getByTestId('phone-queue-badge').textContent).toBe('3');
    cleanup();
    useQueue.setState({ status: status({}) });
    mount();
    expect(screen.queryByTestId('phone-queue-badge')).toBeNull();
  });
});
