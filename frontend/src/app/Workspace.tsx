// Three resizable columns for the image tabs: parameters | main view | gallery and assistant (and layers on canvas).
import { CaretDoubleLeft, CaretDoubleRight } from '@phosphor-icons/react';
import { type RefObject, useEffect, useRef } from 'react';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { CanvasView } from '@/features/canvas/CanvasView';
import { DraftsView } from '@/features/drafts/DraftsView';
import { LogoPanel, LogoResults } from '@/features/logo/LogoView';
import { AudioResults } from '@/features/media/AudioResults';
import { MediaTabs } from '@/features/media/MediaTabs';
import { MusicPanel } from '@/features/music/MusicView';
import { TextCanvas } from '@/features/text/TextCanvas';
import { TextPanel } from '@/features/text/TextPanel';
import { VideoPanel, VideoResults } from '@/features/video/VideoView';
import { VoicePanel } from '@/features/voice/VoiceView';
import { InvokeBar } from '@/features/invoke/InvokeBar';
import { Launchpad } from '@/features/launchpad/Launchpad';
import { ParametersPanel } from '@/features/params/ParametersPanel';
import { ImageViewer } from '@/features/viewer/ImageViewer';
import { WorkflowEditor, WorkflowLibraryCard, WorkflowsLeftPanel } from '@/features/workflows/WorkflowEditor';
import { t, type MessageKey } from '@/i18n';
import { useQueue } from '@/state/queue';
import { ComicWorkspace } from './ComicWorkspace';
import { RightColumn } from './RightColumn';
import { MAIN_VIEWS, useUi, type MainView, type TabName } from '@/state/ui';
import { ErrorBoundary, IconButton, ProgressBar } from '@/ui';

const VIEW_LABEL_KEYS: Record<MainView, MessageKey> = {
  launchpad: 'app.views.launchpad',
  viewer: 'app.views.viewer',
  canvas: 'app.views.canvas',
  comic: 'app.views.comic',
  editor: 'app.views.editor',
  drafts: 'app.views.drafts',
};

export function Workspace({ tab }: { tab: TabName }) {
  if (tab === 'comic') return <ComicWorkspace />;
  return <ImageWorkspace tab={tab} />;
}

function ImageWorkspace({ tab }: { tab: TabName }) {
  const leftOpen = useUi((s) => s.leftPanelOpen);
  const rightOpen = useUi((s) => s.rightPanelOpen);
  const media = useUi((s) => s.media);
  const setLeft = useUi((s) => s.setLeftPanelOpen);
  const setRight = useUi((s) => s.setRightPanelOpen);
  const setWidth = useUi((s) => s.setPanelWidth);
  const { left: leftWidth, right: rightWidth } = useUi.getState().panelWidths;
  const left = usePanelRef();
  const right = usePanelRef();
  // The library reports sizes as whole pixels (offsetWidth); the columns are kept to the fraction from the elements, or
  // two screens differ by part of a pixel.
  const leftEl = useRef<HTMLDivElement>(null);
  const rightEl = useRef<HTMLDivElement>(null);
  const widthOf = (el: RefObject<HTMLDivElement | null>) => el.current?.getBoundingClientRect().width ?? 0;

  useEffect(() => {
    const p = left.current;
    if (!p) return;
    if (leftOpen && p.isCollapsed()) p.expand();
    if (!leftOpen && !p.isCollapsed()) p.collapse();
  }, [leftOpen, left]);
  useEffect(() => {
    const p = right.current;
    if (!p) return;
    if (rightOpen && p.isCollapsed()) p.expand();
    if (!rightOpen && !p.isCollapsed()) p.collapse();
  }, [rightOpen, right]);
  // Every image screen stays mounted (App's <Activity>) and sized its columns when it first opened; a hidden screen runs
  // no effects, so this runs each time the screen shows and takes the widths last dragged on another screen.
  useEffect(() => {
    const widths = useUi.getState().panelWidths;
    for (const [p, el, px] of [[left.current, leftEl, widths.left], [right.current, rightEl, widths.right]] as const) {
      if (p && !p.isCollapsed() && Math.abs(widthOf(el) - px) >= 0.01) p.resize(px);
    }
  }, [left, right]);

  return (
    <Group orientation="horizontal" className="workspace">
      <Panel
        id="left"
        panelRef={left}
        elementRef={leftEl}
        defaultSize={leftWidth}
        minSize={320}
        maxSize={640}
        collapsible
        collapsedSize={0}
        onResize={(size) => {
          setLeft(size.inPixels > 0);
          if (size.inPixels > 0) setWidth('left', widthOf(leftEl));
        }}
        className="workspace__left"
      >
        <div className="panel">
          <ErrorBoundary area="left panel" resetKeys={[media]}>
            {/* The Workflows tab keeps its Library card above the Generate button, where the other tabs have their presets. */}
            {tab === 'workflows' && <WorkflowLibraryCard />}
            <InvokeBar tab={tab} />
            <LeftBody tab={tab} />
          </ErrorBoundary>
        </div>
      </Panel>
      <Separator className="resize-handle" />
      <Panel id="center" minSize={320} className="workspace__center">
        <ErrorBoundary area="main area" resetKeys={[media]}>
          <MainArea tab={tab} />
        </ErrorBoundary>
      </Panel>
      <Separator className="resize-handle" />
      <Panel
        id="right"
        panelRef={right}
        elementRef={rightEl}
        defaultSize={rightWidth}
        minSize={300}
        maxSize={720}
        collapsible
        collapsedSize={0}
        onResize={(size) => {
          setRight(size.inPixels > 0);
          if (size.inPixels > 0) setWidth('right', widthOf(rightEl));
        }}
        className="workspace__right"
      >
        <RightColumn tab={tab} />
      </Panel>
    </Group>
  );
}

/** Left panel body: the Generate tab picks what to make; the other tabs are always about images. */
function LeftBody({ tab }: { tab: TabName }) {
  const media = useUi((s) => s.media);
  if (tab === 'workflows') return <div className="panel__scroll"><WorkflowsLeftPanel /></div>;
  if (tab !== 'generate') return <div className="panel__scroll"><ParametersPanel tab={tab} /></div>;
  return (
    <>
      <MediaTabs />
      {media === 'image' && <div className="panel__scroll"><ParametersPanel tab={tab} /></div>}
      {media === 'video' && <VideoPanel />}
      {media === 'text' && <TextPanel />}
      {media === 'music' && <MusicPanel />}
      {media === 'voice' && <VoicePanel />}
      {media === 'logo' && <LogoPanel />}
    </>
  );
}

function MainArea({ tab }: { tab: TabName }) {
  const media = useUi((s) => s.media);
  const otherMedia = tab === 'generate' && media !== 'image';
  const views = otherMedia ? [] : (MAIN_VIEWS[tab] ?? ['viewer']);
  const view = useUi((s) => s.mainView[tab]);
  const setView = useUi((s) => s.setMainView);
  const leftOpen = useUi((s) => s.leftPanelOpen);
  const rightOpen = useUi((s) => s.rightPanelOpen);
  const toggleLeft = useUi((s) => s.toggleLeft);
  const toggleRight = useUi((s) => s.toggleRight);
  const progress = useQueue((s) => s.progress);
  const running = useQueue((s) => s.status.inProgress > 0);
  return (
    <div className="mainarea">
      <ProgressBar
        className="mainarea__progress"
        label={t('queue.status.inProgress')}
        value={progress ? progress.step / progress.totalSteps : 0}
        indeterminate={running && !progress}
      />
      <div className="mainarea__tabs">
        <IconButton
          label={leftOpen ? t('app.panels.hideLeft') : t('app.panels.showLeft')}
          icon={leftOpen ? <CaretDoubleLeft /> : <CaretDoubleRight />}
          size="xs"
          onClick={toggleLeft}
        />
        <div className="mainarea__tablist" role="tablist">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            data-testid={`view-${v}`}
            className={`mainarea__tab${view === v ? ' is-active' : ''}`}
            onClick={() => setView(tab, v)}
          >
            {t(VIEW_LABEL_KEYS[v])}
          </button>
        ))}
        </div>
        <span className="mainarea__spacer" />
        <IconButton
          label={rightOpen ? t('app.panels.hideRight') : t('app.panels.showRight')}
          icon={rightOpen ? <CaretDoubleRight /> : <CaretDoubleLeft />}
          size="xs"
          onClick={toggleRight}
        />
      </div>
      <div className="mainarea__body">
        {otherMedia && media === 'video' && <VideoResults />}
        {otherMedia && media === 'logo' && <LogoResults />}
        {otherMedia && media === 'text' && <TextCanvas />}
        {otherMedia && (media === 'music' || media === 'voice') && <AudioResults kind={media} />}
        {!otherMedia && view === 'launchpad' && <Launchpad tab={tab} />}
        {!otherMedia && view === 'viewer' && <ImageViewer />}
        {!otherMedia && view === 'canvas' && <CanvasView tab={tab} />}
        {!otherMedia && view === 'editor' && <WorkflowEditor tab={tab} />}
        {!otherMedia && view === 'drafts' && <DraftsView />}
      </div>
    </div>
  );
}
