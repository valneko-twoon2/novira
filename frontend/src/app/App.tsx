// Composition root: providers, backend start-up, feature registration, top-level layout.
import { Activity, memo, useEffect, useRef, useState } from 'react';
import { backend, perf } from '@/backend';
import { PackDock } from '@/features/downloads/PackDock';
import { EngineBanner } from '@/features/engine/EngineBanner';
import { AgentHost } from '@/features/agent/AgentHost';
import { PoseEditor3DDialog } from '@/features/canvas/pose3d/PoseEditor3DDialog';
import { PoseFromImageDialog } from '@/features/canvas/PoseFromImageDialog';
import { ModelBrowser } from '@/features/browse/ModelBrowser';
import { ImportDialog } from '@/features/models/ImportDialog';
import { ModelManager } from '@/features/models/ModelManager';
import { CharacterDialog } from '@/features/params/characters/CharacterDialog';
import { ModelPartsDialog } from '@/features/params/model/ModelPartsDialog';
import { QueueTab } from '@/features/queue/QueueTab';
import { BatchDialog } from '@/features/batch';
import { CaptionDialog } from '@/features/caption';
import { DeriveDialog } from '@/features/derive';
import { FaceFixDialog } from '@/features/facefix';
import { MangaFinishDialog } from '@/features/viewer/manga';
import { PoseDialog } from '@/features/pose';
import { XyPlotDialog } from '@/features/xyplot';
import { FinishDialog } from '@/features/finish';
import { ShareDialog, WatermarkCheckDialog } from '@/features/share';
import { CutoutDialog, SegmentDialog } from '@/features/segment';
import { AboutModal, HotkeysModal, SettingsModal } from '@/features/settings/Modals';
import { Splash } from '@/features/splash/Splash';
import { useSplashGate } from '@/features/splash/useSplashGate';
import { ExtensionsTab } from '@/features/workflows/ExtensionsTab';
import { setLocale, type Locale } from '@/i18n';
import { LocaleRoot } from '@/i18n/LocaleRoot';
import { describeError, devLog, installDevLogCapture, useDevLog } from '@/state/devLog';
import { usePhoneLayout } from '@/state/layout';
import { useSettings } from '@/state/settings';
import { TABS, useUi, type TabName } from '@/state/ui';
import { startBackend } from '@/state/wiring';
import { ErrorBoundary, TooltipProvider } from '@/ui';
import { GlobalHotkeys } from './GlobalHotkeys';
import { NativeFeel } from './NativeFeel';
import { LanApprovals } from './LanApprovals';
import { PhoneShell } from './phone/PhoneShell';
import { registerFeatures } from './registerFeatures';
import { UiZoom } from './UiZoom';
import { SideNav } from './SideNav';
import { Toaster } from './Toaster';
import { Workspace } from './Workspace';
import { DevLogPanel } from '@/features/devlog/DevLogPanel';
// After every feature's styles, as main.tsx imported it before the app was loaded on its own.
import './app.css';

registerFeatures();

// Errors nothing else caught are logged and shown instead of failing silently.
installDevLogCapture();

// Apply the saved language before the first render (main.tsx waits for its catalog), then follow later changes.
const followLanguage = (language: Locale) =>
  setLocale(language).catch((err: unknown) => devLog('error', 'i18n', `the ${language} messages could not be loaded: ${describeError(err)}`));
void followLanguage(useSettings.getState().language);
useSettings.subscribe((s) => void followLanguage(s.language));

const applyTheme = (theme: string) => {
  document.documentElement.dataset.theme = theme;
  // The window frame follows the app theme (white title bar in light).
  backend.setWindowTheme(theme === 'light' ? 'light' : 'dark');
};
applyTheme(useSettings.getState().theme);
useSettings.subscribe((s) => applyTheme(s.theme));

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void startBackend().then(() => setReady(true));
  }, []);
  // The start-up screen shows the engine's set-up itself, so the banner waits until the app is open.
  const { showSplash, preparing, open } = useSplashGate(ready);
  useEffect(() => {
    if (ready && !showSplash) perf.mark('shell-visible');
  }, [ready, showSplash]);
  return (
    <LocaleRoot>
      <TooltipProvider>
        <ErrorBoundary area="app" variant="screen">
          <UiZoom />
          <NativeFeel />
          {showSplash && <Splash onOpen={open} preparing={preparing} />}
          {/* Built hidden under the start-up screen once the data is in, so opening the app only shows it. */}
          {ready && (
            <Activity mode={showSplash ? 'hidden' : 'visible'}>
              <Shell />
            </Activity>
          )}
          {!showSplash && (
            <ErrorBoundary area="engine banner">
              <EngineBanner />
            </ErrorBoundary>
          )}
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </LocaleRoot>
  );
}

/** The phone layout on a phone-sized window in a browser (`state/layout.ts`), the desktop layout everywhere else. */
function Shell() {
  const phone = usePhoneLayout();
  return phone ? (
    <ErrorBoundary area="phone layout" variant="screen">
      <PhoneShell />
    </ErrorBoundary>
  ) : (
    <DesktopShell />
  );
}

function DesktopShell() {
  const devLogOpen = useDevLog((s) => s.open);
  const showDevLog = useSettings((s) => s.showDevLog);
  return (
    <div className="app">
      <GlobalHotkeys />
      <LanApprovals />
      <SideNav />
      <main className="app__content">
        <Screens />
      </main>
      <ErrorBoundary area="download dock">
        <PackDock />
      </ErrorBoundary>
      <ErrorBoundary area="assistant">
        <AgentHost />
      </ErrorBoundary>
      <ErrorBoundary area="dialogs">
        <SettingsModal />
        <HotkeysModal />
        <AboutModal />
        <SegmentDialog />
        <ImportDialog />
        <ModelPartsDialog />
        <CutoutDialog />
        <CharacterDialog />
        <DeriveDialog />
        <FaceFixDialog />
        <MangaFinishDialog />
        <PoseDialog />
        <PoseFromImageDialog />
        <PoseEditor3DDialog />
        <XyPlotDialog />
        <BatchDialog />
        <FinishDialog />
        <ShareDialog />
        <WatermarkCheckDialog />
      </ErrorBoundary>
      <ErrorBoundary area="describe as a prompt">
        <CaptionDialog />
      </ErrorBoundary>
      {showDevLog && devLogOpen && (
        <ErrorBoundary area="developer log">
          <DevLogPanel />
        </ErrorBoundary>
      )}
    </div>
  );
}

/**
 * The screens. Each one, once opened, stays mounted and is hidden while another is shown (`<Activity>`): building a
 * screen again was most of the time of a switch. A hidden screen keeps its state (scroll, search, open sections) and runs
 * no effects, so its hotkeys, observers and timers are off until it shows again. Only this follows the tab, so a switch
 * does not render the side bar, the dialogs and the docks again. (Rendering the new screen deferred, with
 * useDeferredValue, showed the side bar at once but the screen 30-50 % later, so it renders within the click.)
 */
function Screens() {
  const tab = useUi((s) => s.activeTab);
  const opened = useRef(new Set<TabName>());
  opened.current.add(tab);
  return TABS.filter((t) => opened.current.has(t)).map((t) => (
    <Activity key={t} mode={t === tab ? 'visible' : 'hidden'}>
      <Screen tab={t} shown={t === tab} />
    </Activity>
  ));
}

/** A failed screen stays inside its tab; showing it again tries again. */
function Screen({ tab, shown }: { tab: TabName; shown: boolean }) {
  return (
    <ErrorBoundary area={`tab ${tab}`} resetKeys={[shown]}>
      <ScreenBody tab={tab} />
    </ErrorBoundary>
  );
}

/** Memoised, so showing or hiding a screen does not render it again. */
const ScreenBody = memo(function ScreenBody({ tab }: { tab: TabName }) {
  if (tab === 'models') return <ModelManager />;
  if (tab === 'browse') return <ModelBrowser />;
  if (tab === 'queue') return <QueueTab />;
  if (tab === 'extensions') return <ExtensionsTab />;
  return <Workspace tab={tab} />;
});
