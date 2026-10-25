// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type QueueItem } from '@/backend';
import { useLowMemory } from '@/state/lowMemory';
import { OutOfMemoryNotice } from './OutOfMemoryNotice';
import { TooltipProvider } from './controls';

const item = (params: Partial<QueueItem['params']> = {}): QueueItem =>
  ({
    id: 3,
    batchId: 'b',
    status: 'failed',
    origin: 'generate',
    destination: 'gallery',
    params: { generationMode: 'txt2img', width: 832, height: 1216, ...params },
    boardId: null,
    initImageUrl: null,
    workflow: null,
    createdAt: 0,
    startedAt: 0,
    completedAt: 1,
    imageName: null,
    error: 'ComfyUI KSampler: OOM',
    errorKind: 'out_of_memory',
  }) as QueueItem;

beforeEach(() => {
  vi.spyOn(backend, 'lowMemoryMode').mockResolvedValue({ enabled: false, ownedEngine: true, pendingRestart: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useLowMemory.setState({ mode: null, busy: false });
});

describe('out-of-memory notice', () => {
  it('offers a smaller retry and low-memory mode, and runs them', async () => {
    useLowMemory.setState({ mode: { enabled: false, ownedEngine: true, pendingRestart: false } });
    const retry = vi.spyOn(backend, 'retryQueueItem').mockResolvedValue(null);
    const setMode = vi.spyOn(backend, 'setLowMemoryMode').mockResolvedValue({ enabled: true, ownedEngine: true, pendingRestart: false });
    render(<OutOfMemoryNotice item={item()} />);
    fireEvent.click(screen.getByTestId('oom-retry-smaller'));
    expect(retry).toHaveBeenCalledWith(3, { width: 720, height: 1056 });
    fireEvent.click(screen.getByTestId('oom-low-memory'));
    expect(setMode).toHaveBeenCalledWith(true);
  });

  it('hides what does not apply', () => {
    useLowMemory.setState({ mode: { enabled: true, ownedEngine: true, pendingRestart: false } });
    render(<OutOfMemoryNotice item={item({ generationMode: 'video' })} />);
    expect(screen.getByTestId('oom-notice')).toBeTruthy();
    expect(screen.queryByTestId('oom-retry-smaller')).toBeNull();
    expect(screen.queryByTestId('oom-low-memory')).toBeNull();
  });

  it('closes when it has a close button', () => {
    const onDismiss = vi.fn();
    render(
      <TooltipProvider>
        <OutOfMemoryNotice item={item()} onDismiss={onDismiss} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close|閉じる/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
