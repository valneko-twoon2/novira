// The side bar's network item: in the desktop app and on the page novira-server serves to its own computer, how phones
// reach this computer. Like the settings item it opens a menu, and the choice decides which dialog opens: "at home" is the
// home network (open or closed, the pairing code a phone scans, the phones asking to pair and the paired ones: `LanPanel`),
// "away" the remote listener over Tailscale (`RemotePanel`). Each is its own dialog, centred and of its own size, so
// switching between them never moves anything under the pointer. When the server has no remote listener there is one
// choice only, and the item opens the home dialog at once. Absent everywhere else (a phone, a page that cannot read the state).
import { Globe, House, Network } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useLan } from '@/state/lan';
import { ErrorBoundary, Menu, MenuContent, MenuItem, MenuTrigger, Modal, Tooltip, withVisibleText } from '@/ui';
import { LanPanel } from './LanPanel';
import { RemotePanel } from './RemotePanel';

type Screen = 'home' | 'away';

export function NetworkButton() {
  const api = useLan((s) => s.api);
  const state = useLan((s) => s.state);
  const remote = useLan((s) => s.remote);
  const [screen, setScreen] = useState<Screen | null>(null);
  const waiting = state?.pending.length ?? 0;
  useEffect(() => {
    void useLan.getState().init();
  }, []);
  // While a dialog is open the state is read faster, and a phone's request needs no prompt on the page.
  useEffect(() => {
    useLan.getState().setDialogOpen(screen !== null);
  }, [screen]);
  if (!api || !state) return null;
  const button = (
    <button
      type="button"
      className="sidenav__tab"
      aria-label={withVisibleText(t('app.nav.homeLink'), t('app.tabs.short.homeLink'))}
      data-testid="home-link-open"
      onClick={remote ? undefined : () => setScreen('home')}
    >
      <Network size={22} weight="regular" />
      <span className="sidenav__label">{t('app.tabs.short.homeLink')}</span>
      {waiting > 0 && <span className="sidenav__count">{waiting}</span>}
    </button>
  );
  const shown = screen === 'away' && !remote ? 'home' : screen;
  return (
    <>
      {remote ? (
        <Menu>
          <Tooltip content={t('app.nav.homeLink')} side="right">
            <MenuTrigger asChild>{button}</MenuTrigger>
          </Tooltip>
          <MenuContent side="right" align="end">
            <MenuItem icon={<House />} onSelect={() => setScreen('home')}>
              {t('app.lan.menuHome')}
            </MenuItem>
            <MenuItem icon={<Globe />} onSelect={() => setScreen('away')}>
              {t('app.lan.menuAway')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <Tooltip content={t('app.nav.homeLink')} side="right">
          {button}
        </Tooltip>
      )}
      <Modal
        open={shown !== null}
        onOpenChange={(open) => !open && setScreen(null)}
        title={shown === 'away' ? t('app.lan.menuAway') : t('app.lan.menuHome')}
        size="sm"
        closeLabel={t('common.close')}
      >
        <ErrorBoundary area="network" variant="panel">
          {shown === 'away' && remote ? <RemotePanel api={api} remote={remote} /> : <LanPanel api={api} state={state} />}
        </ErrorBoundary>
      </Modal>
    </>
  );
}
