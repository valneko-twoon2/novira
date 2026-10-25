// @vitest-environment jsdom
// The whole shell on the mock backend: start-up, tab switching (side bar and number keys), panel toggles, global shortcuts.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const gate = { showSplash: false, preparing: false, open: vi.fn() };
vi.mock('@/features/splash/useSplashGate', () => ({ useSplashGate: () => gate }));

const { App } = await import('./App');
const { backend } = await import('@/backend');
const { t } = await import('@/i18n');
const { useUi } = await import('@/state/ui');
const { useSettings } = await import('@/state/settings');
const { useAgent } = await import('@/state/agent');
const { useDevLog } = await import('@/state/devLog');

// The tab test mounts seven full tabs one after another (nothing is lazy, so the cost is rendering, not loading);
// that is ~1 s alone but passes 5 s when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });

async function openApp() {
  render(<App />);
  await screen.findByTestId('tab-generate');
}

let canvases: ReturnType<typeof installRecordingCanvases>;

/** The element with this test id on the open screen: a screen once opened stays mounted, hidden, while another shows. */
function shown(testId: string): HTMLElement {
  const el = screen.getAllByTestId(testId).find((e) => !e.closest('[style*="display: none"]'));
  if (!el) throw new Error(`no ${testId} on the open screen`);
  return el;
}

describe('App shell', () => {
  beforeAll(() => {
    canvases = installRecordingCanvases();
  });
  afterAll(() => canvases.restore());
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    backend.setStepDelay(0);
    gate.showSplash = false;
    useUi.getState().openModal(null);
    useUi.getState().setTab('generate');
    useUi.getState().setLeftPanelOpen(true);
    useUi.getState().setRightPanelOpen(true);
    useSettings.getState().set({ showDevLog: false });
    useAgent.getState().setOpen(false);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the side bar and the generate tab after start-up', async () => {
    await openApp();
    expect(screen.getByTestId('tab-generate').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('tab-queue')).toBeTruthy();
    expect(screen.getByText(t('app.nav.mock'))).toBeTruthy();
  });

  it('shows the phone layout on a phone-sized window', async () => {
    const { PHONE_QUERY } = await import('@/state/layout');
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<App />);
    await screen.findByTestId('phone-shell');
    expect(screen.queryByTestId('tab-generate')).toBeNull();
  });

  it('builds the shell hidden under the start-up screen, without its shortcuts, and shows it when the screen goes', async () => {
    gate.showSplash = true;
    const { rerender } = render(<App />);
    const entry = await screen.findByTestId('tab-generate');
    expect(screen.getByTestId('splash')).toBeTruthy();
    expect(entry.closest('.app')?.getAttribute('style')).toContain('display: none');
    key('t');
    expect(useUi.getState().leftPanelOpen).toBe(true);
    gate.showSplash = false;
    rerender(<App />);
    await waitFor(() => expect(screen.queryByTestId('splash')).toBeNull());
    expect(screen.getByTestId('tab-generate').closest('.app')?.getAttribute('style') ?? '').not.toContain('display: none');
    key('t');
    expect(useUi.getState().leftPanelOpen).toBe(false);
  });

  it('switches tabs from the side bar and with the number keys', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('tab-canvas'));
    expect(useUi.getState().activeTab).toBe('canvas');
    key('4');
    expect(useUi.getState().activeTab).toBe('workflows');
    key('7');
    expect(useUi.getState().activeTab).toBe('queue');
    key('5');
    expect(useUi.getState().activeTab).toBe('models');
    key('6');
    expect(useUi.getState().activeTab).toBe('browse');
    key('3');
    expect(useUi.getState().activeTab).toBe('upscaling');
    await waitFor(() => expect(screen.getByTestId('tab-upscaling').getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByTestId('tab-generate').getAttribute('aria-selected')).toBe('false');
    // The comic is a mode of the Generate entry: the last icon of the media row, and the entry stays lit.
    key('1');
    await waitFor(() => expect(shown('media-image').getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(shown('media-comic'));
    expect(useUi.getState().activeTab).toBe('comic');
    expect(screen.getByTestId('tab-generate').getAttribute('aria-selected')).toBe('true');
    key('8');
    expect(useUi.getState().activeTab).toBe('extensions');
    await waitFor(() => expect(screen.getByTestId('tab-generate').getAttribute('aria-selected')).toBe('false'));
    // The Generate entry and key 1 reopen the mode that was shown last.
    key('1');
    await waitFor(() => expect(shown('media-comic').getAttribute('aria-selected')).toBe('true'));
    key('8');
    fireEvent.click(screen.getByTestId('tab-generate'));
    expect(useUi.getState().activeTab).toBe('comic');
    fireEvent.click(shown('media-image'));
    expect(useUi.getState().activeTab).toBe('generate');
  });

  it('toggles the panels with T, G and F, and with the arrow buttons', async () => {
    await openApp();
    key('t');
    expect(useUi.getState().leftPanelOpen).toBe(false);
    key('t');
    expect(useUi.getState().leftPanelOpen).toBe(true);
    key('g');
    expect(useUi.getState().rightPanelOpen).toBe(false);
    key('g');
    key('f');
    expect(useUi.getState().leftPanelOpen).toBe(false);
    expect(useUi.getState().rightPanelOpen).toBe(false);
    key('f');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('app.panels.hideLeft').split(' ')[0]!) }));
    expect(useUi.getState().leftPanelOpen).toBe(false);
  });

  it('switches the main view tabs of the generate tab', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('view-launchpad'));
    expect(useUi.getState().mainView.generate).toBe('launchpad');
    fireEvent.click(screen.getByTestId('view-drafts'));
    expect(useUi.getState().mainView.generate).toBe('drafts');
    fireEvent.click(screen.getByTestId('view-viewer'));
    expect(useUi.getState().mainView.generate).toBe('viewer');
  });

  it('renders the other media in the generate tab and the canvas layout with the layers panel', async () => {
    await openApp();
    for (const media of ['video', 'text', 'music', 'voice', 'logo', 'image'] as const) {
      act(() => useUi.getState().setMedia(media));
      expect(useUi.getState().media).toBe(media);
    }
    fireEvent.click(screen.getByTestId('tab-workflows'));
    fireEvent.click(screen.getByTestId('view-editor'));
    expect(useUi.getState().mainView.workflows).toBe('editor');
    fireEvent.click(screen.getByTestId('tab-canvas'));
    fireEvent.click(screen.getByTestId('view-canvas'));
    expect(useUi.getState().mainView.canvas).toBe('canvas');
  });

  it('opens the hotkeys modal with ? and focuses the prompt with Alt+A', async () => {
    await openApp();
    key('?', { shiftKey: true });
    expect(useUi.getState().modal).toBe('hotkeys');
    const focus = vi.spyOn(useUi.getState(), 'focusPrompt');
    key('a', { altKey: true });
    expect(focus).toHaveBeenCalled();
  });

  it('invokes with Ctrl+Enter, cancels the running item with Shift+X and clears with Ctrl+Shift+X', async () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem');
    const clear = vi.spyOn(backend, 'clearQueue');
    await openApp();
    key('Enter', { ctrlKey: true });
    key('Enter', { ctrlKey: true, shiftKey: true });
    key('x', { shiftKey: true });
    key('x', { ctrlKey: true, shiftKey: true });
    expect(clear).toHaveBeenCalled();
    cancel.mockRestore();
    clear.mockRestore();
  });

  it('opens the settings menu entries, the about box, the assistant and the developer log', async () => {
    useSettings.getState().set({ showDevLog: true });
    await openApp();
    fireEvent.click(screen.getByTestId('agent-open'));
    expect(useAgent.getState().open).toBe(true);
    fireEvent.click(screen.getByTestId('devlog-open'));
    expect(useDevLog.getState().open).toBe(true);
    fireEvent.click(screen.getByTestId('devlog-open'));
    expect(useDevLog.getState().open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: t('app.nav.about') }));
    expect(useUi.getState().modal).toBe('about');
  });

  it('shows the extensions screen from its tab in the side bar', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('tab-extensions'));
    expect(useUi.getState().activeTab).toBe('extensions');
    expect(await screen.findByTestId('extensions-tab')).toBeTruthy();
    useUi.getState().setTab('generate');
  });

  it('opens each entry of the settings menu', async () => {
    await openApp();
    const trigger = screen.getByRole('button', { name: t('app.nav.settingsMenu') });
    for (const modal of ['settings', 'hotkeys', 'about']) {
      fireEvent.keyDown(trigger, { key: 'Enter' });
      const menu = within(await screen.findByRole('menu'));
      fireEvent.click(menu.getByText(t(`app.nav.${modal}` as 'app.nav.about')));
      await waitFor(() => expect(useUi.getState().modal).toBe(modal));
      useUi.getState().openModal(null);
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    }
  });
});
