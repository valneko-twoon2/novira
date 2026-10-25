// @vitest-environment jsdom
// The settings read back from storage field by field, the tab the app opens on, and the settings that decide how new
// things start: comic pages, text layers and the undo history of the editors.
import { afterEach, describe, expect, it } from 'vitest';
import { useCanvas } from './canvas';
import { activePage, useComic } from './comic/store';
import { applyStartTab, DRAFT_COUNT_RANGE, DRAFT_POSITION_RANGE, restoreSettings, SETTINGS_DEFAULTS, UNDO_LIMIT_RANGE, useSettings } from './settings';
import { useTextEditor, withDefaultFont } from './text/textEditor';
import { newTextLayer } from './text/textModel';
import { useUi } from './ui';

afterEach(() => {
  useSettings.getState().reset();
  localStorage.clear();
});

describe('restoreSettings', () => {
  it('keeps a saved start tab of Upscaling and of the comic, a mode of the Generate entry', () => {
    expect(restoreSettings({ startTab: 'upscaling' }).startTab).toBe('upscaling');
    expect(restoreSettings({ startTab: 'comic', lastTab: 'comic' })).toMatchObject({ startTab: 'generate', lastTab: 'comic' });
  });

  it('keeps every valid field and puts each wrong one back to its default', () => {
    const good = { ...SETTINGS_DEFAULTS, language: 'en', theme: 'light', startTab: 'last', lastTab: 'comic', toastSeconds: 6, undoLimit: 120, comicPageSize: 'B5', comicDirection: 'ltr', comicPanelCount: 5, textFont: 'Meiryo' };
    expect(restoreSettings(good)).toEqual(good);
    const bad = { language: 'xx', theme: 'blue', startTab: 'nowhere', toastSeconds: 99, undoLimit: UNDO_LIMIT_RANGE.min - 1, comicPanelCount: 2.5e9, comicFrameMm: 'thick', textFont: 'a"b', confirmOnDelete: 'yes' };
    expect(restoreSettings(bad)).toEqual(SETTINGS_DEFAULTS);
    expect(restoreSettings(null)).toEqual(SETTINGS_DEFAULTS);
  });

  it('reads back whether the assistant may read pictures and prompts, asking each time when unsure', () => {
    expect(SETTINGS_DEFAULTS.assistantReadAccess).toBe('ask');
    for (const access of ['always', 'ask', 'never'] as const) expect(restoreSettings({ assistantReadAccess: access }).assistantReadAccess).toBe(access);
    for (const wrong of ['yes', true, 1, null, 'ALWAYS']) expect(restoreSettings({ assistantReadAccess: wrong }).assistantReadAccess).toBe('ask');
  });

  it('reads back whether the assistant may look things up on the web, separately and asking each time when unsure', () => {
    expect(SETTINGS_DEFAULTS.assistantWebAccess).toBe('ask');
    for (const access of ['always', 'ask', 'never'] as const) expect(restoreSettings({ assistantWebAccess: access }).assistantWebAccess).toBe(access);
    for (const wrong of ['yes', true, 1, null, 'ALWAYS']) expect(restoreSettings({ assistantWebAccess: wrong }).assistantWebAccess).toBe('ask');
    // The pictures' setting does not carry over to the web one.
    expect(restoreSettings({ assistantReadAccess: 'always' }).assistantWebAccess).toBe('ask');
  });

  it('starts the Drafts count at 4 and reads back only a whole number from 1 to 24', () => {
    expect(SETTINGS_DEFAULTS.draftCount).toBe(4);
    for (const ok of [DRAFT_COUNT_RANGE.min, 8, DRAFT_COUNT_RANGE.max]) expect(restoreSettings({ draftCount: ok }).draftCount).toBe(ok);
    for (const wrong of [0, DRAFT_COUNT_RANGE.max + 1, 2.5, -3, NaN, '8', null, true]) expect(restoreSettings({ draftCount: wrong }).draftCount).toBe(4);
    // A store from before the setting has none: it reads back as the default.
    expect(restoreSettings({ language: 'en' }).draftCount).toBe(4);
    expect(SETTINGS_DEFAULTS.draftPosition).toBe(35);
    for (const ok of [DRAFT_POSITION_RANGE.min, 40, DRAFT_POSITION_RANGE.max]) expect(restoreSettings({ draftPosition: ok }).draftPosition).toBe(ok);
    for (const wrong of [24, 61, 32.5, NaN, '40', null]) expect(restoreSettings({ draftPosition: wrong }).draftPosition).toBe(35);
  });

  it('drops the four switches that did nothing from an old store', async () => {
    localStorage.setItem('novira.settings', JSON.stringify({ version: 0, state: { language: 'en', shouldUseCpuNoise: true, enableImageDebugging: true } }));
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().language).toBe('en');
    expect(JSON.parse(localStorage.getItem('novira.settings')!).state).not.toHaveProperty('shouldUseCpuNoise');
    expect(useSettings.getState()).not.toHaveProperty('enableImageDebugging');
  });
});

describe('the tab the app opens on', () => {
  it('opens the chosen tab, or the last one, and remembers the tab open from then on', () => {
    useSettings.getState().set({ startTab: 'queue' });
    const stop = applyStartTab();
    expect(useUi.getState().activeTab).toBe('queue');
    useUi.getState().setTab('comic');
    expect(useSettings.getState().lastTab).toBe('comic');
    stop();
    useSettings.getState().set({ startTab: 'last' });
    applyStartTab()();
    expect(useUi.getState().activeTab).toBe('comic');
  });
});

describe('how new things start', () => {
  it('starts new comics and their added pages as the settings say', () => {
    useSettings.getState().set({ comicPageSize: 'B4', comicDirection: 'ltr', comicPanelCount: 5, comicFrameMm: 1.2, comicMarginMm: 2 });
    useComic.getState().createProject('Defaults');
    const first = activePage(useComic.getState())!;
    expect(first).toMatchObject({ size: 'B4', direction: 'ltr', frameMm: 1.2, marginMm: 2 });
    expect(first.panels).toHaveLength(5);
    useSettings.getState().set({ comicPanelCount: 1 });
    useComic.getState().addPage();
    expect(activePage(useComic.getState())!.panels).toHaveLength(1);
  });

  it('gives new text the default font when one is chosen, and the standard one otherwise', () => {
    const layer = newTextLayer({ width: 512, height: 512 }, 'hi');
    expect(withDefaultFont(layer)).toBe(layer);
    useSettings.getState().set({ textFont: 'Meiryo' });
    expect(withDefaultFont(layer).style.fontFamily).toBe('Meiryo');
    const id = useTextEditor.getState().addText('hello');
    expect(useTextEditor.getState().scene.layers.find((l) => l.id === id)?.style.fontFamily).toBe('Meiryo');
  });

  it('keeps as many undo steps in the canvas as the setting says', () => {
    useSettings.getState().set({ undoLimit: UNDO_LIMIT_RANGE.min });
    for (let i = 0; i < UNDO_LIMIT_RANGE.min + 5; i++) useCanvas.getState().setBbox({ x: i, y: 0, width: 512, height: 512 });
    expect(useCanvas.getState().past.length).toBeLessThanOrEqual(UNDO_LIMIT_RANGE.min);
  });
});
