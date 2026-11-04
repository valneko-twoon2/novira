// The side bar's QR item: in the desktop app and on the page novira-server serves to its own computer, the home network of
// this computer: open or closed, the pairing code a phone scans, the phones asking to pair and the paired ones (`LanPanel`).
// When the server also has the remote listener (away from home, over Tailscale), a second tab drives it (`RemotePanel`);
// the home tab comes first, so pressing the item still opens the home network. Absent everywhere else (a phone, a page
// that cannot read the state).
import { QrCode } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { useLan } from '@/state/lan';
import { Popover, PopoverContent, PopoverTrigger, Tab, TabList, TabPanel, Tabs, Tooltip, withVisibleText } from '@/ui';
import { LanPanel } from './LanPanel';
import { RemotePanel } from './RemotePanel';

export function HomeLinkButton() {
  const api = useLan((s) => s.api);
  const state = useLan((s) => s.state);
  const remote = useLan((s) => s.remote);
  const waiting = state?.pending.length ?? 0;
  useEffect(() => {
    void useLan.getState().init();
  }, []);
  if (!api || !state) return null;
  return (
    <Popover onOpenChange={(open) => useLan.getState().setPopoverOpen(open)}>
      <Tooltip content={t('app.nav.homeLink')} side="right">
        <PopoverTrigger asChild>
          <button type="button" className="sidenav__tab" aria-label={withVisibleText(t('app.nav.homeLink'), t('app.tabs.short.homeLink'))} data-testid="home-link-open">
            <QrCode size={22} weight="regular" />
            <span className="sidenav__label">{t('app.tabs.short.homeLink')}</span>
            {waiting > 0 && <span className="sidenav__count">{waiting}</span>}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="right" align="end" className="lan-popover">
        {remote ? (
          <Tabs defaultValue="home">
            <TabList className="lan__tabs">
              <Tab value="home">{t('app.lan.tabHome')}</Tab>
              <Tab value="away">{t('app.lan.tabAway')}</Tab>
            </TabList>
            <TabPanel value="home">
              <LanPanel api={api} state={state} />
            </TabPanel>
            <TabPanel value="away">
              <RemotePanel api={api} remote={remote} />
            </TabPanel>
          </Tabs>
        ) : (
          <LanPanel api={api} state={state} />
        )}
      </PopoverContent>
    </Popover>
  );
}
