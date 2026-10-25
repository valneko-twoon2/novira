// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { QueueItem } from '@/backend';
import { useOutOfMemoryNotices } from '@/state/outOfMemory';
import { useQueue } from '@/state/queue';
import { TooltipProvider } from '@/ui';
import { GeneratingStrip } from './GeneratingStrip';

afterEach(() => {
  cleanup();
  useQueue.setState({ items: [], progress: null });
  useOutOfMemoryNotices.setState({ ids: [] });
});

const item = (id: number, over: Partial<QueueItem> & { draftAt?: number } = {}): QueueItem => {
  const { draftAt, ...rest } = over;
  return {
    id,
    batchId: 'b',
    status: 'in_progress',
    origin: 'generate',
    destination: 'gallery',
    params: { width: 1024, height: 1024, ...(draftAt === undefined ? {} : { draftAt }) },
    boardId: null,
    initImageUrl: null,
    workflow: null,
    createdAt: 0,
    startedAt: 0,
    completedAt: null,
    imageName: null,
    error: null,
    ...rest,
  } as QueueItem;
};

describe('generating strip', () => {
  it('shows a running gallery job with its step', () => {
    useQueue.setState({ items: [item(1)], progress: { itemId: 1, step: 3, totalSteps: 30, progressImageUrl: null, message: '' } });
    render(<GeneratingStrip />);
    expect(screen.getAllByTestId('gallery-generating-item')).toHaveLength(1);
    expect(screen.getByText(/3\/30/)).toBeTruthy();
  });

  it('shows nothing for drafts, canvas jobs and jobs that are not running', () => {
    useQueue.setState({ items: [item(1, { draftAt: 5 }), item(2, { destination: 'canvas' }), item(3, { status: 'pending' })], progress: null });
    render(<GeneratingStrip />);
    expect(screen.queryByTestId('gallery-generating')).toBeNull();
  });

  it('keeps a picture that ran out of memory with its notice until it is closed', () => {
    const failed = (id: number, over: Partial<QueueItem> = {}) => item(id, { status: 'failed', errorKind: 'out_of_memory', ...over });
    useQueue.setState({
      items: [failed(1), failed(2, { destination: 'intermediate' }), failed(3, { params: { generationMode: 'video', width: 512, height: 512 } as QueueItem['params'] }), failed(4)],
      progress: null,
    });
    // Item 4 failed before the app was opened: it was never reported, so it stays in the queue tab only.
    for (const id of [1, 2, 3]) useOutOfMemoryNotices.getState().report(id);
    render(
      <TooltipProvider>
        <GeneratingStrip />
      </TooltipProvider>,
    );
    expect(screen.getAllByTestId('oom-notice')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /close|閉じる/i }));
    expect(useOutOfMemoryNotices.getState().ids).toEqual([2, 3]);
    expect(screen.queryByTestId('gallery-generating')).toBeNull();
  });
});
