// @vitest-environment jsdom
// The queue list: items in id order, the empty state, and rows that expand one by one.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { TooltipProvider } from '@/ui';
import { QueueList } from './QueueList';

const initial = useQueue.getState();
const item = (id: number): QueueItem =>
  ({
    id,
    batchId: `batch-${id}-0123456789`,
    status: 'completed',
    origin: 'canvas',
    destination: 'gallery',
    params: { positivePrompt: `prompt ${id}`, seed: id, modelName: 'M', width: 64, height: 64 },
    createdAt: 1_700_000_000_000,
    startedAt: 1_700_000_001_000,
    completedAt: 1_700_000_002_000,
    imageName: null,
    error: null,
  }) as QueueItem;
const show = () =>
  render(
    <TooltipProvider>
      <QueueList />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useQueue.setState(initial, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QueueList', () => {
  it('shows the empty state and the header while the queue is empty', () => {
    show();
    expect(screen.getByText(t('queue.empty.title'))).toBeTruthy();
    expect(screen.getByText(t('queue.col.status'))).toBeTruthy();
    expect(screen.queryAllByTestId('queue-item')).toHaveLength(0);
  });

  it('lists the items by ascending id whatever order they arrive in', () => {
    useQueue.setState({ items: [item(3), item(1), item(2)] });
    show();
    expect(screen.queryByText(t('queue.empty.title'))).toBeNull();
    expect(screen.getAllByTestId('queue-item').map((r) => r.textContent?.match(/prompt (\d)/)?.[1])).toEqual(['1', '2', '3']);
  });

  it('expands and collapses each row on its own', () => {
    useQueue.setState({ items: [item(1), item(2)] });
    show();
    const rows = () => screen.getAllByTestId('queue-item');
    fireEvent.click(screen.getByText('prompt 1'));
    expect(rows()[0]!.classList.contains('is-expanded')).toBe(true);
    expect(rows()[1]!.classList.contains('is-expanded')).toBe(false);
    fireEvent.click(screen.getByText('prompt 2'));
    expect(rows()[1]!.classList.contains('is-expanded')).toBe(true);
    fireEvent.click(screen.getAllByText('prompt 1')[0]!);
    expect(rows()[0]!.classList.contains('is-expanded')).toBe(false);
    expect(rows()[1]!.classList.contains('is-expanded')).toBe(true);
  });

  it('follows the store when an item is added', () => {
    useQueue.setState({ items: [item(1)] });
    show();
    expect(screen.getAllByTestId('queue-item')).toHaveLength(1);
    fireEvent.click(screen.getByText('prompt 1'));
    act(() => useQueue.setState({ items: [item(1), item(2)] }));
    expect(screen.getAllByTestId('queue-item')).toHaveLength(2);
    // The row that was open stays open.
    expect(screen.getAllByTestId('queue-item')[0]!.classList.contains('is-expanded')).toBe(true);
  });
});
