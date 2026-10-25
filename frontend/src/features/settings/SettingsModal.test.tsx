// @vitest-environment jsdom
// The settings modal: its tabs, the controls of each tab writing to their stores, clearing intermediates, and resetting
// a chosen part of the saved state.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EngineSettings } from '@/backend';
import { asBrowserServer } from '@/backend/browserServer.testkit';
import { t, tCount } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { SETTINGS_DEFAULTS, useSettings } from '@/state/settings';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { PERSIST_PREFIX } from '@/state/uiState';
import { TooltipProvider } from '@/ui';
import { SettingsModal } from './SettingsModal';

const initial = { settings: useSettings.getState(), gallery: useGallery.getState(), toasts: useToasts.getState(), ui: useUi.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);
const modal = () => within(screen.getByTestId('settings-modal'));
const toggle = (label: string) => fireEvent.click(modal().getByRole('switch', { name: label }));
const openTab = (id: string) => fireEvent.click(screen.getByTestId(`settings-tab-${id}`));
const numberBox = (label: string) => modal().getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const typeNumber = (label: string, value: string) => {
  const box = numberBox(label);
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
};

/** Opens a select by its test id and picks the option with this text. */
async function choose(testId: string, label: string) {
  fireEvent.keyDown(await screen.findByTestId(testId), { key: 'Enter' });
  const option = await screen.findByRole('option', { name: label });
  fireEvent.keyDown(option, { key: 'Enter' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

function show() {
  render(
    <TooltipProvider>
      <SettingsModal />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  useSettings.setState({ ...initial.settings, ...SETTINGS_DEFAULTS }, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState({ ...initial.ui, modal: 'settings' }, true);
  show();
  openTab('general');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the tabs', () => {
  it('shows one tab at a time, and none of the switches that did nothing', () => {
    expect(screen.getByTestId('settings-pane-general')).toBeTruthy();
    expect(screen.getByTestId('settings-tab-general').getAttribute('aria-selected')).toBe('true');
    for (const id of ['generation', 'gallery', 'edit', 'comicText', 'engine', 'accounts', 'data', 'developer']) {
      openTab(id);
      expect(screen.getByTestId(`settings-pane-${id}`)).toBeTruthy();
      expect(screen.queryByTestId('settings-pane-general')).toBeNull();
    }
    expect(screen.queryByText(/CPU/)).toBeNull();
  });

  it('opens again on the tab last open', () => {
    openTab('data');
    cleanup();
    show();
    expect(screen.getByTestId('settings-pane-data')).toBeTruthy();
  });

  it('closes with the close button', () => {
    fireEvent.click(screen.getByLabelText(t('common.close')));
    expect(useUi.getState().modal).toBeNull();
  });
});

describe('general', () => {
  it('chooses the tab the app opens on and how long a notification stays', async () => {
    fireEvent.click(screen.getByTestId('settings-start-tab'));
    expect(screen.getByRole('option', { name: t('app.tabs.models') })).toBeTruthy();
    expect(screen.queryByRole('option', { name: t('app.tabs.comic') })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await choose('settings-start-tab', t('app.tabs.models'));
    expect(useSettings.getState().startTab).toBe('models');
    typeNumber(t('settings.toastSeconds.label'), '8');
    expect(useSettings.getState().toastSeconds).toBe(8);
    expect(modal().getByText(t('settings.version', { version: 'novira 0.1.0 (mock)' }))).toBeTruthy();
    expect(screen.queryByLabelText(t('settings.uiZoom.label'))).toBeNull();
  });
});

describe('generation, gallery, editing and developer', () => {
  it('flips their switches and writes their numbers', () => {
    openTab('generation');
    toggle(t('settings.antialiasProgressImages'));
    expect(useSettings.getState().antialiasProgressImages).toBe(true);
    typeNumber(t('settings.mockStepDelay'), '120');
    expect(useSettings.getState().mockStepDelay).toBe(120);
    expect(useSettings.getState().draftCount).toBe(4);
    typeNumber(t('settings.draftCount.label'), '6');
    expect(useSettings.getState().draftCount).toBe(6);
    expect(useSettings.getState().draftPosition).toBe(35);
    typeNumber(t('settings.draftPosition.label'), '50');
    expect(useSettings.getState().draftPosition).toBe(50);
    openTab('gallery');
    toggle(t('settings.confirmOnDelete'));
    expect(useSettings.getState().confirmOnDelete).toBe(false);
    const groupByDate = useGallery.getState().settings.groupByDate;
    toggle(t('gallery.settings.groupByDate'));
    expect(useGallery.getState().settings.groupByDate).toBe(!groupByDate);
    openTab('edit');
    typeNumber(t('settings.undoLimit.label'), '120');
    expect(useSettings.getState().undoLimit).toBe(120);
    openTab('developer');
    const devLog = useSettings.getState().showDevLog;
    toggle(t('settings.showDevLog'));
    expect(useSettings.getState().showDevLog).toBe(!devLog);
  });

  it('chooses whether the assistant may read pictures and prompts', async () => {
    openTab('generation');
    expect(useSettings.getState().assistantReadAccess).toBe('ask');
    await choose('settings-assistant-read', t('settings.assistantRead.never'));
    expect(useSettings.getState().assistantReadAccess).toBe('never');
    await choose('settings-assistant-read', t('settings.assistantRead.always'));
    expect(useSettings.getState().assistantReadAccess).toBe('always');
  });

  it('chooses whether the assistant may look things up on Wikipedia, apart from reading pictures', async () => {
    openTab('generation');
    expect(useSettings.getState().assistantWebAccess).toBe('ask');
    await choose('settings-assistant-web', t('settings.assistantRead.never'));
    expect(useSettings.getState().assistantWebAccess).toBe('never');
    await choose('settings-assistant-web', t('settings.assistantRead.always'));
    expect(useSettings.getState().assistantWebAccess).toBe('always');
    expect(useSettings.getState().assistantReadAccess).toBe('ask');
  });
});

describe('clearing intermediates', () => {
  beforeEach(() => openTab('gallery'));

  it('is off without intermediate pictures', () => {
    expect((modal().getByText(tCount('settings.clearIntermediatesButton', 0)).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('deletes them and says how many', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    act(() =>
      useGallery.setState({
        images: [
          { name: 'i1.png', isIntermediate: true } as never,
          { name: 'i2.png', isIntermediate: true } as never,
          { name: 'keep.png', isIntermediate: false } as never,
        ],
      }),
    );
    fireEvent.click(modal().getByText(tCount('settings.clearIntermediatesButton', 2)));
    await waitFor(() => expect(del).toHaveBeenCalledWith(['i1.png', 'i2.png']));
    await waitFor(() => expect(useGallery.getState().images.map((i) => i.name)).toEqual(['keep.png']));
    expect(lastToast()?.status).toBe('success');
  });

  it('reports a failure', async () => {
    vi.spyOn(backend, 'deleteImages').mockRejectedValue(new Error('locked'));
    act(() => useGallery.setState({ images: [{ name: 'i1.png', isIntermediate: true } as never] }));
    fireEvent.click(modal().getByText(tCount('settings.clearIntermediatesButton', 1)));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'locked' }));
    expect(useGallery.getState().images).toHaveLength(1);
  });
});

describe('resetting', () => {
  beforeEach(() => openTab('data'));
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ['novira.agent', 'novira.params', `${PERSIST_PREFIX}test`, 'other-key']) localStorage.removeItem(key);
  });
  const resetNow = () => {
    fireEvent.click(screen.getByTestId('settings-reset'));
    fireEvent.click(screen.getByTestId('settings-reset-confirm'));
  };

  it('puts the settings back at once by default, asking first, and leaves the rest of the saved state', () => {
    localStorage.setItem('novira.params', '{}');
    useSettings.getState().set({ confirmOnDelete: false });
    fireEvent.click(screen.getByTestId('settings-reset'));
    fireEvent.click(modal().getByText(t('common.cancel')));
    expect(useSettings.getState().confirmOnDelete).toBe(false);
    resetNow();
    expect(useSettings.getState().confirmOnDelete).toBe(true);
    expect(localStorage.getItem('novira.params')).toBe('{}');
    expect(screen.queryByTestId('settings-reset-done')).toBeNull();
    expect(lastToast()?.status).toBe('success');
  });

  it('clears only the chosen part, says what it clears, and offers a reload', async () => {
    localStorage.setItem('novira.agent', '{}');
    localStorage.setItem('novira.params', '{}');
    await choose('settings-reset-scope', t('settings.reset.scope.assistant'));
    expect(modal().getByText(t('settings.reset.scope.assistantHelp'))).toBeTruthy();
    useSettings.getState().set({ confirmOnDelete: false });
    resetNow();
    expect(localStorage.getItem('novira.agent')).toBeNull();
    expect(localStorage.getItem('novira.params')).toBe('{}');
    expect(useSettings.getState().confirmOnDelete).toBe(false);
    expect(screen.getByTestId('settings-reset-done')).toBeTruthy();
  });

  it('clears every saved key of the app for everything, and nothing outside it', async () => {
    localStorage.setItem(`${PERSIST_PREFIX}test`, '1');
    localStorage.setItem('other-key', '1');
    await choose('settings-reset-scope', t('settings.reset.scope.all'));
    resetNow();
    expect(localStorage.getItem(`${PERSIST_PREFIX}test`)).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('1');
    expect(modal().getByText(t('settings.resetDone'))).toBeTruthy();
  });

  it('still resets the settings when the storage cannot be used', () => {
    vi.stubGlobal(
      'localStorage',
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('blocked');
          },
        },
      ),
    );
    useSettings.setState({ confirmOnDelete: false });
    resetNow();
    expect(useSettings.getState().confirmOnDelete).toBe(true);
  });
});

describe('the desktop app', () => {
  it('offers the UI zoom', () => {
    cleanup();
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as never);
    show();
    openTab('general');
    expect(screen.getAllByLabelText(t('settings.uiZoom.label')).length).toBeGreaterThan(0);
    expect(modal().getByText(t('settings.version', { version: 'novira 0.1.0' }))).toBeTruthy();
    openTab('generation');
    expect(screen.queryByLabelText(t('settings.mockStepDelay'))).toBeNull();
  });
});

describe('comic and text', () => {
  beforeEach(() => openTab('comicText'));

  it('sets the default balloon font from the app and computer fonts, and back to the standard one', async () => {
    expect(screen.getByTestId('settings-comic-font').textContent).toContain(t('common.font.standard'));
    fireEvent.click(screen.getByTestId('settings-comic-font'));
    fireEvent.click(await screen.findByText('Yu Mincho'));
    expect(useSettings.getState().comicFont).toBe('Yu Mincho');
    fireEvent.click(screen.getByTestId('settings-comic-font'));
    fireEvent.click((await screen.findAllByTestId('font-option'))[0]!);
    expect(useSettings.getState().comicFont).toBe('');
  });

  it('sets how new comic pages start and the font of new text', async () => {
    await choose('settings-comic-size', 'B5');
    await choose('settings-comic-direction', t('comic.page.direction.ltr'));
    typeNumber(t('settings.comicPage.panels'), '5');
    expect(useSettings.getState()).toMatchObject({ comicPageSize: 'B5', comicDirection: 'ltr', comicPanelCount: 5 });
    fireEvent.click(screen.getByTestId('settings-text-font'));
    fireEvent.click(await screen.findByText('Meiryo'));
    expect(useSettings.getState().textFont).toBe('Meiryo');
  });
});

describe('the engine', () => {
  it('turns the Civitai lookup on, and says it applies at the next start', async () => {
    const engine = { dataDir: 'C:\\data', comfyuiMode: 'owned' as const, comfyuiUrl: null, comfyuiDir: null, comfyuiPackage: 'nvidia' as const, comfyuiInstalled: false, installedComfyuiPackage: null, comfyuiStartTimeoutSecs: 180, civitaiLookup: false, modelRoots: [] as string[], restartNeeded: false };
    vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
    const set = vi.spyOn(backend, 'setEngineSettings').mockImplementation(async (p) => ({ ...engine, ...p, restartNeeded: true }));
    openTab('engine');
    fireEvent.click(await screen.findByRole('switch', { name: t('settings.engine.civitai.label') }));
    await waitFor(() => expect(set).toHaveBeenCalledWith({ civitaiLookup: true }));
    expect(await screen.findByTestId('settings-engine-restart')).toBeTruthy();
  });

  it('shows where the data and the engine are, and changes the package, the start wait and the model folders', async () => {
    const engine = { dataDir: 'C:\\data', comfyuiMode: 'owned' as const, comfyuiUrl: null, comfyuiDir: null, comfyuiPackage: 'nvidia' as const, comfyuiInstalled: false, installedComfyuiPackage: null, comfyuiStartTimeoutSecs: 180, civitaiLookup: false, modelRoots: [] as string[], restartNeeded: false };
    vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
    const set = vi.spyOn(backend, 'setEngineSettings').mockImplementation(async (p) => ({ ...engine, ...p, restartNeeded: true }));
    vi.spyOn(backend, 'addModelRoot').mockResolvedValueOnce({ ...engine, modelRoots: ['D:\\Models'], restartNeeded: true }).mockResolvedValueOnce(null);
    const remove = vi.spyOn(backend, 'removeModelRoot').mockResolvedValue(engine);
    openTab('engine');
    expect((await screen.findByTestId('settings-engine-data-dir')).textContent).toBe('C:\\data');
    expect(screen.getByTestId('settings-engine-mode').textContent).toBe(t('settings.engine.comfyui.owned'));
    expect(screen.getByText(t('settings.engine.modelRoots.none'))).toBeTruthy();
    expect(screen.queryByTestId('settings-engine-restart')).toBeNull();

    await choose('settings-engine-package', t('settings.engine.package.amd'));
    await waitFor(() => expect(set).toHaveBeenCalledWith({ comfyuiPackage: 'amd' }));
    expect(await screen.findByTestId('settings-engine-restart')).toBeTruthy();

    // The start wait is saved once, after the box rests.
    typeNumber(t('settings.engine.timeout.label'), '300');
    await waitFor(() => expect(set).toHaveBeenCalledWith({ comfyuiStartTimeoutSecs: 300 }));
    expect(set).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('settings-engine-root-add'));
    expect(await screen.findByText('D:\\Models')).toBeTruthy();
    // A cancelled folder dialog changes nothing.
    fireEvent.click(screen.getByTestId('settings-engine-root-add'));
    await waitFor(() => expect((screen.getByTestId('settings-engine-root-add') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('D:\\Models')).toBeTruthy();
    fireEvent.click(screen.getByTestId('settings-engine-root-remove'));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(0));
    await waitFor(() => expect(screen.queryByText('D:\\Models')).toBeNull());
  });

  it('shows an engine named elsewhere, and reports a change the backend refuses', async () => {
    const engine = { dataDir: 'C:\\data', comfyuiMode: 'url' as const, comfyuiUrl: 'http://127.0.0.1:8188', comfyuiDir: null, comfyuiPackage: 'nvidia' as const, comfyuiInstalled: false, installedComfyuiPackage: null, comfyuiStartTimeoutSecs: 180, civitaiLookup: false, modelRoots: [], restartNeeded: false };
    vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
    vi.spyOn(backend, 'addModelRoot').mockRejectedValue(new Error('already listed'));
    openTab('engine');
    expect((await screen.findByTestId('settings-engine-mode')).textContent).toBe('http://127.0.0.1:8188');
    fireEvent.click(screen.getByTestId('settings-engine-root-add'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', title: t('settings.engine.failed'), description: 'already listed' }));
  });

  it('says an extra model folder is added in the desktop app when the page is on the browser server', async () => {
    asBrowserServer();
    const engine = { dataDir: 'C:\\data', comfyuiMode: 'owned' as const, comfyuiUrl: null, comfyuiDir: null, comfyuiPackage: 'nvidia' as const, comfyuiInstalled: false, installedComfyuiPackage: null, comfyuiStartTimeoutSecs: 180, civitaiLookup: false, modelRoots: ['D:\\Models'], restartNeeded: false };
    vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
    openTab('engine');
    expect((await screen.findByTestId('settings-engine-root-desktop-only')).textContent).toBe(t('common.desktopOnly'));
    expect(screen.queryByTestId('settings-engine-root-add')).toBeNull();
    // A listed folder can still be taken out: that needs no dialog.
    expect(screen.getByTestId('settings-engine-root-remove')).toBeTruthy();
  });

  describe('the package choice when novira has installed ComfyUI', () => {
    /** An owned engine as the backend reports it: the package saved, and what novira installed (null when unknown). */
    const engineFor = (over: Partial<EngineSettings>): EngineSettings => ({
      dataDir: 'C:\\data',
      comfyuiMode: 'owned',
      comfyuiUrl: null,
      comfyuiDir: null,
      comfyuiPackage: 'nvidia',
      comfyuiInstalled: false,
      installedComfyuiPackage: null,
      comfyuiStartTimeoutSecs: 180,
      civitaiLookup: false,
      modelRoots: [],
      restartNeeded: false,
      ...over,
    });
    /** A save that echoes the patch, as the backend does (the install itself waits for the next start). */
    const echoSave = (engine: EngineSettings) =>
      vi.spyOn(backend, 'setEngineSettings').mockImplementation(async (p) => ({ ...engine, ...p, restartNeeded: true }));

    it('changes the package at once when no ComfyUI is installed yet', async () => {
      const engine = engineFor({});
      vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
      const set = echoSave(engine);
      openTab('engine');
      await choose('settings-engine-package', t('settings.engine.package.amd'));
      await waitFor(() => expect(set).toHaveBeenCalledWith({ comfyuiPackage: 'amd' }));
      expect(screen.queryByTestId('settings-engine-package-confirm')).toBeNull();
      expect(screen.queryByText(t('settings.engine.package.reinstall'))).toBeNull();
    });

    it('asks before another package reinstalls ComfyUI; Cancel saves nothing, confirm saves the package', async () => {
      const engine = engineFor({ comfyuiInstalled: true, installedComfyuiPackage: 'nvidia' });
      vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
      const set = echoSave(engine);
      openTab('engine');

      await choose('settings-engine-package', t('settings.engine.package.amd'));
      expect(await screen.findByText(t('settings.engine.package.reinstall'))).toBeTruthy();
      expect(screen.getByTestId('settings-engine-package').textContent).toBe(t('settings.engine.package.amd'));
      expect(set).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('settings-engine-package-cancel'));
      expect(screen.queryByTestId('settings-engine-package-confirm')).toBeNull();
      expect(screen.getByTestId('settings-engine-package').textContent).toBe(t('settings.engine.package.nvidia'));
      expect(set).not.toHaveBeenCalled();

      await choose('settings-engine-package', t('settings.engine.package.amd'));
      fireEvent.click(await screen.findByTestId('settings-engine-package-confirm'));
      await waitFor(() => expect(set).toHaveBeenCalledWith({ comfyuiPackage: 'amd' }));
      expect(set).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('settings-engine-restart')).toBeTruthy();
      await waitFor(() => expect(screen.queryByTestId('settings-engine-package-confirm')).toBeNull());
    });

    it('does not ask when the package is the one the install came from', async () => {
      // Saved amd, installed from nvidia (the change waits for the next start): choosing nvidia again saves at once.
      const engine = engineFor({ comfyuiInstalled: true, installedComfyuiPackage: 'nvidia', comfyuiPackage: 'amd', restartNeeded: true });
      vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
      const set = echoSave(engine);
      openTab('engine');
      await choose('settings-engine-package', t('settings.engine.package.nvidia'));
      await waitFor(() => expect(set).toHaveBeenCalledWith({ comfyuiPackage: 'nvidia' }));
      expect(screen.queryByTestId('settings-engine-package-confirm')).toBeNull();
    });

    it('takes an install of unknown origin to be the saved package, so another package asks first', async () => {
      const engine = engineFor({ comfyuiInstalled: true, installedComfyuiPackage: null, comfyuiPackage: 'nvidia' });
      vi.spyOn(backend, 'engineSettings').mockResolvedValue(engine);
      const set = echoSave(engine);
      openTab('engine');
      await choose('settings-engine-package', t('settings.engine.package.amd'));
      expect(await screen.findByText(t('settings.engine.package.reinstall'))).toBeTruthy();
      expect(set).not.toHaveBeenCalled();
    });
  });
});

describe('openSettings of the ui state', () => {
  it('opens the modal on the chosen tab', () => {
    cleanup();
    useUi.setState({ ...initial.ui, modal: null }, true);
    useUi.getState().openSettings('engine');
    show();
    expect(useUi.getState().modal).toBe('settings');
    expect(screen.getByTestId('settings-tab-engine').getAttribute('aria-selected')).toBe('true');
  });
});
