import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { canTurnOnLowMemory, useLowMemory } from './lowMemory';
import { useToasts } from './toasts';

afterEach(() => {
  vi.restoreAllMocks();
  useToasts.setState({ toasts: [] });
  useLowMemory.setState({ mode: null, busy: false });
});

describe('low-memory mode', () => {
  it('reads the mode once and switches it, telling the user when it waits for the next start', async () => {
    const read = vi.spyOn(backend, 'lowMemoryMode').mockResolvedValue({ enabled: false, ownedEngine: true, pendingRestart: false });
    await Promise.all([useLowMemory.getState().load(), useLowMemory.getState().load()]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(useLowMemory.getState().mode?.enabled).toBe(false);

    vi.spyOn(backend, 'setLowMemoryMode').mockResolvedValue({ enabled: true, ownedEngine: true, pendingRestart: true });
    await useLowMemory.getState().setEnabled(true);
    expect(useLowMemory.getState()).toMatchObject({ mode: { enabled: true, pendingRestart: true }, busy: false });
    const [toast] = useToasts.getState().toasts;
    expect(toast?.status).toBe('success');
    expect(toast?.description).toBeTruthy();
  });

  it('reports a failed switch and keeps the mode it had', async () => {
    useLowMemory.setState({ mode: { enabled: false, ownedEngine: true, pendingRestart: false } });
    vi.spyOn(backend, 'setLowMemoryMode').mockRejectedValue(new Error('cannot write settings.json'));
    await useLowMemory.getState().setEnabled(true);
    expect(useLowMemory.getState()).toMatchObject({ mode: { enabled: false }, busy: false });
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', description: 'cannot write settings.json' });
  });

  it('offers to turn it on only when it is off on novira’s own ComfyUI', () => {
    expect(canTurnOnLowMemory(null)).toBe(false);
    expect(canTurnOnLowMemory({ enabled: false, ownedEngine: true, pendingRestart: false })).toBe(true);
    expect(canTurnOnLowMemory({ enabled: true, ownedEngine: true, pendingRestart: true })).toBe(false);
    expect(canTurnOnLowMemory({ enabled: false, ownedEngine: false, pendingRestart: false })).toBe(false);
  });
});
