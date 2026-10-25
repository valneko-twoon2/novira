// The phone layout: a title bar with the job being drawn, one tab at a time, and the tabs at the foot, where a thumb
// reaches them. It is the same app as the desktop layout (the same stores, the same backend calls), laid out for a narrow
// screen held upright; `state/layout.ts` says when it is shown.
import { Cards, Compass, Cube, Images, ListBullets, MagicWand } from '@phosphor-icons/react';
import { Activity, useEffect, useRef, type ReactNode } from 'react';
import { PhoneChatLayer } from '@/features/agent/PhoneChat';
import { ModelBrowser } from '@/features/browse/ModelBrowser';
import { CaptionDialog } from '@/features/caption';
import { DraftsView } from '@/features/drafts/DraftsView';
import { DeleteImagesModal } from '@/features/gallery/DeleteImagesModal';
import { ImportDialog } from '@/features/models/ImportDialog';
import { ModelManager } from '@/features/models/ModelManager';
import { CharacterDialog } from '@/features/params/characters/CharacterDialog';
import { ModelPartsDialog } from '@/features/params/model/ModelPartsDialog';
import { DeriveDialog } from '@/features/derive';
import { FaceFixDialog } from '@/features/facefix';
import { ShareDialog, WatermarkCheckDialog } from '@/features/share';
import { CutoutDialog } from '@/features/segment';
import { XyPlotDialog } from '@/features/xyplot';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { useQueue } from '@/state/queue';
import { useUi } from '@/state/ui';
import { cx, ErrorBoundary } from '@/ui';
import { PhoneGenerate } from './PhoneGenerate';
import { PhoneHeader } from './PhoneHeader';
import { PhoneImages } from './PhoneImages';
import { PhoneQueue } from './PhoneQueue';
import { PHONE_TABS, tabLabel, usePhone, type PhoneTab } from './phoneStore';
import { PhoneView } from './PhoneView';
import './phone.css';

const TAB_ICONS: Record<PhoneTab, ReactNode> = {
  generate: <MagicWand size={22} />,
  images: <Images size={22} />,
  drafts: <Cards size={22} />,
  queue: <ListBullets size={22} />,
  models: <Cube size={22} />,
  browse: <Compass size={22} />,
};

const BODIES: Record<PhoneTab, () => ReactNode> = {
  generate: () => <PhoneGenerate />,
  images: () => <PhoneImages />,
  // A candidate opens full screen here, not in the desktop viewer.
  drafts: () => <DraftsView onOpen={(name) => usePhone.getState().show({ kind: 'image', name })} />,
  queue: () => <PhoneQueue />,
  // The desktop's screens, laid out for a phone by phone.css.
  models: () => <ModelManager />,
  browse: () => <ModelBrowser />,
};

/** The phone layout draws with the Generate tab's settings and builder. */
function drawFromGenerate() {
  const ui = useUi.getState();
  ui.setTab('generate');
  ui.setMedia('image');
}

export function PhoneShell() {
  const tab = usePhone((s) => s.tab);
  const viewing = usePhone((s) => s.view !== null);
  const chatting = useAgent((s) => s.open);
  // Whatever the desktop layout had open; and again after each request of the assistant, whose tools open the screen
  // they change (a screen this layout has not), so the Generate button keeps drawing pictures.
  useEffect(() => {
    drawFromGenerate();
    return useAgent.subscribe((s, prev) => {
      if (prev.busy && !s.busy) drawFromGenerate();
    });
  }, []);
  return (
    // What is in front, for the notices to rise above its foot (phone.css, phoneChat.css).
    <div className="phone" data-tab={tab} data-viewing={viewing || undefined} data-chat={chatting || undefined} data-testid="phone-shell">
      <PhoneHeader />
      <main className="phone__main">
        <Tabs tab={tab} />
      </main>
      <PhoneNav tab={tab} />
      {/* The assistant's chat screen; a picture opened full screen goes over it. */}
      <PhoneChatLayer />
      <ErrorBoundary area="phone picture">
        <PhoneView />
      </ErrorBoundary>
      <ErrorBoundary area="dialogs">
        <DeleteImagesModal />
        {/* What the Generate tab's panel opens, as on the desktop. */}
        <ModelPartsDialog />
        <ImportDialog />
        <CharacterDialog />
        <XyPlotDialog />
        <CaptionDialog />
        {/* What the picture's menu opens. */}
        <ShareDialog />
        <WatermarkCheckDialog />
        <DeriveDialog />
        <CutoutDialog />
        <FaceFixDialog />
      </ErrorBoundary>
    </div>
  );
}

/** Each tab, once opened, stays mounted and hidden while another shows, so its scroll and inputs are kept. */
function Tabs({ tab }: { tab: PhoneTab }) {
  const opened = useRef(new Set<PhoneTab>());
  opened.current.add(tab);
  return PHONE_TABS.filter((x) => opened.current.has(x)).map((x) => (
    <Activity key={x} mode={x === tab ? 'visible' : 'hidden'}>
      <ErrorBoundary area={`phone tab ${x}`}>
        <div className="phone__tab" data-testid={`phone-tab-${x}`}>
          {BODIES[x]()}
        </div>
      </ErrorBoundary>
    </Activity>
  ));
}

function PhoneNav({ tab }: { tab: PhoneTab }) {
  const setTab = usePhone((s) => s.setTab);
  const queued = useQueue((s) => s.status.pending + s.status.inProgress);
  return (
    <nav className="phone-nav" aria-label={t('phone.nav')}>
      {PHONE_TABS.map((x) => (
        <button
          key={x}
          type="button"
          className={cx('phone-nav__tab', x === tab && 'is-on')}
          aria-current={x === tab ? 'page' : undefined}
          data-testid={`phone-nav-${x}`}
          onClick={() => setTab(x)}
        >
          <span className="phone-nav__icon">
            {TAB_ICONS[x]}
            {x === 'queue' && queued > 0 && (
              <span className="phone-nav__badge" aria-label={t('params.invoke.queued', { count: queued })} data-testid="phone-queue-badge">
                {queued}
              </span>
            )}
          </span>
          <span>{tabLabel(x)}</span>
        </button>
      ))}
    </nav>
  );
}
