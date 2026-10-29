// @vitest-environment jsdom
// One row of the queue: its fields, the cancel and retry buttons by status, the toggle, the memory notice, and the detail.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { QueueRow } from './QueueRow';

const make = (over: Partial<QueueItem> = {}): QueueItem =>
  ({
    id: 7,
    batchId: 'batch-0123456789ab',
    status: 'completed',
    origin: 'canvas',
    destination: 'gallery',
    params: { positivePrompt: 'a cat', seed: 42, modelName: 'Model X', width: 512, height: 768 },
    createdAt: 1_700_000_000_000,
    startedAt: 1_700_000_001_000,
    completedAt: 1_700_000_004_500,
    imageName: null,
    error: null,
    ...over,
  }) as QueueItem;

function show(item: QueueItem, expanded = false) {
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <QueueRow item={item} expanded={expanded} onToggle={onToggle} />
    </TooltipProvider>,
  );
  return onToggle;
}
const byLabel = (text: string) => screen.queryByLabelText(text);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a queue row', () => {
  it('shows the item, its prompt, model, size and how long it took, and toggles on a click', () => {
    const onToggle = show(make());
    expect(screen.getByText('a cat')).toBeTruthy();
    expect(screen.getByText('Model X')).toBeTruthy();
    expect(screen.getByText('512×768')).toBeTruthy();
    expect(screen.getByText(t('queue.duration', { seconds: '3.5' }))).toBeTruthy();
    fireEvent.click(screen.getByText('a cat'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('says there is no prompt and shows no duration for an unfinished item', () => {
    show(make({ status: 'pending', params: { positivePrompt: '', seed: 1, modelName: 'M', width: 8, height: 8 } as never, completedAt: null }));
    expect(screen.getByText(t('queue.noPrompt'))).toBeTruthy();
    expect(document.querySelector('.qt-faint')).toBeNull();
  });

  it('cancels a running item without toggling the row', () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue(undefined as never);
    const onToggle = show(make({ status: 'in_progress' }));
    expect(byLabel(t('queue.action.retry'))).toBeNull();
    fireEvent.click(screen.getByLabelText(t('common.cancel')));
    expect(cancel).toHaveBeenCalledWith(7);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('retries a failed item and says so', async () => {
    useToasts.setState({ toasts: [] });
    const retry = vi.spyOn(backend, 'retryQueueItem').mockResolvedValue({ id: 8 } as never);
    show(make({ status: 'failed' }));
    expect(byLabel(t('common.cancel'))).toBeNull();
    fireEvent.click(screen.getByLabelText(t('queue.action.retry')));
    expect(retry).toHaveBeenCalledWith(7);
    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1));
  });

  it('says nothing when there was nothing to retry', async () => {
    useToasts.setState({ toasts: [] });
    const retry = vi.spyOn(backend, 'retryQueueItem').mockResolvedValue(null as never);
    show(make({ status: 'canceled' }));
    fireEvent.click(screen.getByLabelText(t('queue.action.retry')));
    await waitFor(() => expect(retry).toHaveBeenCalled());
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('offers a way out for a job that ran out of memory', () => {
    show(make({ status: 'failed', errorKind: 'out_of_memory', error: 'CUDA out of memory' }));
    expect(document.querySelector('.qt-oom')).not.toBeNull();
  });

  it('opens the detail with the error, the batch cancel for active items, the picture and the parameters', () => {
    useGallery.setState({ images: [{ name: 'out.png', thumbnailUrl: '/t/out.png' } as ImageDTO] });
    show(make({ status: 'pending', error: 'boom', imageName: 'out.png', startedAt: null, completedAt: null }), true);
    expect(screen.getByText('boom')).toBeTruthy();
    expect(document.querySelector('.qt-detail__image img')?.getAttribute('src')).toBe('/t/out.png');
    expect(document.querySelector('.qt-detail__json pre')?.textContent).toContain('"seed": 42');
    const cancelBatch = vi.spyOn(backend, 'cancelBatch').mockResolvedValue(undefined as never);
    fireEvent.click(screen.getByText(t('queue.action.cancelBatch')));
    expect(cancelBatch).toHaveBeenCalledWith('batch-0123456789ab');
  });

  it('shows no picture for a name the gallery lacks, and no batch cancel for a finished item', () => {
    useGallery.setState({ images: [] });
    show(make({ imageName: 'gone.png' }), true);
    expect(document.querySelector('.qt-detail__image img')).toBeNull();
    expect(screen.queryByText(t('queue.action.cancelBatch'))).toBeNull();
  });
});
