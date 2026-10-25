// Settings modal: a list of tabs on the left (general, generation, gallery, editing, comic and text, engine, accounts, data,
// developer) and the chosen tab's settings on the right. The tab last open is opened again.
import { useEffect, useState } from 'react';
import { backend } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { useUi } from '@/state/ui';
import { cx, ErrorBoundary, Modal } from '@/ui';
import { DataPane } from './DataPane';
import { EnginePane } from './EnginePane';
import { AccountsPane, ComicTextPane, DeveloperPane, EditPane, GalleryPane, GeneralPane, GenerationPane } from './settingsPanes';

import { APP_VERSION } from '@/state/appVersion';

const PANES = {
  general: { label: 'settings.tab.general', Pane: GeneralPane },
  generation: { label: 'settings.tab.generation', Pane: GenerationPane },
  gallery: { label: 'settings.tab.gallery', Pane: GalleryPane },
  edit: { label: 'settings.tab.edit', Pane: EditPane },
  comicText: { label: 'settings.tab.comicText', Pane: ComicTextPane },
  engine: { label: 'settings.tab.engine', Pane: EnginePane },
  accounts: { label: 'settings.tab.accounts', Pane: AccountsPane },
  data: { label: 'settings.tab.data', Pane: DataPane },
  developer: { label: 'settings.tab.developer', Pane: DeveloperPane },
} satisfies Record<string, { label: MessageKey; Pane: () => React.ReactNode }>;
export type SettingsTab = keyof typeof PANES;
const TAB_IDS = Object.keys(PANES) as SettingsTab[];

/** The tab open when the modal was last closed, so it opens there again (kept for the session only). */
let lastTab: SettingsTab = 'general';

export function SettingsModal(_props: { tab?: unknown }) {
  const open = useUi((s) => s.modal === 'settings');
  const openModal = useUi((s) => s.openModal);
  if (!open) return null;
  return (
    <Modal open onOpenChange={(o) => !o && openModal(null)} title={t('settings.title')} size="xl" closeLabel={t('common.close')}>
      <SettingsBody />
    </Modal>
  );
}

function SettingsBody() {
  // A tab asked for by `useUi.openSettings(tab)` wins once; otherwise the tab last open.
  const [tab, setTab] = useState<SettingsTab>(() => {
    const asked = useUi.getState().settingsTab;
    return asked && (TAB_IDS as string[]).includes(asked) ? (asked as SettingsTab) : lastTab;
  });
  useEffect(() => {
    if (useUi.getState().settingsTab) useUi.setState({ settingsTab: null });
  }, []);
  const choose = (next: SettingsTab) => {
    lastTab = next;
    setTab(next);
  };
  const { Pane } = PANES[tab];
  const mock = backend.kind === 'mock';
  return (
    <div className="st" data-testid="settings-modal">
      <nav className="st-nav" role="tablist" aria-orientation="vertical" aria-label={t('settings.title')}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="settings-pane"
            className={cx('st-nav__tab', tab === id && 'is-active')}
            onClick={() => choose(id)}
            data-testid={`settings-tab-${id}`}
          >
            {t(PANES[id].label)}
          </button>
        ))}
        <div className="st-version">{t('settings.version', { version: mock ? `novira ${APP_VERSION} (mock)` : `novira ${APP_VERSION}` })}</div>
      </nav>
      <div className="st-pane" id="settings-pane" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} data-testid={`settings-pane-${tab}`}>
        <ErrorBoundary area={`settings ${tab}`} resetKeys={[tab]}>
          <Pane />
        </ErrorBoundary>
      </div>
    </div>
  );
}
