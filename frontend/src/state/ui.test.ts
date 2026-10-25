import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV, NAV_HOTKEYS, isGenerateMode, isScreenShown, navOf, showViewer, TABS, useUi } from './ui';

const initial = useUi.getState();
beforeEach(() => useUi.setState(initial, true));

const ui = () => useUi.getState();

describe('tab number keys', () => {
  it('number the side bar entries 1 to 8 in order, one key each', () => {
    expect(NAV.map((nav) => NAV_HOTKEYS[nav])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(new Set(NAV.map((nav) => NAV_HOTKEYS[nav])).size).toBe(NAV.length);
  });

  it('puts every screen under a side bar entry, with the comic under Generate', () => {
    expect(new Set(TABS.map(navOf))).toEqual(new Set(NAV));
    expect(navOf('comic')).toBe('generate');
    expect(navOf('upscaling')).toBe('upscaling');
    expect(navOf('canvas')).toBe('canvas');
    expect(TABS.filter(isGenerateMode)).toEqual(['generate', 'comic']);
  });

  it('remembers the last Generate mode shown, and not other tabs', () => {
    ui().setTab('comic');
    ui().setTab('upscaling');
    expect(ui().generateMode).toBe('comic');
    ui().setTab('generate');
    expect(ui().generateMode).toBe('generate');
  });
});

describe('ui store', () => {
  it('toggles both side panels together: closes if any is open, opens when both are closed', () => {
    ui().setLeftPanelOpen(false);
    ui().togglePanels();
    expect([ui().leftPanelOpen, ui().rightPanelOpen]).toEqual([false, false]);
    ui().togglePanels();
    expect([ui().leftPanelOpen, ui().rightPanelOpen]).toEqual([true, true]);
  });

  it('rounds panel widths and ignores sub-pixel changes', () => {
    ui().setPanelWidth('left', 321.6);
    expect(ui().panelWidths).toEqual({ left: 322, right: 400 });
    const before = ui().panelWidths;
    ui().setPanelWidth('left', 322.4);
    expect(ui().panelWidths).toBe(before);
  });

  it('sets the main view per tab', () => {
    ui().setMainView('canvas', 'viewer');
    expect(ui().mainView.canvas).toBe('viewer');
    expect(ui().mainView.generate).toBe(initial.mainView.generate);
  });

  it('shows the viewer only on tabs that have one', () => {
    showViewer('generate');
    expect(ui().mainView.generate).toBe('viewer');
    showViewer('models');
    expect(ui().mainView.models).toBe(initial.mainView.models);
    ui().setTab('workflows');
    showViewer();
    expect(ui().mainView.workflows).toBe('viewer');
  });

  it('bumps the focus nonce on every request', () => {
    ui().focusPrompt();
    ui().focusPrompt();
    expect(ui().focusPromptNonce).toBe(initial.focusPromptNonce + 2);
  });
});

describe('screens the app build hides', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cannot be opened from anywhere in the app build, and open everywhere else', () => {
    vi.stubEnv('MODE', 'production');
    expect(isScreenShown('video')).toBe(false);
    expect(isScreenShown('canvas')).toBe(true);
    ui().setMedia('video');
    ui().setTab('comic');
    expect([ui().activeTab, ui().media, ui().generateMode]).toEqual(['generate', 'image', 'generate']);
    ui().setTab('canvas');
    expect(ui().activeTab).toBe('canvas');
    vi.stubEnv('MODE', 'harness');
    ui().setMedia('video');
    ui().setTab('comic');
    expect([ui().activeTab, ui().media]).toEqual(['comic', 'video']);
  });
});
