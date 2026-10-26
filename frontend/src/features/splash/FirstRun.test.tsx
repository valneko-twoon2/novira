// @vitest-environment jsdom
// The first-start screen: the default folders show, a chosen folder replaces its default, and "start" saves and restarts.
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FirstRunInfo } from '@/backend';
import { FirstRun } from './FirstRun';

const initial: FirstRunInfo = {
  needed: true,
  dataDir: 'C:/Users/me/novira-data',
  comfyuiDir: 'C:/Users/me/novira-data/comfyui',
  dataIsDefault: true,
  comfyuiIsDefault: true,
  moving: false,
  moved: 0,
  toMove: 0,
};

let calls: { cmd: string; payload: unknown }[] = [];
const answer = (handler: (cmd: string, payload: unknown) => unknown) => {
  calls = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    return handler(cmd, payload);
  });
};

afterEach(() => {
  cleanup();
  clearMocks();
  vi.unstubAllGlobals();
});

describe('first-start screen', () => {
  it('shows the default folders and no "use the default" button', () => {
    answer(() => null);
    render(<FirstRun initial={initial} />);
    expect(screen.getByTestId('first-run-data-path').textContent).toBe(initial.dataDir);
    expect(screen.getByTestId('first-run-comfyui-path').textContent).toBe(initial.comfyuiDir);
    expect(screen.queryByTestId('first-run-data-reset')).toBeNull();
    expect(screen.queryByTestId('first-run-comfyui-reset')).toBeNull();
  });

  it('shows a folder chosen in the dialog, and goes back to the default', async () => {
    const chosen = { ...initial, dataDir: 'D:/novira', comfyuiDir: 'D:/novira/comfyui', dataIsDefault: false };
    answer((cmd) => (cmd === 'first_run_choose' ? chosen : cmd === 'first_run_reset' ? initial : null));
    render(<FirstRun initial={initial} />);
    fireEvent.click(screen.getByTestId('first-run-data-choose'));
    await waitFor(() => expect(screen.getByTestId('first-run-data-path').textContent).toBe('D:/novira'));
    expect(calls[0]).toEqual({ cmd: 'first_run_choose', payload: { kind: 'data' } });
    fireEvent.click(screen.getByTestId('first-run-data-reset'));
    await waitFor(() => expect(screen.getByTestId('first-run-data-path').textContent).toBe(initial.dataDir));
    expect(calls[1]).toEqual({ cmd: 'first_run_reset', payload: { kind: 'data' } });
  });

  it('keeps the folder when the dialog is cancelled', async () => {
    answer(() => null);
    render(<FirstRun initial={initial} />);
    fireEvent.click(screen.getByTestId('first-run-comfyui-choose'));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.getByTestId('first-run-comfyui-path').textContent).toBe(initial.comfyuiDir);
    expect(screen.queryByTestId('first-run-failure')).toBeNull();
  });

  it('shows why a folder was refused', async () => {
    answer((cmd) => {
      if (cmd === 'first_run_choose') throw 'The chosen path is not a folder';
      return null;
    });
    render(<FirstRun initial={initial} />);
    fireEvent.click(screen.getByTestId('first-run-data-choose'));
    await waitFor(() => expect(screen.getByTestId('first-run-failure').textContent).toContain('The chosen path is not a folder'));
    expect(screen.getByTestId('first-run-data-path').textContent).toBe(initial.dataDir);
  });

  it('saves the choice and restarts on "start", and says why when it cannot', async () => {
    answer((cmd) => {
      if (cmd === 'first_run_finish') throw 'cannot create D:/novira';
      return null;
    });
    render(<FirstRun initial={initial} />);
    fireEvent.click(screen.getByTestId('first-run-start'));
    await waitFor(() => expect(screen.getByTestId('first-run-failure').textContent).toContain('cannot create'));
    expect(calls).toEqual([{ cmd: 'first_run_finish', payload: {} }]);
    expect((screen.getByTestId('first-run-start') as HTMLButtonElement).disabled).toBe(false);
  });

  it('only says that the data is being moved while a folder change from the Settings screen is carried out', () => {
    answer(() => null);
    render(<FirstRun initial={{ ...initial, needed: false, moving: true }} />);
    expect(screen.getByTestId('data-moving')).toBeTruthy();
    expect(screen.queryByTestId('first-run-start')).toBeNull();
    expect(screen.getByTestId('data-moving-percent').textContent).toBe('');
    expect(calls).toEqual([]);
  });

  it('shows how far the copy is, asking again as it goes', async () => {
    const moving = { ...initial, needed: false, moving: true };
    answer((cmd) => (cmd === 'first_run_info' ? { ...moving, moved: 3 * 1024 ** 3, toMove: 4 * 1024 ** 3 } : null));
    render(<FirstRun initial={{ ...moving, moved: 1024 ** 3, toMove: 4 * 1024 ** 3 }} />);
    expect(screen.getByTestId('data-moving-percent').textContent).toBe('25%');
    await waitFor(() => expect(screen.getByTestId('data-moving-percent').textContent).toBe('75%'), {
      timeout: 2000,
    });
    expect(calls.every((c) => c.cmd === 'first_run_info')).toBe(true);
  });
});
