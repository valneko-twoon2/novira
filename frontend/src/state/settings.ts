// User preferences (Settings modal), kept in the browser storage. A saved value of the wrong kind or out of range is read
// back as the default, so a hand-edited or old store never breaks a screen.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCALES, type Locale } from '@/i18n';
import { FRAME_MARGIN_RANGE, FRAME_WIDTH_RANGE, PAGE_SIZES, READING_DIRECTIONS, type PageSize, type ReadingDirection } from './comic/document';
import { NAV, TABS, useUi, type NavName, type TabName } from './ui';

export type ThemeName = 'dark' | 'light';
/** The tab the app opens on: one of the side bar's, or the one open when it was last closed. */
/** A side bar entry, or the tab that was open last (the comic is reached from Generate, so it is not offered). */
export type StartTab = NavName | 'last';

/** How long a notification stays, in seconds. */
export const TOAST_SECONDS_RANGE = { min: 2, max: 15, step: 0.5, default: 3.5 } as const;
/** How many steps each editor (canvas, comic, text) can undo. */
export const UNDO_LIMIT_RANGE = { min: 10, max: 200, step: 10, default: 60 } as const;
/** Whether the AI assistant may read the user's pictures and prompts: always, after asking each time, or never. */
export const READ_ACCESS = ['always', 'ask', 'never'] as const;
export type ReadAccess = (typeof READ_ACCESS)[number];

/** How many panels a new comic page starts with. */
export const COMIC_PANELS_RANGE = { min: 1, max: 6, step: 1, default: 3 } as const;
/** How many candidates the Drafts screen asks for at first (the number box there can still be changed per run). */
export const DRAFT_COUNT_RANGE = { min: 1, max: 24, step: 1, default: 4 } as const;
/** How far, in percent of the steps, the Drafts screen draws at first (the slider there can still be changed per run; `POSITION_MIN`..`POSITION_MAX` of `drafts.ts`). */
export const DRAFT_POSITION_RANGE = { min: 25, max: 60, step: 5, default: 35 } as const;

export interface SettingsValues {
  language: Locale;
  theme: ThemeName;
  startTab: StartTab;
  /** The tab that was open last, for startTab 'last'. */
  lastTab: TabName;
  toastSeconds: number;
  confirmOnDelete: boolean;
  antialiasProgressImages: boolean;
  undoLimit: number;
  /** Mock only: delay per denoising step in ms. */
  mockStepDelay: number;
  /** Desktop app only: zoom of the whole UI (1 = 100 %). */
  uiZoom: number;
  /** Developer log button in the sidebar (on by default in development builds). */
  showDevLog: boolean;
  /** The font of the comic's balloons that have none of their own; empty for the app's standard font. */
  comicFont: string;
  /** The font of new text layers; empty for the app's standard font. */
  textFont: string;
  /** How a new comic page starts: paper, reading direction, panels, frame line width and the white margin round it. */
  comicPageSize: PageSize;
  comicDirection: ReadingDirection;
  comicPanelCount: number;
  comicFrameMm: number;
  comicMarginMm: number;
  /** How many candidates the Drafts screen starts a batch with. */
  draftCount: number;
  /** How far, in percent of the steps, the Drafts screen draws a batch at first. */
  draftPosition: number;
  /** Whether the start-up screen waits for the image engine (ComfyUI) to finish loading; off opens the app at once, with the engine banner. */
  waitForEngine: boolean;
  /** Whether the AI assistant may read the gallery's pictures and their prompts, and the prompt boxes. */
  assistantReadAccess: ReadAccess;
  /** Whether the AI assistant may look facts up on Wikipedia (its search words leave the PC). Separate from reading pictures. */
  assistantWebAccess: ReadAccess;
}

interface SettingsState extends SettingsValues {
  set: (patch: Partial<SettingsValues>) => void;
  reset: () => void;
}

export const SETTINGS_DEFAULTS: SettingsValues = {
  language: 'ja',
  theme: 'dark',
  startTab: 'generate',
  lastTab: 'generate',
  toastSeconds: TOAST_SECONDS_RANGE.default,
  confirmOnDelete: true,
  antialiasProgressImages: false,
  undoLimit: UNDO_LIMIT_RANGE.default,
  mockStepDelay: 60,
  uiZoom: 1,
  showDevLog: import.meta.env.DEV,
  comicFont: '',
  textFont: '',
  comicPageSize: 'A4',
  comicDirection: 'rtl',
  comicPanelCount: COMIC_PANELS_RANGE.default,
  comicFrameMm: FRAME_WIDTH_RANGE.default,
  comicMarginMm: FRAME_MARGIN_RANGE.default,
  draftCount: DRAFT_COUNT_RANGE.default,
  draftPosition: DRAFT_POSITION_RANGE.default,
  waitForEngine: true,
  assistantReadAccess: 'ask',
  assistantWebAccess: 'ask',
};

const oneOf = <T>(v: unknown, options: readonly T[], fallback: T): T => options.find((o) => o === v) ?? fallback;
const inRange = (v: unknown, r: { min: number; max: number }, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max ? v : fallback);
/** A whole number in range: a count of pictures is never fractional. */
const wholeInRange = (v: unknown, r: { min: number; max: number }, fallback: number) => (Number.isInteger(v) ? inRange(v, r, fallback) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const font = (v: unknown) => (typeof v === 'string' && v.length <= 128 && !/["\\;{}<>]/.test(v) ? v : '');

/** Saved settings read back field by field; anything of the wrong kind or out of range becomes the default. */
export function restoreSettings(saved: unknown): SettingsValues {
  const s = (typeof saved === 'object' && saved !== null ? saved : {}) as Record<string, unknown>;
  const d = SETTINGS_DEFAULTS;
  return {
    language: oneOf(s.language, LOCALES, d.language),
    theme: oneOf(s.theme, ['dark', 'light'] as const, d.theme),
    startTab: oneOf<StartTab>(s.startTab, [...NAV, 'last'], d.startTab),
    lastTab: oneOf(s.lastTab, TABS, d.lastTab),
    toastSeconds: inRange(s.toastSeconds, TOAST_SECONDS_RANGE, d.toastSeconds),
    confirmOnDelete: bool(s.confirmOnDelete, d.confirmOnDelete),
    antialiasProgressImages: bool(s.antialiasProgressImages, d.antialiasProgressImages),
    undoLimit: inRange(s.undoLimit, UNDO_LIMIT_RANGE, d.undoLimit),
    mockStepDelay: inRange(s.mockStepDelay, { min: 0, max: 1000 }, d.mockStepDelay),
    uiZoom: inRange(s.uiZoom, { min: 0.5, max: 2 }, d.uiZoom),
    showDevLog: bool(s.showDevLog, d.showDevLog),
    comicFont: font(s.comicFont),
    textFont: font(s.textFont),
    comicPageSize: oneOf(s.comicPageSize, PAGE_SIZES, d.comicPageSize),
    comicDirection: oneOf(s.comicDirection, READING_DIRECTIONS, d.comicDirection),
    comicPanelCount: inRange(s.comicPanelCount, COMIC_PANELS_RANGE, d.comicPanelCount),
    comicFrameMm: inRange(s.comicFrameMm, FRAME_WIDTH_RANGE, d.comicFrameMm),
    comicMarginMm: inRange(s.comicMarginMm, FRAME_MARGIN_RANGE, d.comicMarginMm),
    draftCount: wholeInRange(s.draftCount, DRAFT_COUNT_RANGE, d.draftCount),
    draftPosition: wholeInRange(s.draftPosition, DRAFT_POSITION_RANGE, d.draftPosition),
    waitForEngine: bool(s.waitForEngine, d.waitForEngine),
    assistantReadAccess: oneOf(s.assistantReadAccess, READ_ACCESS, d.assistantReadAccess),
    assistantWebAccess: oneOf(s.assistantWebAccess, READ_ACCESS, d.assistantWebAccess),
  };
}

const values = (s: SettingsState): SettingsValues => restoreSettings(s);

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...SETTINGS_DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(SETTINGS_DEFAULTS),
    }),
    {
      name: 'novira.settings',
      version: 1,
      partialize: values,
      // Version 0 also kept four switches that did nothing; reading field by field leaves them behind.
      migrate: (saved) => restoreSettings(saved) as unknown as SettingsState,
      merge: (saved, current) => ({ ...current, ...restoreSettings(saved) }),
    },
  ),
);

/** How many steps an editor keeps for undo. */
export const undoLimit = () => useSettings.getState().undoLimit;

/** Opens the tab Settings say the app starts on, and from then on remembers the open tab (for "the last tab"). */
export function applyStartTab(): () => void {
  const { startTab, lastTab } = useSettings.getState();
  useUi.getState().setTab(startTab === 'last' ? lastTab : startTab);
  return useUi.subscribe((ui, before) => {
    if (ui.activeTab !== before.activeTab) useSettings.getState().set({ lastTab: ui.activeTab });
  });
}
