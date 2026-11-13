// Vertical tab bar on the far left (InvokeAI's VerticalNavBar).
import { BoundingBox, Compass, Cube, FlowArrow, FrameCorners, Gear, Info, Keyboard, MagicWand, PuzzlePiece, Queue, Terminal } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { backend } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { useDevLog } from '@/state/devLog';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { isScreenShown, NAV, NAV_HOTKEYS, navOf, useUi, type NavName } from '@/state/ui';
import { Badge, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip, withVisibleText } from '@/ui';
import { NetworkButton } from './NetworkButton';

const ICONS: Record<NavName, ReactNode> = {
  generate: <MagicWand size={22} weight="regular" />,
  canvas: <BoundingBox size={22} weight="regular" />,
  upscaling: <FrameCorners size={22} weight="regular" />,
  workflows: <FlowArrow size={22} weight="regular" />,
  models: <Cube size={22} weight="regular" />,
  browse: <Compass size={22} weight="regular" />,
  queue: <Queue size={22} weight="regular" />,
  extensions: <PuzzlePiece size={22} weight="regular" />,
};

const TAB_LABEL_KEYS: Record<NavName, MessageKey> = {
  generate: 'app.tabs.generate',
  canvas: 'app.tabs.canvas',
  upscaling: 'app.tabs.upscaling',
  workflows: 'app.tabs.workflows',
  models: 'app.tabs.models',
  browse: 'app.tabs.browse',
  queue: 'app.tabs.queue',
  extensions: 'app.nav.extensions',
};

const SHORT_LABEL_KEYS: Record<NavName, MessageKey> = {
  generate: 'app.tabs.short.generate',
  canvas: 'app.tabs.short.canvas',
  upscaling: 'app.tabs.short.upscaling',
  workflows: 'app.tabs.short.workflows',
  models: 'app.tabs.short.models',
  browse: 'app.tabs.short.browse',
  queue: 'app.tabs.short.queue',
  extensions: 'app.tabs.short.extensions',
};

export function SideNav() {
  const active = navOf(useUi((s) => s.activeTab));
  const generateMode = useUi((s) => s.generateMode);
  const setTab = useUi((s) => s.setTab);
  const openModal = useUi((s) => s.openModal);
  const pending = useQueue((s) => s.status.pending + s.status.inProgress);
  const showDevLog = useSettings((s) => s.showDevLog);
  const devLogOpen = useDevLog((s) => s.open);
  const devLogErrors = useDevLog((s) => s.entries.filter((e) => e.level === 'error').length);
  return (
    <nav className="sidenav" aria-label={t('app.nav.label')}>
      <Tooltip content={t('app.nav.about')} side="right">
        <button type="button" className="sidenav__logo" onClick={() => openModal('about')} aria-label={t('app.nav.about')}>
          <span className="sidenav__logo-mark">n</span>
        </button>
      </Tooltip>
      <div className="sidenav__tabs">
        <div className="sidenav__tablist" role="tablist" aria-orientation="vertical">
        {NAV.filter((tab) => tab !== 'extensions' && isScreenShown(tab)).map((tab) => (
          <Tooltip key={tab} content={`${t(TAB_LABEL_KEYS[tab])} (${NAV_HOTKEYS[tab]})`} side="right">
            <button
              type="button"
              role="tab"
              aria-selected={active === tab}
              aria-label={withVisibleText(t(TAB_LABEL_KEYS[tab]), t(SHORT_LABEL_KEYS[tab]))}
              data-testid={`tab-${tab}`}
              className={`sidenav__tab${active === tab ? ' is-active' : ''}`}
              // A mouse switches on the press, not on the release: waiting for the button to come up read as a lag.
              // Touch keeps the click, so a swipe over the bar does not switch; the keyboard's click comes through too.
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) setTab(tab === 'generate' ? generateMode : tab);
              }}
              onClick={() => setTab(tab === 'generate' ? generateMode : tab)}
            >
              {ICONS[tab]}
              <span className="sidenav__label">{t(SHORT_LABEL_KEYS[tab])}</span>
              {tab === 'queue' && pending > 0 && <span className="sidenav__count">{pending}</span>}
            </button>
          </Tooltip>
        ))}
        </div>
      </div>
      <div className="sidenav__spacer" />
      <NetworkButton />
      {showDevLog && (
        <Tooltip content={t('app.devlog.open')} side="right">
          <button
            type="button"
            aria-pressed={devLogOpen}
            aria-label={withVisibleText(t('app.devlog.open'), t('app.devlog.short'))}
            data-testid="devlog-open"
            className={`sidenav__tab${devLogOpen ? ' is-active' : ''}`}
            onClick={() => useDevLog.getState().setOpen(!devLogOpen)}
          >
            <Terminal size={22} weight="regular" />
            <span className="sidenav__label">{t('app.devlog.short')}</span>
            {devLogErrors > 0 && <span className="sidenav__count">{devLogErrors}</span>}
          </button>
        </Tooltip>
      )}
      {backend.kind === 'mock' && (
        <Tooltip content={t('app.nav.mockHint')} side="right">
          <span className="sidenav__mock">
            <Badge scheme="base">{t('app.nav.mock')}</Badge>
          </span>
        </Tooltip>
      )}
      {/* The extensions screen sits just above the settings, apart from the work tabs. */}
      <Tooltip content={`${t(TAB_LABEL_KEYS.extensions)} (${NAV_HOTKEYS.extensions})`} side="right">
        <button
          type="button"
          aria-pressed={active === 'extensions'}
          aria-label={withVisibleText(t(TAB_LABEL_KEYS.extensions), t(SHORT_LABEL_KEYS.extensions))}
          data-testid="tab-extensions"
          className={`sidenav__tab${active === 'extensions' ? ' is-active' : ''}`}
          onClick={() => setTab('extensions')}
        >
          {ICONS.extensions}
          <span className="sidenav__label">{t(SHORT_LABEL_KEYS.extensions)}</span>
        </button>
      </Tooltip>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="sidenav__tab" aria-label={withVisibleText(t('app.nav.settingsMenu'), t('app.nav.settings'))}>
            <Gear size={22} weight="regular" />
            <span className="sidenav__label">{t('app.nav.settings')}</span>
          </button>
        </MenuTrigger>
        <MenuContent side="right" align="end">
          <MenuItem icon={<Gear />} onSelect={() => openModal('settings')}>
            {t('app.nav.settings')}
          </MenuItem>
          <MenuItem icon={<Keyboard />} onSelect={() => openModal('hotkeys')}>
            {t('app.nav.hotkeys')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Info />} onSelect={() => openModal('about')}>
            {t('app.nav.about')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </nav>
  );
}
