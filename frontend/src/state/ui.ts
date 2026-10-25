// Layout and navigation state: active tab, main view per tab, panel visibility, open modal.
import { create } from 'zustand';

/** Every screen. The comic is a mode of the Generate entry, not a side bar entry of its own. */
export const TABS = ['generate', 'canvas', 'comic', 'upscaling', 'workflows', 'models', 'browse', 'queue', 'extensions'] as const;
export type TabName = (typeof TABS)[number];

/** The screens the Generate entry switches between (Generate and the comic icon in the media row of its left panel). */
export const GENERATE_MODES = ['generate', 'comic'] as const;
export type GenerateMode = (typeof GENERATE_MODES)[number];
export const isGenerateMode = (tab: TabName): tab is GenerateMode => (GENERATE_MODES as readonly TabName[]).includes(tab);

/** The side bar's entries, in order. */
export const NAV = ['generate', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue', 'extensions'] as const;
export type NavName = (typeof NAV)[number];

/** The side bar entry a screen belongs to. */
export const navOf = (tab: TabName): NavName => (tab === 'comic' ? 'generate' : tab);

/** The number key of each side bar entry: 1 to 8 in the side bar's order. */
export const NAV_HOTKEYS: Record<NavName, string> = {
  generate: '1',
  canvas: '2',
  upscaling: '3',
  workflows: '4',
  models: '5',
  browse: '6',
  queue: '7',
  extensions: '8',
};

/** Views shown in the center panel of a tab (InvokeAI v6 dock tabs). */
export type MainView = 'launchpad' | 'viewer' | 'canvas' | 'editor' | 'drafts' | 'comic';

export const MAIN_VIEWS: Partial<Record<TabName, MainView[]>> = {
  generate: ['launchpad', 'viewer', 'drafts'],
  canvas: ['launchpad', 'canvas', 'viewer'],
  comic: ['comic', 'viewer'],
  upscaling: ['launchpad', 'viewer'],
  workflows: ['launchpad', 'editor', 'viewer'],
};

/** What the Generate tab makes: the left panel and the center area follow it. */
export const MEDIA_KINDS = ['image', 'video', 'music', 'voice', 'logo', 'text'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Screens left out of the app's own build for now (Vite mode `production`); the dev server, the tests and every harness
 * build (mode `harness`, tools/harness-paths.mjs) show them all. Empty this set to bring them back.
 */
export const HIDDEN_TABS: ReadonlySet<MediaKind | TabName> = new Set<MediaKind | TabName>(['video', 'music', 'voice', 'logo', 'text', 'comic']);

/**
 * Whether a screen can be opened in this build. The store refuses to open a hidden one, so no way in (an icon, the
 * gallery's menu, the assistant, a saved start tab) reaches it; the assistant is not told about it either.
 */
export function isScreenShown(screen: MediaKind | TabName): boolean {
  return import.meta.env.MODE !== 'production' || !HIDDEN_TABS.has(screen);
}

/** The kinds made by a queue job of their own: not the image form's pictures, not the text editor's layers. */
export type GeneratedMedia = Exclude<MediaKind, 'image' | 'text'>;
// A Record, so a new kind of media does not compile until it is put here or left out above.
const GENERATED: Record<GeneratedMedia, true> = { video: true, music: true, voice: true, logo: true };
export const GENERATED_MEDIA = Object.keys(GENERATED) as GeneratedMedia[];

export type ModalName = 'settings' | 'hotkeys' | 'about' | 'workflowLibrary' | null;

interface UiState {
  activeTab: TabName;
  /** The mode the Generate entry opens: the last of Generate and Comic that was shown. */
  generateMode: GenerateMode;
  mainView: Record<TabName, MainView>;
  media: MediaKind;
  setMedia: (media: MediaKind) => void;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  modal: ModalName;
  /** The settings tab the next opening asks for (read once by the modal); null for the tab last open. */
  settingsTab: string | null;
  /** Bumped to ask the prompt box to take focus. */
  focusPromptNonce: number;
  /** Last user-set side panel widths in px (kept across tab switches). */
  panelWidths: { left: number; right: number };
  setPanelWidth: (side: 'left' | 'right', px: number) => void;
  setTab: (tab: TabName) => void;
  setMainView: (tab: TabName, view: MainView) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  togglePanels: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  openModal: (m: ModalName) => void;
  /** Opens the settings modal on a tab (a SettingsModal tab id such as 'engine'). */
  openSettings: (tab: string) => void;
  focusPrompt: () => void;
}

export const useUi = create<UiState>()((set, get) => ({
  activeTab: 'generate',
  generateMode: 'generate',
  mainView: {
    generate: 'launchpad',
    canvas: 'canvas',
    comic: 'comic',
    upscaling: 'launchpad',
    workflows: 'editor',
    models: 'viewer',
    browse: 'viewer',
    queue: 'viewer',
    extensions: 'viewer',
  },
  media: 'image',
  setMedia: (media) => {
    if (isScreenShown(media)) set({ media });
  },
  leftPanelOpen: true,
  rightPanelOpen: true,
  modal: null,
  settingsTab: null,
  focusPromptNonce: 0,
  panelWidths: { left: 400, right: 400 },
  setPanelWidth: (side, px) => set((s) => (Math.abs(s.panelWidths[side] - px) < 1 ? s : { panelWidths: { ...s.panelWidths, [side]: Math.round(px) } })),
  setTab: (activeTab) => {
    if (isScreenShown(activeTab)) set(isGenerateMode(activeTab) ? { activeTab, generateMode: activeTab } : { activeTab });
  },
  setMainView: (tab, view) => set((s) => ({ mainView: { ...s.mainView, [tab]: view } })),
  toggleLeft: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRight: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  togglePanels: () => {
    const { leftPanelOpen, rightPanelOpen } = get();
    const open = !(leftPanelOpen || rightPanelOpen);
    set({ leftPanelOpen: open, rightPanelOpen: open });
  },
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  openModal: (modal) => set({ modal }),
  openSettings: (settingsTab) => set({ modal: 'settings', settingsTab }),
  focusPrompt: () => set((s) => ({ focusPromptNonce: s.focusPromptNonce + 1 })),
}));

/** Switch to a tab and show the image viewer there (used after picking an image). */
export function showViewer(tab?: TabName) {
  const ui = useUi.getState();
  const target = tab ?? ui.activeTab;
  if (MAIN_VIEWS[target]?.includes('viewer')) ui.setMainView(target, 'viewer');
}
